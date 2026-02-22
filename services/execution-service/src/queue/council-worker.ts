import { Worker, type Job } from 'bullmq';
import { db, bots, botSouls, decisionTraces, councilVerdicts, telemetry } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { workerConnection } from './task-queue';
import { COUNCIL_QUEUE_NAME, type CouncilJobData, type CouncilContext } from './council-queue';
import { runPerformanceJudge, type PerformanceJudgeOutput } from '../council/performance-judge';
import { runSoulAnalyst, type SoulAnalystOutput } from '../council/soul-analyst';
import { runDevilsAdvocate, type DevilsAdvocateOutput } from '../council/devils-advocate';
import { godLayerQueue } from './god-layer-queue';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Lock duration for council jobs. LLM calls for 3 judges take 30-90s each,
 * running in parallel. 5 minutes provides ample buffer.
 */
const COUNCIL_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const COUNCIL_STALLED_INTERVAL_MS = 30_000;
const COUNCIL_MAX_STALLED_COUNT = 1;

/**
 * Max concurrent council jobs. Council jobs are LLM-heavy — cap at 5
 * to avoid overwhelming LLM provider rate limits (CNCL-01).
 */
const COUNCIL_CONCURRENCY = 5;

// Verdict type numeric values for weighted average resolution
const VERDICT_VALUES: Record<string, number> = {
  Promote: 4,
  Maintain: 3,
  Monitor: 2,
  Demote: 1,
  Retire: 0,
};
const VERDICT_FROM_VALUE = ['Retire', 'Demote', 'Monitor', 'Maintain', 'Promote'] as const;

// ──────────────────────────────────────────────────────────────────────────────
// loadCouncilContext
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Load all context required for the three council judges from the database.
 * Assembles bot metrics, soul content (if present), decision traces, and
 * telemetry for the given execution+bot combination.
 */
async function loadCouncilContext(
  executionId: string,
  botId: string,
  soulId: string | null,
): Promise<CouncilContext> {
  // Query bot metrics
  const botRows = await db
    .select({
      tasksClaimed: bots.tasksClaimed,
      tasksCompleted: bots.tasksCompleted,
      tasksFailed: bots.tasksFailed,
      compositeScore: bots.compositeScore,
      tier: bots.tier,
    })
    .from(bots)
    .where(eq(bots.id, botId));

  if (botRows.length === 0) {
    throw new Error(`Bot ${botId} not found`);
  }

  const botRow = botRows[0]!;

  // Query soul content if soulId is present
  let soulContent: string | null = null;
  let constitutionDirectives: string[] = [];
  let taskCategory: string | null = null;

  if (soulId !== null) {
    const soulRows = await db
      .select({
        soulContent: botSouls.soulContent,
        constitutionDirectives: botSouls.constitutionDirectives,
        taskCategory: botSouls.taskCategory,
      })
      .from(botSouls)
      .where(eq(botSouls.id, soulId));

    if (soulRows.length > 0) {
      const soul = soulRows[0]!;
      soulContent = soul.soulContent;
      // constitutionDirectives is stored as JSONB array of strings
      constitutionDirectives = Array.isArray(soul.constitutionDirectives)
        ? (soul.constitutionDirectives as string[])
        : [];
      taskCategory = soul.taskCategory ?? null;
    }
  }

  // Query decision traces for this execution+bot
  const traceRows = await db
    .select({
      decisionId: decisionTraces.decisionId,
      decisionType: decisionTraces.decisionType,
      directiveReferenced: decisionTraces.directiveReferenced,
      attributionConfidence: decisionTraces.attributionConfidence,
      outcome: decisionTraces.outcome,
      metadata: decisionTraces.metadata,
    })
    .from(decisionTraces)
    .where(
      and(
        eq(decisionTraces.executionId, executionId),
        eq(decisionTraces.botId, botId),
      ),
    );

  // Query telemetry for this execution+bot
  const telemetryRows = await db
    .select({
      metricName: telemetry.metricName,
      metricValue: telemetry.metricValue,
    })
    .from(telemetry)
    .where(
      and(
        eq(telemetry.executionId, executionId),
        eq(telemetry.botId, botId),
      ),
    );

  return {
    executionId,
    botId,
    soulId,
    soulContent,
    constitutionDirectives,
    taskCategory,
    botMetrics: {
      tasksClaimed: botRow.tasksClaimed,
      tasksCompleted: botRow.tasksCompleted,
      tasksFailed: botRow.tasksFailed,
      compositeScore: botRow.compositeScore ?? null,
      tier: botRow.tier ?? null,
    },
    decisionTraces: traceRows.map((t) => ({
      decisionId: t.decisionId,
      decisionType: t.decisionType,
      directiveReferenced: t.directiveReferenced ?? null,
      attributionConfidence: t.attributionConfidence ?? null,
      outcome: t.outcome ?? null,
      metadata: t.metadata,
    })),
    telemetryMetrics: telemetryRows.map((t) => ({
      metricName: t.metricName,
      metricValue: t.metricValue,
    })),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// aggregateVerdicts
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate outputs from all three judges using fixed weights (CNCL-05):
 * - Performance Judge: 50%
 * - Soul Analyst: 35%
 * - Devil's Advocate: 15%
 *
 * Verdict type is computed as a weighted numeric average of the three verdicts,
 * rounded to the nearest integer and mapped back to a verdict string.
 * Strong unresolved Devil's Advocate arguments escalate to human confirmation.
 */
function aggregateVerdicts(
  perf: PerformanceJudgeOutput,
  soul: SoulAnalystOutput,
  devil: DevilsAdvocateOutput,
): {
  verdictType: 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';
  weightedConfidenceScore: number;
  requiresHumanConfirmation: boolean;
  hasUnresolvedDevilsAdvocate: boolean;
  verdictSummary: string;
} {
  // Weighted confidence score (CNCL-05)
  const weightedConfidenceScore =
    perf.confidence * 0.5 + soul.confidence * 0.35 + devil.confidence * 0.15;

  // Weighted verdict type — convert to numeric, compute weighted average, clamp, map back
  const perfVal = VERDICT_VALUES[perf.verdictType] ?? 2;
  const soulVal = VERDICT_VALUES[soul.verdictType] ?? 2;
  const devilVal = VERDICT_VALUES[devil.verdictType] ?? 2;

  const weightedVerdictValue = perfVal * 0.5 + soulVal * 0.35 + devilVal * 0.15;
  const rounded = Math.max(0, Math.min(4, Math.round(weightedVerdictValue)));
  const verdictType = VERDICT_FROM_VALUE[rounded] ?? 'Monitor';

  // Devil's Advocate escalation (CNCL-05)
  const hasUnresolvedDevilsAdvocate = devil.strongUnresolvedArgument;
  const requiresHumanConfirmation = hasUnresolvedDevilsAdvocate;

  // Build combined verdict summary
  const verdictSummary = `Performance Judge: ${perf.summary}\n\nSoul Analyst: ${soul.summary}\n\nDevil's Advocate: ${devil.summary}`;

  return {
    verdictType,
    weightedConfidenceScore,
    requiresHumanConfirmation,
    hasUnresolvedDevilsAdvocate,
    verdictSummary,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// councilProcessor
// ──────────────────────────────────────────────────────────────────────────────

/**
 * BullMQ job processor for council evaluation jobs.
 *
 * Flow:
 * 1. Load CouncilContext from DB (bot metrics, soul, traces, telemetry)
 * 2. Run all three judges in parallel (CNCL-02 — judges never see each other's output)
 * 3. Aggregate with 50/35/15 weights (CNCL-05)
 * 4. Persist verdict to council_verdicts (CNCL-06)
 * 5. Log disagreement rate health metric (CNCL-04)
 */
async function councilProcessor(job: Job<CouncilJobData>): Promise<void> {
  const { executionId, botId, soulId } = job.data;

  // Keep the job lock alive while LLM calls run (mirror openclaw-dispatcher pattern).
  // Council jobs take 30-90s for 3 parallel LLM calls — renew every 60s.
  const renewInterval = setInterval(() => {
    job.extendLock(job.token!, COUNCIL_LOCK_DURATION_MS).catch(() => {
      // Ignore token expiry errors — job may have already completed
    });
  }, 60_000);

  try {
    // Step 1: Load context from DB
    const context = await loadCouncilContext(executionId, botId, soulId);

    // Step 2: Run all three judges in parallel (CNCL-02)
    // No judge sees another's output before aggregation.
    const [performanceOutput, soulOutput, devilOutput] = await Promise.all([
      runPerformanceJudge(context),
      runSoulAnalyst(context),
      runDevilsAdvocate(context),
    ]);

    // Step 3: Aggregate verdicts with fixed weights
    const verdict = aggregateVerdicts(performanceOutput, soulOutput, devilOutput);

    // Step 4: Persist to council_verdicts (CNCL-06)
    const [insertedVerdict] = await db.insert(councilVerdicts).values({
      executionId,
      botId,
      soulId,
      verdictType: verdict.verdictType,
      status: 'pending',
      weightedConfidenceScore: verdict.weightedConfidenceScore.toFixed(3),
      requiresHumanConfirmation: verdict.requiresHumanConfirmation,
      hasUnresolvedDevilsAdvocate: verdict.hasUnresolvedDevilsAdvocate,
      verdictSummary: verdict.verdictSummary,
      performanceJudgeOutput: performanceOutput,
      soulAnalystOutput: soulOutput,
      devilsAdvocateOutput: devilOutput,
    }).returning({ id: councilVerdicts.id });

    // Step 5: Log verdict and health metrics
    console.log('[council-worker] Verdict persisted:', {
      executionId,
      botId,
      verdictType: verdict.verdictType,
      confidence: verdict.weightedConfidenceScore.toFixed(3),
      requiresHumanConfirmation: verdict.requiresHumanConfirmation,
    });

    // CNCL-04: Log Soul Analyst counterfactual disagreement rate per job
    console.log('[council-worker] Soul Analyst counterfactual disagreement rate:', {
      executionId,
      botId,
      disagreementRate: (soulOutput.disagreementRate ?? 0).toFixed(3),
    });

    // Phase 13: Auto-execute God Layer for verdicts that do NOT require human confirmation.
    // Promote/Retire with requiresHumanConfirmation=true are handled by the confirm route.
    if (!verdict.requiresHumanConfirmation) {
      godLayerQueue.add('process-verdict', {
        verdictId: insertedVerdict!.id,
        executionId,
        botId,
        soulId,
        taskCategory: context.taskCategory,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }).catch((err) => {
        console.error('[council-worker] God Layer enqueue failed (non-fatal):', err);
      });
    }
  } finally {
    clearInterval(renewInterval);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// startCouncilWorker
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Start the Council Worker — a BullMQ Worker that pulls council evaluation jobs
 * from the council-queue and runs three LLM judges in parallel per bot.
 *
 * Configuration:
 * - concurrency: 5 (CNCL-01: async, non-blocking, isolated)
 * - lockDuration: 5min (covers parallel LLM call duration)
 * - limiter: max 10 jobs/minute (CNCL-01: rate limit to protect LLM providers)
 * - stalledInterval: 30s / maxStalledCount: 1 (aggressive stall detection for LLM timeouts)
 */
export function startCouncilWorker(): Worker<CouncilJobData> {
  const worker = new Worker<CouncilJobData>(COUNCIL_QUEUE_NAME, councilProcessor, {
    connection: workerConnection,
    concurrency: COUNCIL_CONCURRENCY,
    lockDuration: COUNCIL_LOCK_DURATION_MS,
    stalledInterval: COUNCIL_STALLED_INTERVAL_MS,
    maxStalledCount: COUNCIL_MAX_STALLED_COUNT,
    limiter: { max: 10, duration: 60_000 },
  });

  worker.on('error', (err) => {
    console.error('[council-worker] Error:', err);
  });

  worker.on('failed', (job, err) => {
    console.error('[council-worker] Job failed:', {
      jobId: job?.id,
      botId: job?.data?.botId,
      error: err.message,
    });
  });

  worker.on('completed', (job) => {
    console.log('[council-worker] Job completed:', {
      jobId: job.id,
      botId: job.data.botId,
    });
  });

  console.log('[council-worker] Started (concurrency=5, rate-limit=10/min)');
  return worker;
}
