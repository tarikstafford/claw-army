import {
  db,
  executions,
  executionStatusEnum,
  objectives,
  evolutionCampaigns,
  evolutionCampaignIterations,
} from "@claw/db";
import { eq, and } from "drizzle-orm";
import IORedis from "ioredis";

type ExecutionStatus = (typeof executionStatusEnum.enumValues)[number];

/**
 * Module-level Redis singleton for budget cap key initialization.
 * Uses queuing (default enableOfflineQueue: true) — execution creation is write-path
 * and should queue if Redis is temporarily slow rather than fail fast.
 */
const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379");

export interface CreateExecutionInput {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
  llmProvider?: string;
  allowedDomains?: string[];
  objectiveId?: string;
  campaignType?: string;
  projectId?: string;
  /**
   * If set, the created execution is linked to an existing evolution campaign.
   * Used by the evolution-campaign-worker when auto-spawning iteration N+1.
   * The route handler does NOT set this directly — it goes through
   * {@link createExecutionWithOptionalCampaign} instead.
   */
  evolutionCampaignId?: string;
}

export async function createExecution(
  input: CreateExecutionInput,
): Promise<{ executionId: string; status: "pre_flight" }> {
  if (input.objectiveId) {
    const [objective] = await db
      .select({ id: objectives.id })
      .from(objectives)
      .where(
        and(
          eq(objectives.id, input.objectiveId),
          eq(objectives.isArchived, false),
        ),
      );
    if (!objective) {
      throw new Error("Objective not found or archived");
    }
  }

  const result = await db
    .insert(executions)
    .values({
      objective: input.objective,
      maxBots: input.maxBots,
      budgetCapCents: input.budgetCapCents,
      runtimeLimitSeconds: input.runtimeLimitSeconds,
      allowedTools: input.allowedTools,
      llmProvider: input.llmProvider ?? null,
      allowedDomains: input.allowedDomains ?? null,
      objectiveId: input.objectiveId ?? null,
      campaignType: input.campaignType ?? null,
      projectId: input.projectId ?? null,
      evolutionCampaignId: input.evolutionCampaignId ?? null,
      status: "pre_flight",
    })
    .returning({ id: executions.id });

  if (result.length === 0 || !result[0]) {
    throw new Error("Failed to create execution: no row returned");
  }

  const executionId = result[0].id;

  // Initialize Redis budget cap keys for atomic enforcement (GARD-01).
  // The Billing Engine (04-03) uses a Lua script that reads budget:cap atomically.
  // TTL = runtimeLimitSeconds + 24h buffer — ensures keys outlive the execution.
  // Non-fatal: failure is logged but does NOT prevent execution creation.
  // The billing engine handles missing keys gracefully (no cap = allow all spending).
  try {
    const ttlSeconds = input.runtimeLimitSeconds + 86400;

    // Budget cap ceiling — the maximum spend allowed for this execution
    await redis.setex(
      `budget:cap:${executionId}`,
      ttlSeconds,
      input.budgetCapCents.toString(),
    );

    // Spend accumulator — initialized to 0; INCRBY increments atomically in the Lua script.
    // Explicit SET ensures the key exists for monitoring even before any spend occurs.
    await redis.setex(`budget:spend:${executionId}`, ttlSeconds, "0");
  } catch (err) {
    console.error(
      "[execution.service] Failed to initialize budget cap in Redis (non-fatal):",
      err,
    );
  }

  return { executionId, status: "pre_flight" };
}

export async function getExecution(id: string) {
  const result = await db
    .select()
    .from(executions)
    .where(eq(executions.id, id));

  if (result.length === 0) {
    return null;
  }

  return result[0] ?? null;
}

/**
 * Atomic state transition using UPDATE...WHERE...RETURNING.
 * Returns true if transition succeeded (row was in expected fromStatus).
 * Returns false if the row was not in the expected state (race condition or invalid transition).
 */
// ──────────────────────────────────────────────────────────────────────────────
// Evolution campaigns (Karpathy Loop, issue #74)
// ──────────────────────────────────────────────────────────────────────────────

/** Max number of iterations allowed in a single campaign. Mirrored in the
 *  Fastify schema on POST /executions to give clean validation errors. */
export const EVOLUTION_MAX_ITERATIONS_CEILING = 10;

export interface StartEvolutionCampaignInput {
  objective: string;
  maxBots: number;
  budgetCapCents: number;
  runtimeLimitSeconds: number;
  allowedTools: string[];
  llmProvider?: string;
  allowedDomains?: string[];
  projectId?: string;
  /** Max iterations; clamped to [1, EVOLUTION_MAX_ITERATIONS_CEILING]. */
  maxIterations: number;
  /** Optional cumulative budget across all iterations. */
  campaignBudgetCapCents?: number;
}

export interface StartEvolutionCampaignResult {
  campaignId: string;
  executionId: string;
  iterationId: string;
}

/**
 * Opt-in path: create an evolution campaign, create its first execution,
 * and seed iteration 1 — all in one call. Used by POST /executions when
 * the request body has enableEvolution=true.
 *
 * This does NOT spawn the Ring Leader — the caller is responsible for that
 * (to keep the 201-first response pattern in the route intact).
 */
export async function startEvolutionCampaign(
  input: StartEvolutionCampaignInput,
): Promise<StartEvolutionCampaignResult> {
  const clampedMaxIterations = Math.max(
    1,
    Math.min(EVOLUTION_MAX_ITERATIONS_CEILING, Math.floor(input.maxIterations)),
  );

  const [campaign] = await db
    .insert(evolutionCampaigns)
    .values({
      objective: input.objective,
      projectId: input.projectId ?? null,
      maxIterations: clampedMaxIterations,
      campaignBudgetCapCents: input.campaignBudgetCapCents ?? null,
      seedMaxBots: input.maxBots,
      seedBudgetCapCents: input.budgetCapCents,
      seedRuntimeLimitSeconds: input.runtimeLimitSeconds,
      seedAllowedTools: input.allowedTools,
      seedLlmProvider: input.llmProvider ?? null,
      seedAllowedDomains: input.allowedDomains ?? null,
      status: "running",
    })
    .returning({ id: evolutionCampaigns.id });

  if (!campaign) {
    throw new Error("startEvolutionCampaign: campaign insert returned no row");
  }

  // Create the first execution linked to this campaign
  const { executionId } = await createExecution({
    objective: input.objective,
    maxBots: input.maxBots,
    budgetCapCents: input.budgetCapCents,
    runtimeLimitSeconds: input.runtimeLimitSeconds,
    allowedTools: input.allowedTools,
    llmProvider: input.llmProvider,
    allowedDomains: input.allowedDomains,
    projectId: input.projectId,
    campaignType: "campaign",
    evolutionCampaignId: campaign.id,
  });

  // Seed iteration 1 — EFS fields stay null until god-layer-worker computes them
  const [iteration] = await db
    .insert(evolutionCampaignIterations)
    .values({
      campaignId: campaign.id,
      iterationNum: 1,
      executionId,
    })
    .returning({ id: evolutionCampaignIterations.id });

  if (!iteration) {
    throw new Error("startEvolutionCampaign: iteration insert returned no row");
  }

  return {
    campaignId: campaign.id,
    executionId,
    iterationId: iteration.id,
  };
}

export async function transitionExecution(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
): Promise<boolean> {
  const result = await db
    .update(executions)
    .set({ status: toStatus, updatedAt: new Date() })
    .where(
      and(eq(executions.id, executionId), eq(executions.status, fromStatus)),
    )
    .returning({ id: executions.id });

  return result.length === 1;
}
