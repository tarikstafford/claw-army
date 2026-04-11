import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { db, councilVerdicts, bots, botSouls, agentClasses } from "@claw/db";
import { eq, and, isNull } from "drizzle-orm";
import { workerConnection } from "./task-queue";
import { GOD_LAYER_QUEUE_NAME, type GodLayerJobData } from "./god-layer-queue";
import {
  computeClassTransition,
  type ClassTransition,
} from "../god-layer/class-machine";
import { publishSoulLifecycleEvent } from "../events/publisher";
import { writeVersionedDnaEntry } from "../god-layer/dna-writer";
import { detectAndTrackPioneer } from "../god-layer/pioneer-tracker";
import { writeNegativeSignal } from "../god-layer/negative-register";
import { runEvolutionCampaignHook } from "../services/evolution-campaign-hook";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Lock duration for God Layer jobs. DB-heavy (transactions, multiple inserts),
 * but not LLM-heavy. 5 minutes provides ample buffer.
 */
const GOD_LAYER_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Max concurrent God Layer jobs. Lower than council (3 vs 5) because
 * jobs involve multiple DB writes inside a transaction.
 */
const GOD_LAYER_CONCURRENCY = 3;

/** Redis TTL for category soul library lock in seconds (GODL-07). */
const LOCK_TTL_SECONDS = 300;

/** Delay between lock acquisition retries in ms. */
const LOCK_RETRY_DELAY_MS = 500;

/** Max retries for acquiring the Redis category lock. */
const LOCK_MAX_RETRIES = 20;

// ──────────────────────────────────────────────────────────────────────────────
// Redis lock helpers
// ──────────────────────────────────────────────────────────────────────────────

const redis = new IORedis(process.env["REDIS_URL"] ?? "redis://localhost:6379");

/**
 * Acquire Redis lock for the soul library of a given category (GODL-07).
 * Uses SET EX NX for atomic acquire-or-fail semantics.
 * IORedis argument order: key, value, 'EX', seconds, 'NX'
 */
async function acquireCategoryLock(
  category: string,
  jobId: string,
): Promise<boolean> {
  const result = await redis.set(
    `soul-library:${category}`,
    jobId,
    "EX",
    LOCK_TTL_SECONDS,
    "NX",
  );
  return result === "OK";
}

/**
 * Release the Redis category lock using a Lua script for atomic
 * compare-and-delete — only deletes if the lock is still owned by this job.
 */
async function releaseCategoryLock(
  category: string,
  jobId: string,
): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `soul-library:${category}`, jobId);
}

/** Simple async sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────────────────────────────────────
// godLayerProcessor
// ──────────────────────────────────────────────────────────────────────────────

/**
 * BullMQ job processor for God Layer evaluation jobs.
 *
 * Flow:
 * 1. Idempotency claim via godLayerProcessedAt IS NULL (GODL-01)
 * 2. Load verdict, bot, and soul data from DB
 * 3. Acquire Redis category lock (GODL-07)
 * 4. Atomic DB transaction:
 *    a. Pioneer detection + benchmark tracking (GODL-06, CLAS-06)
 *    b. Compute class transition (CLAS-01 through CLAS-05)
 *    c. Update agent_classes row
 *    d. Write versioned DNA entry (GODL-02, GODL-03, GODL-04)
 *    e. Write negative signal if retire/demote (GODL-05)
 * 5. Post-transaction side effects (Artisan graduation log, pioneer log)
 * 6. Finally: release Redis locks
 */
async function godLayerProcessor(job: Job<GodLayerJobData>): Promise<void> {
  const { verdictId, executionId, botId, soulId, taskCategory } = job.data;

  // Step 0 — Lock renewal: keep the BullMQ job lock alive while DB operations run.
  const renewInterval = setInterval(() => {
    job.extendLock(job.token!, GOD_LAYER_LOCK_DURATION_MS).catch(() => {
      // Ignore token expiry errors — job may have already completed
    });
  }, 60_000);

  let lockAcquired = false;
  let lockRenewalInterval: ReturnType<typeof setInterval> | null = null;

  try {
    // Step 1 — Idempotency claim: atomically claim this verdict for God Layer processing.
    // If godLayerProcessedAt is already set, this verdict was already processed — skip.
    const claimed = await db
      .update(councilVerdicts)
      .set({ godLayerProcessedAt: new Date() })
      .where(
        and(
          eq(councilVerdicts.id, verdictId),
          isNull(councilVerdicts.godLayerProcessedAt),
        ),
      )
      .returning({ id: councilVerdicts.id });

    if (claimed.length === 0) {
      // Already processed (idempotency guard) — exit cleanly
      clearInterval(renewInterval);
      return;
    }

    // Step 2 — Load verdict data
    const [verdict] = await db
      .select({
        verdictType: councilVerdicts.verdictType,
        weightedConfidenceScore: councilVerdicts.weightedConfidenceScore,
        soulAnalystOutput: councilVerdicts.soulAnalystOutput,
        performanceJudgeOutput: councilVerdicts.performanceJudgeOutput,
        devilsAdvocateOutput: councilVerdicts.devilsAdvocateOutput,
        verdictSummary: councilVerdicts.verdictSummary,
        confirmedAt: councilVerdicts.confirmedAt,
        hasUnresolvedDevilsAdvocate:
          councilVerdicts.hasUnresolvedDevilsAdvocate,
        requiresHumanConfirmation: councilVerdicts.requiresHumanConfirmation,
        soulId: councilVerdicts.soulId,
      })
      .from(councilVerdicts)
      .where(eq(councilVerdicts.id, verdictId));

    if (!verdict) {
      throw new Error(`[god-layer] Verdict ${verdictId} not found after claim`);
    }

    // Load bot row
    const [bot] = await db
      .select({
        compositeScore: bots.compositeScore,
        soulId: bots.soulId,
      })
      .from(bots)
      .where(eq(bots.id, botId));

    if (!bot) {
      throw new Error(`[god-layer] Bot ${botId} not found`);
    }

    // Load soul row if soulId is present
    let soul: {
      soulContent: string;
      parentSoulId: string | null;
      taskCategory: string | null;
      constitutionDirectives: unknown;
      dimensions: unknown;
    } | null = null;

    const effectiveSoulId = soulId ?? verdict.soulId;

    if (effectiveSoulId) {
      const [soulRow] = await db
        .select({
          soulContent: botSouls.soulContent,
          parentSoulId: botSouls.parentSoulId,
          taskCategory: botSouls.taskCategory,
          constitutionDirectives: botSouls.constitutionDirectives,
          dimensions: botSouls.dimensions,
        })
        .from(botSouls)
        .where(eq(botSouls.id, effectiveSoulId));

      soul = soulRow ?? null;
    }

    // Resolve effective taskCategory (from job data or soul row)
    const effectiveCategory = taskCategory ?? soul?.taskCategory ?? null;

    // Step 3 — Acquire Redis category lock (GODL-07)
    // Lock prevents concurrent God Layer jobs from mutating the same soul library.
    if (effectiveCategory !== null) {
      for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
        lockAcquired = await acquireCategoryLock(effectiveCategory, job.id!);
        if (lockAcquired) break;
        await sleep(LOCK_RETRY_DELAY_MS);
      }

      if (!lockAcquired) {
        throw new Error(
          `[god-layer] Failed to acquire category lock for ${effectiveCategory} after ${LOCK_MAX_RETRIES} retries`,
        );
      }

      // Step 4 — Redis lock renewal: keep the category lock alive during DB operations
      lockRenewalInterval = setInterval(async () => {
        if (effectiveCategory !== null && lockAcquired) {
          await redis
            .set(
              `soul-library:${effectiveCategory}`,
              job.id!,
              "EX",
              LOCK_TTL_SECONDS,
              "XX",
            )
            .catch(() => {});
        }
      }, 60_000);
    }

    // Step 5 — Atomic DB transaction
    let artisanGraduated = false;
    let isPioneer = false;
    let transitionType: string = "none";
    let transition: ClassTransition = { type: "none" };
    let previousClass: "Novice" | "Understudy" | "Artisan" = "Novice";

    await db.transaction(async (tx) => {
      // 5a. Pioneer detection (GODL-06, CLAS-06)
      // Must run before class transition — needs baselineCompositeScore for isAboveBenchmark
      const pioneer = await detectAndTrackPioneer(tx, {
        taskCategory: effectiveCategory ?? "unknown",
        botId,
        soulId: effectiveSoulId ?? null,
        executionId,
        compositeScore: bot.compositeScore ?? "0",
      });

      isPioneer = pioneer.isPioneer;

      // 5b. Determine isAboveBenchmark
      const isAboveBenchmark =
        Number(bot.compositeScore ?? 0) >
        Number(pioneer.baselineCompositeScore);

      // 5c. Determine isSoulDriven from soulAnalystOutput
      const soulAnalystOutput = verdict.soulAnalystOutput as {
        isSoulDriven?: boolean;
        summary?: string;
        confidence?: number;
        directiveAttributionVerification?: Array<{
          directiveReferenced: string;
          counterfactualScore: number;
        }>;
        disagreementRate?: number;
        verdictType?: string;
      } | null;

      const isSoulDriven = soulAnalystOutput?.isSoulDriven ?? true;

      // 5d. Load or create agent class state for this bot+category
      const existingRows = await tx
        .select()
        .from(agentClasses)
        .where(
          and(
            eq(agentClasses.botId, botId),
            eq(agentClasses.taskCategory, effectiveCategory ?? "unknown"),
          ),
        );

      let existingRow = existingRows[0];

      if (!existingRow) {
        // Insert default Novice state
        await tx.insert(agentClasses).values({
          botId,
          taskCategory: effectiveCategory ?? "unknown",
          currentClass: "Novice",
          aboveBenchmarkCount: 0,
          belowBenchmarkCount: 0,
          humanConfirmationCount: 0,
          consecutiveBelowCount: 0,
          isPioneer: pioneer.isPioneer,
        });

        // Re-query the newly inserted row
        const [inserted] = await tx
          .select()
          .from(agentClasses)
          .where(
            and(
              eq(agentClasses.botId, botId),
              eq(agentClasses.taskCategory, effectiveCategory ?? "unknown"),
            ),
          );

        existingRow = inserted!;
      }

      const {
        currentClass,
        aboveBenchmarkCount,
        belowBenchmarkCount,
        humanConfirmationCount,
        consecutiveBelowCount,
      } = existingRow;

      // Hoist currentClass to outer scope for post-transaction retire event
      previousClass = currentClass as "Novice" | "Understudy" | "Artisan";

      // 5e. Compute class transition (CLAS-01 through CLAS-05)
      const {
        newState,
        transition: transitionResult,
        artisanGraduated: graduated,
      } = computeClassTransition(
        {
          currentClass,
          aboveBenchmarkCount,
          belowBenchmarkCount,
          humanConfirmationCount,
          consecutiveBelowCount,
        },
        {
          verdictType: verdict.verdictType,
          confidence: Number(verdict.weightedConfidenceScore),
          hasHumanConfirmation: verdict.confirmedAt !== null,
          isAboveBenchmark,
          isSoulDriven,
          hasUnresolvedDA: verdict.hasUnresolvedDevilsAdvocate,
          benchmarkMature: pioneer.benchmarkMature,
        },
      );

      artisanGraduated = graduated ?? false;
      transitionType = transitionResult.type;

      // Hoist transition to outer scope for post-transaction publish calls
      transition = transitionResult;

      // 5f. Update agent_classes row with newState + transition metadata
      await tx
        .update(agentClasses)
        .set({
          currentClass: newState.currentClass,
          aboveBenchmarkCount: newState.aboveBenchmarkCount,
          belowBenchmarkCount: newState.belowBenchmarkCount,
          humanConfirmationCount: newState.humanConfirmationCount,
          consecutiveBelowCount: newState.consecutiveBelowCount,
          isPioneer: pioneer.isPioneer || existingRow.isPioneer,
          lastVerdictId: verdictId,
          lastTransitionAt:
            transitionResult.type !== "none"
              ? new Date()
              : existingRow.lastTransitionAt,
          artisanGraduationAt: artisanGraduated
            ? new Date()
            : existingRow.artisanGraduationAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agentClasses.botId, botId),
            eq(agentClasses.taskCategory, effectiveCategory ?? "unknown"),
          ),
        );

      // 5g. Versioned DNA write (GODL-02, GODL-03, GODL-04)
      // Build the full DnaPayload from verdict and soul context
      if (effectiveSoulId && effectiveCategory) {
        const performanceJudgeOutput = verdict.performanceJudgeOutput as {
          confidence?: number;
          verdictType?: string;
          summary?: string;
          fitnessDimensions?: Record<string, number>;
        } | null;

        const devilsAdvocateOutput = verdict.devilsAdvocateOutput as {
          confidence?: number;
          verdictType?: string;
          summary?: string;
        } | null;

        await writeVersionedDnaEntry(tx, {
          botId,
          executionId,
          soulId: effectiveSoulId,
          taskCategory: effectiveCategory,
          compositeScore: bot.compositeScore ?? "0",
          agentClass: newState.currentClass,
          soulContent: soul?.soulContent ?? "",
          parentSoulIds: soul?.parentSoulId ? [soul.parentSoulId] : null,
          mutationLineage:
            (soul?.dimensions as Record<string, unknown>)?.mutationOps ?? null,
          weightedConfidenceScore: Number(verdict.weightedConfidenceScore),
          dnaPayload: {
            // Required base fields — defaults for fields not available from verdict context
            systemPromptTemplate: soul?.soulContent ?? "",
            toolCallSequence: [],
            argumentPatterns: {},
            retryStrategy: {},
            timingProfile: {},
            tokenDistribution: {},
            // GODL-02 extension fields
            soulContent: soul?.soulContent ?? "",
            taskCategory: effectiveCategory,
            agentClassAtWrite: newState.currentClass,
            compositeFitnessScore: Number(bot.compositeScore ?? 0),
            fitnessDimensionBreakdown:
              performanceJudgeOutput?.fitnessDimensions ?? {},
            causalAttributionSummary: soulAnalystOutput?.summary ?? "",
            councilVerdictSummary: verdict.verdictSummary,
            councilConfidenceScores: {
              performance: performanceJudgeOutput?.confidence ?? 0,
              soulAnalyst: soulAnalystOutput?.confidence ?? 0,
              devilsAdvocate: devilsAdvocateOutput?.confidence ?? 0,
              weighted: Number(verdict.weightedConfidenceScore),
            },
            humanConfirmationTimestamp: verdict.confirmedAt
              ? verdict.confirmedAt.toISOString()
              : null,
            mutationLineageOps:
              ((soul?.dimensions as Record<string, unknown>)
                ?.mutationOps as string[]) ?? [],
            isPioneerEntry: pioneer.isPioneer,
          },
        });
      }

      // 5h. Negative signal write (GODL-05)
      // Write when retiring a soul-driven bot, or demoting a soul-driven bot
      if (
        effectiveSoulId &&
        (transitionResult.type === "retire" ||
          (transitionResult.type === "demote" && isSoulDriven))
      ) {
        const failedDirectives = (
          soulAnalystOutput?.directiveAttributionVerification ?? []
        )
          .filter(
            (v: { counterfactualScore: number }) => v.counterfactualScore < 0.3,
          )
          .map((v: { directiveReferenced: string }) => v.directiveReferenced);

        await writeNegativeSignal(tx, {
          soulId: effectiveSoulId,
          botId,
          executionId,
          failureType:
            transitionResult.type === "retire" ? "retirement" : "demotion",
          soulAnalystSummary: soulAnalystOutput?.summary ?? "",
          failedDirectives,
          parentSoulId: soul?.parentSoulId ?? null,
          mutationOpsApplied:
            ((soul?.dimensions as Record<string, unknown>)
              ?.mutationOps as string[]) ?? [],
        });
      }
    });

    // Step 6 — Post-transaction side effects
    if (artisanGraduated) {
      console.log("[god-layer] Artisan graduation:", {
        botId,
        category: effectiveCategory,
      });
      publishSoulLifecycleEvent({
        type: "soul_promoted",
        botId,
        executionId,
        taskCategory: effectiveCategory!,
        fromClass: "Understudy",
        toClass: "Artisan",
        description: `Agent ${botId.slice(0, 8)} has been promoted to Artisan in ${effectiveCategory} tasks`,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        console.error("[god-layer] Failed to publish promotion event:", err),
      );
    }

    if (isPioneer) {
      console.log("[god-layer] Pioneer event:", {
        botId,
        category: effectiveCategory,
      });
      publishSoulLifecycleEvent({
        type: "pioneer_detected",
        botId,
        executionId,
        taskCategory: effectiveCategory!,
        description: `Agent ${botId.slice(0, 8)} is a pioneer — first confirmed run in ${effectiveCategory} tasks`,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        console.error("[god-layer] Failed to publish pioneer event:", err),
      );
    }

    console.log("[god-layer] Class transition complete:", {
      verdictId,
      botId,
      category: effectiveCategory,
      transition: transitionType,
    });

    // Publish lifecycle events for all transition types
    // Cast to ClassTransition to restore discriminated union narrowing after async closure mutation
    const resolvedTransition = transition as ClassTransition;
    if (resolvedTransition.type === "promote" && !artisanGraduated) {
      publishSoulLifecycleEvent({
        type: "soul_promoted",
        botId,
        executionId,
        taskCategory: effectiveCategory!,
        fromClass: "Novice",
        toClass: "Understudy",
        description: `Agent ${botId.slice(0, 8)} has been promoted to Understudy in ${effectiveCategory} tasks`,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        console.error("[god-layer] Failed to publish promotion event:", err),
      );
    } else if (resolvedTransition.type === "demote") {
      publishSoulLifecycleEvent({
        type: "soul_demoted",
        botId,
        executionId,
        taskCategory: effectiveCategory!,
        fromClass: resolvedTransition.from,
        toClass: resolvedTransition.to,
        description: `Agent ${botId.slice(0, 8)} has been demoted from ${resolvedTransition.from} to ${resolvedTransition.to} in ${effectiveCategory} tasks`,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        console.error("[god-layer] Failed to publish demotion event:", err),
      );
    } else if (resolvedTransition.type === "retire") {
      publishSoulLifecycleEvent({
        type: "soul_retired",
        botId,
        executionId,
        taskCategory: effectiveCategory!,
        fromClass: previousClass,
        description: `Agent ${botId.slice(0, 8)} has been retired from ${effectiveCategory} tasks`,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        console.error("[god-layer] Failed to publish retirement event:", err),
      );
    }

    // Step 6.5 — Evolution campaign hook (Karpathy Loop, issue #74)
    // If this verdict's execution is part of an evolution campaign AND this
    // was the last verdict to finish god-layer processing, compute the EFS,
    // update the iteration row, evaluate halt criteria, and either enqueue
    // the next iteration or stop the campaign. Non-throwing — any failure
    // is logged inside the hook so god-layer job success is preserved.
    await runEvolutionCampaignHook(executionId);
  } finally {
    // Step 7 — Cleanup: clear intervals and release Redis locks
    if (lockRenewalInterval !== null) {
      clearInterval(lockRenewalInterval);
    }
    clearInterval(renewInterval);

    if (lockAcquired && taskCategory !== null) {
      await releaseCategoryLock(taskCategory, job.id!).catch((err) => {
        console.error("[god-layer] Failed to release category lock:", err);
      });
    } else if (lockAcquired) {
      // Try to release with effective category derived from data
      const effectiveCategory = taskCategory;
      if (effectiveCategory !== null) {
        await releaseCategoryLock(effectiveCategory, job.id!).catch((err) => {
          console.error("[god-layer] Failed to release category lock:", err);
        });
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// startGodLayerWorker
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start the God Layer Worker — a BullMQ Worker that pulls confirmed verdict jobs
 * from the soul-verdicts queue and executes class transitions, DNA library writes,
 * pioneer tracking, and negative signal preservation inside an atomic DB transaction.
 *
 * Configuration:
 * - concurrency: 3 (DB-heavy, not LLM-heavy — lower than council)
 * - lockDuration: 5min
 * - limiter: max 20 jobs/minute
 * - stalledInterval: 30s / maxStalledCount: 1
 */
export function startGodLayerWorker(): Worker<GodLayerJobData> {
  const worker = new Worker<GodLayerJobData>(
    GOD_LAYER_QUEUE_NAME,
    godLayerProcessor,
    {
      connection: workerConnection,
      concurrency: GOD_LAYER_CONCURRENCY,
      lockDuration: GOD_LAYER_LOCK_DURATION_MS,
      stalledInterval: 30_000,
      maxStalledCount: 1,
      limiter: { max: 20, duration: 60_000 },
    },
  );

  worker.on("error", (err) => {
    console.error("[god-layer] Error:", err);
  });

  worker.on("failed", (job, err) => {
    console.error("[god-layer] Job failed:", {
      jobId: job?.id,
      verdictId: job?.data?.verdictId,
      error: err.message,
    });
  });

  worker.on("completed", (job) => {
    console.log("[god-layer] Job completed:", {
      jobId: job.id,
      verdictId: job.data.verdictId,
    });
  });

  console.log("[god-layer] Started (concurrency=3, rate-limit=20/min)");
  return worker;
}
