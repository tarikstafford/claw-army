import type { CoordinationContext, CoordinationModule } from './coordination-loop';
import { logCoordinationEvent } from './coordination-events';
import type { BudgetDegradationTier } from '@claw/shared-types';
import { BUDGET_HARD_STOP_THRESHOLD } from '@claw/shared-types';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Minimum elapsed seconds before budget projection is meaningful */
const MIN_ELAPSED_SECONDS_FOR_PROJECTION = 10;

/** Tier change debounce period — no more than one tier change per 60 seconds */
const TIER_CHANGE_DEBOUNCE_SECONDS = 60;

/** Consumed percent thresholds for each degradation tier */
const TIER_THRESHOLDS = {
  hard_stop: BUDGET_HARD_STOP_THRESHOLD, // 0.95
  wrap_up: 0.85,
  consolidate: 0.70,
  deprioritize: 0.55,
} as const;

/** Projected overrun percent threshold for early 'deprioritize' warning */
const PROJECTED_OVERRUN_EARLY_WARNING_THRESHOLD = 0.20;

// ─── Per-run module state ──────────────────────────────────────────────────────

interface BudgetModuleState {
  currentTier: BudgetDegradationTier;
  lastTierChangeAt: number;  // epoch ms
}

/**
 * Module-level state map keyed by runId.
 * Tracks current tier and debounce timestamp per run.
 */
const runStateMap = new Map<string, BudgetModuleState>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine the degradation tier from the consumed percentage alone.
 */
function tierFromConsumedPercent(consumedPercent: number): BudgetDegradationTier {
  if (consumedPercent >= TIER_THRESHOLDS.hard_stop) return 'hard_stop';
  if (consumedPercent >= TIER_THRESHOLDS.wrap_up) return 'wrap_up';
  if (consumedPercent >= TIER_THRESHOLDS.consolidate) return 'consolidate';
  if (consumedPercent >= TIER_THRESHOLDS.deprioritize) return 'deprioritize';
  return 'normal';
}

/**
 * Format a percent value as a human-readable string, e.g. 0.427 -> "42.7%".
 */
function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create the budget projection and tiered degradation coordination module (COORD-08).
 *
 * On each poll cycle the module:
 *   1. Projects budget consumption to run end based on current burn rate
 *   2. Determines the appropriate degradation tier from consumed percent (and projection)
 *   3. Logs a BudgetDegradationEvent when the tier changes (debounced to max one per 60s)
 *   4. Appends anomaly strings to ctx.runState.anomalies for hard-stop enforcement
 *
 * @returns CoordinationModule with name 'budget-degradation'
 */
export function createBudgetDegradation(): CoordinationModule {
  return {
    name: 'budget-degradation',

    async execute(ctx: CoordinationContext): Promise<void> {
      const { runId, executionId, missionBrief, runState } = ctx;

      // Ensure per-run state is initialised
      if (!runStateMap.has(runId)) {
        runStateMap.set(runId, {
          currentTier: 'normal',
          lastTierChangeAt: 0,
        });
      }

      // Non-null assertion safe — we just set it above
      const moduleState = runStateMap.get(runId)!;

      // ── A. Project budget consumption to run end ───────────────────────────

      const elapsedSeconds = runState.elapsedTimeSeconds;
      const runtimeLimitSeconds = missionBrief.runtimeLimitSeconds;
      const budgetConsumed = runState.budgetConsumedCents;
      const budgetCap = missionBrief.budgetCapCents;

      // Skip projection when there is insufficient data
      if (elapsedSeconds < MIN_ELAPSED_SECONDS_FOR_PROJECTION || budgetConsumed === 0) {
        return;
      }

      if (budgetCap === 0) {
        // No cap configured — budget degradation has no effect
        return;
      }

      const burnRate = budgetConsumed / elapsedSeconds;           // cents/second
      const projectedTotalCents = burnRate * runtimeLimitSeconds;
      const consumedPercent = budgetConsumed / budgetCap;
      const projectedOverrunPercent =
        projectedTotalCents > budgetCap
          ? (projectedTotalCents - budgetCap) / budgetCap
          : null;

      // ── B. Determine degradation tier ─────────────────────────────────────

      let newTier: BudgetDegradationTier = tierFromConsumedPercent(consumedPercent);

      // Early warning: if projection shows significant overrun and we're still at normal
      if (
        projectedOverrunPercent !== null &&
        projectedOverrunPercent > PROJECTED_OVERRUN_EARLY_WARNING_THRESHOLD &&
        newTier === 'normal'
      ) {
        newTier = 'deprioritize';
      }

      // ── C. Apply tier transition ───────────────────────────────────────────

      const { currentTier, lastTierChangeAt } = moduleState;

      if (newTier !== currentTier) {
        const nowSeconds = Date.now() / 1000;
        const secondsSinceLastChange = nowSeconds - lastTierChangeAt / 1000;

        if (secondsSinceLastChange >= TIER_CHANGE_DEBOUNCE_SECONDS || lastTierChangeAt === 0) {
          // Build human-readable description
          const projectedOverrunStr =
            projectedOverrunPercent !== null
              ? ` Projected overrun: ${fmtPercent(projectedOverrunPercent)}.`
              : '';

          const description =
            `Budget degradation: ${currentTier} -> ${newTier}. ` +
            `Consumed ${fmtPercent(consumedPercent)} of ${budgetCap}c.` +
            projectedOverrunStr;

          // Log the event
          await logCoordinationEvent(runId, executionId, {
            type: 'budget_degradation',
            runId,
            executionId,
            previousTier: currentTier,
            newTier,
            budgetConsumedPercent: consumedPercent,
            projectedOverrunPercent,
            description,
            timestamp: new Date().toISOString(),
          });

          // Append anomaly for tiers above normal
          if (newTier !== 'normal') {
            runState.anomalies.push(`Budget tier: ${newTier}`);
          }

          // Update module state
          moduleState.currentTier = newTier;
          moduleState.lastTierChangeAt = Date.now();
        }
      }

      // ── D. Hard stop enforcement ───────────────────────────────────────────

      if (moduleState.currentTier === 'hard_stop') {
        runState.anomalies.push(
          'HARD STOP: Budget at 95%+ cap — coordination loop will terminate',
        );
      }
    },
  };
}
