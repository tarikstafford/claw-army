import { Worker, type Job } from "bullmq";
import { db, evolutionCampaigns, evolutionCampaignIterations } from "@claw/db";
import { eq, and } from "drizzle-orm";
import { workerConnection } from "./task-queue";
import {
  EVOLUTION_CAMPAIGN_QUEUE_NAME,
  type EvolutionCampaignJobData,
} from "./evolution-campaign-queue";
import { createExecution } from "../services/execution.service";
import { planObjectiveAsTaskGraph } from "../services/planner.service";
import { validatePreFlight } from "../services/preflight-validator";
import { spawnRingLeader } from "../services/ring-leader-spawner";

/**
 * Evolution Campaign Worker — consumes {@link EVOLUTION_CAMPAIGN_QUEUE_NAME}
 * jobs enqueued by god-layer-worker after the final verdict of an iteration
 * has been processed. Responsible for:
 *
 *   1. Re-checking campaign state (in case it was halted between enqueue
 *      and pickup)
 *   2. Planning the task graph from the campaign's snapshotted objective
 *   3. Running pre-flight validation with the seed params
 *   4. Calling createExecution() linked to the same evolutionCampaignId
 *   5. Inserting the next iteration row (with delta_from_previous computed
 *      from the previous iteration's EFS)
 *   6. Incrementing the campaign's completed_iteration_count
 *   7. Spawning the Ring Leader for the new execution
 *
 * The worker is idempotent on (campaignId, nextIterationNum): the unique
 * index on (campaign_id, iteration_num) ensures that even if the same job
 * is delivered twice, only one iteration row is created.
 */
const EVOLUTION_CAMPAIGN_CONCURRENCY = 2;
const EVOLUTION_CAMPAIGN_LOCK_DURATION_MS = 5 * 60 * 1000;

async function evolutionCampaignProcessor(
  job: Job<EvolutionCampaignJobData>,
): Promise<void> {
  const { campaignId, previousIterationNum, previousExecutionId } = job.data;
  const nextIterationNum = previousIterationNum + 1;

  // 1. Reload campaign state
  const [campaign] = await db
    .select()
    .from(evolutionCampaigns)
    .where(eq(evolutionCampaigns.id, campaignId));

  if (!campaign) {
    console.warn("[evolution-campaign-worker] campaign not found", {
      campaignId,
    });
    return;
  }

  if (campaign.status !== "running") {
    console.log(
      "[evolution-campaign-worker] campaign no longer running, skipping",
      {
        campaignId,
        status: campaign.status,
      },
    );
    return;
  }

  // 2. Load previous iteration for delta computation
  const [previousIteration] = await db
    .select()
    .from(evolutionCampaignIterations)
    .where(
      and(
        eq(evolutionCampaignIterations.campaignId, campaignId),
        eq(evolutionCampaignIterations.iterationNum, previousIterationNum),
      ),
    );

  if (!previousIteration) {
    console.error("[evolution-campaign-worker] previous iteration not found", {
      campaignId,
      previousIterationNum,
    });
    return;
  }

  const previousEfs =
    previousIteration.efsScore === null
      ? 0
      : Number(previousIteration.efsScore);

  // 3. Plan task graph from snapshotted objective
  let taskGraph;
  try {
    taskGraph = await planObjectiveAsTaskGraph(
      campaign.objective,
      campaign.seedAllowedTools,
      campaign.seedMaxBots,
    );
  } catch (err) {
    console.error("[evolution-campaign-worker] planning failed", {
      campaignId,
      err,
    });
    await markCampaignErrored(campaignId, "planning failed");
    return;
  }

  // 4. Pre-flight validation
  const preflight = validatePreFlight(
    taskGraph,
    campaign.seedAllowedTools,
    campaign.seedBudgetCapCents,
  );
  if (!preflight.valid) {
    console.error("[evolution-campaign-worker] pre-flight failed", {
      campaignId,
      errors: preflight.errors,
    });
    await markCampaignErrored(campaignId, "pre-flight failed");
    return;
  }

  // 5. Create next execution linked to the same campaign
  let nextExecutionId: string;
  try {
    const result = await createExecution({
      objective: campaign.objective,
      maxBots: campaign.seedMaxBots,
      budgetCapCents: campaign.seedBudgetCapCents,
      runtimeLimitSeconds: campaign.seedRuntimeLimitSeconds,
      allowedTools: campaign.seedAllowedTools,
      llmProvider: campaign.seedLlmProvider ?? undefined,
      allowedDomains: campaign.seedAllowedDomains ?? undefined,
      projectId: campaign.projectId ?? undefined,
      campaignType: "campaign",
      evolutionCampaignId: campaignId,
    });
    nextExecutionId = result.executionId;
  } catch (err) {
    console.error("[evolution-campaign-worker] createExecution failed", {
      campaignId,
      err,
    });
    await markCampaignErrored(campaignId, "execution creation failed");
    return;
  }

  // 6. Insert next iteration row. UNIQUE(campaign_id, iteration_num) guards
  //    against duplicate enqueues — onConflictDoNothing means a second
  //    delivery of the same job silently exits here.
  const insertedIterations = await db
    .insert(evolutionCampaignIterations)
    .values({
      campaignId,
      iterationNum: nextIterationNum,
      executionId: nextExecutionId,
      deltaFromPrevious: null, // filled in when this iteration's EFS is computed
    })
    .onConflictDoNothing({
      target: [
        evolutionCampaignIterations.campaignId,
        evolutionCampaignIterations.iterationNum,
      ],
    })
    .returning({ id: evolutionCampaignIterations.id });

  if (insertedIterations.length === 0) {
    // Another worker already created the iteration — don't double-spawn Ring Leader.
    console.warn(
      "[evolution-campaign-worker] iteration already exists, skipping spawn",
      {
        campaignId,
        nextIterationNum,
      },
    );
    return;
  }

  // Track the previous EFS in the job log for observability
  console.log("[evolution-campaign-worker] starting next iteration", {
    campaignId,
    previousExecutionId,
    nextExecutionId,
    nextIterationNum,
    previousEfs,
  });

  // 7. Spawn the Ring Leader for the new execution — same path as
  //    the POST /executions route. Ring Leader will assemble the
  //    population manifest using the latest confirmed souls from dna_store.
  try {
    await spawnRingLeader({
      executionId: nextExecutionId,
      objective: campaign.objective,
      taskGraph,
      toolGrants: campaign.seedAllowedTools,
      budgetCapCents: campaign.seedBudgetCapCents,
      runtimeLimitSeconds: campaign.seedRuntimeLimitSeconds,
      campaignType: "campaign",
      projectId: campaign.projectId ?? null,
    });
  } catch (err) {
    console.error("[evolution-campaign-worker] ring leader spawn failed", {
      campaignId,
      nextExecutionId,
      err,
    });
    await markCampaignErrored(campaignId, "ring leader spawn failed");
    return;
  }
}

/**
 * Mark a campaign as errored and record stoppedAt. Non-throwing — we
 * swallow DB errors here because the caller is already in an error path.
 */
async function markCampaignErrored(
  campaignId: string,
  detail: string,
): Promise<void> {
  try {
    await db
      .update(evolutionCampaigns)
      .set({
        status: "halted_error",
        stoppedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(evolutionCampaigns.id, campaignId));
  } catch (err) {
    console.error(
      "[evolution-campaign-worker] failed to mark campaign errored",
      {
        campaignId,
        detail,
        err,
      },
    );
  }
}

/**
 * Start the Evolution Campaign worker. Same configuration shape as the
 * other workers in this service (see god-layer-worker.ts).
 */
export function startEvolutionCampaignWorker(): Worker<EvolutionCampaignJobData> {
  const worker = new Worker<EvolutionCampaignJobData>(
    EVOLUTION_CAMPAIGN_QUEUE_NAME,
    evolutionCampaignProcessor,
    {
      connection: workerConnection,
      concurrency: EVOLUTION_CAMPAIGN_CONCURRENCY,
      lockDuration: EVOLUTION_CAMPAIGN_LOCK_DURATION_MS,
      stalledInterval: 30_000,
      maxStalledCount: 1,
      limiter: { max: 30, duration: 60_000 },
    },
  );

  worker.on("error", (err) => {
    console.error("[evolution-campaign-worker] Error:", err);
  });

  worker.on("failed", (job, err) => {
    console.error("[evolution-campaign-worker] Job failed:", {
      jobId: job?.id,
      campaignId: job?.data?.campaignId,
      error: err.message,
    });
  });

  worker.on("completed", (job) => {
    console.log("[evolution-campaign-worker] Job completed:", {
      jobId: job.id,
      campaignId: job.data.campaignId,
    });
  });

  return worker;
}
