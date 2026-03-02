import { type PopulationManifest, MIN_AGENTS_PER_TASK } from '@claw/shared-types';

// ─── Cost constants ───────────────────────────────────────────────────────────

export const AGENT_COST_CENTS: Record<'Artisan' | 'Understudy' | 'Novice', number> = {
  Artisan: 100,
  Understudy: 50,
  Novice: 30,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetValidationResult {
  funded: boolean;
  manifests: PopulationManifest[];
  warnings: string[];
  estimatedCostCents: number;
  shortfallCents?: number;          // only when funded=false
  minimumRequiredCents?: number;    // only when funded=false
}

// ─── estimatePopulationCost ───────────────────────────────────────────────────

/**
 * Estimate the total cost of all souls across all population manifests.
 *
 * @param manifests - Array of PopulationManifest objects
 * @returns Total cost in cents
 */
export function estimatePopulationCost(manifests: PopulationManifest[]): number {
  let total = 0;
  for (const manifest of manifests) {
    for (const soul of manifest.assignedSouls) {
      total += AGENT_COST_CENTS[soul.agentClass];
    }
  }
  return total;
}

// ─── applyTieredReduction ─────────────────────────────────────────────────────

/**
 * Apply tiered cost reduction to bring manifests within the budget cap.
 *
 * Tier 1 — Artisan replacement: replace every Artisan with an Understudy soul entry.
 * Tier 2 — Population reduction: truncate each task's souls to MIN_AGENTS_PER_TASK (3).
 *
 * IMPORTANT: No task is ever reduced below MIN_AGENTS_PER_TASK agents (BUDG-03).
 *
 * @param manifests       - Original population manifests
 * @param budgetCapCents  - Budget ceiling in cents
 * @returns Reduced manifests + warning strings describing each tier applied
 */
export function applyTieredReduction(
  manifests: PopulationManifest[],
  budgetCapCents: number,
): { manifests: PopulationManifest[]; warnings: string[] } {
  // Deep-clone before mutating
  let reduced: PopulationManifest[] = structuredClone(manifests);
  const warnings: string[] = [];

  // ── Tier 1: Replace Artisans with Understudies ────────────────────────────
  let artisanCount = 0;
  for (const manifest of reduced) {
    for (const soul of manifest.assignedSouls) {
      if (soul.agentClass === 'Artisan') {
        soul.agentClass = 'Understudy';
        artisanCount++;
      }
    }
  }

  if (artisanCount > 0) {
    const costAfterTier1 = estimatePopulationCost(reduced);
    warnings.push(
      `Tier 1 reduction: replaced ${artisanCount} Artisans with Understudies to fit budget cap of ${budgetCapCents}c`,
    );

    if (costAfterTier1 <= budgetCapCents) {
      return { manifests: reduced, warnings };
    }
  }

  // ── Tier 2: Reduce each task to MIN_AGENTS_PER_TASK ──────────────────────
  for (const manifest of reduced) {
    const before = manifest.assignedSouls.length;
    if (before > MIN_AGENTS_PER_TASK) {
      manifest.assignedSouls = manifest.assignedSouls.slice(0, MIN_AGENTS_PER_TASK);
      warnings.push(
        `Tier 2 reduction: reduced task ${manifest.taskId} from ${before} to ${MIN_AGENTS_PER_TASK} agents`,
      );
    }
  }

  return { manifests: reduced, warnings };
}

// ─── validateBudget ───────────────────────────────────────────────────────────

/**
 * Validate population manifests against the budget cap, applying tiered reduction if needed.
 *
 * Behavior:
 *  - budgetCapCents === 0 → no-cap mode, always returns funded=true with original manifests
 *  - Within budget → funded=true, original manifests, no warnings
 *  - Tier 1/2 reduction fits budget → funded=true, reduced manifests, warnings
 *  - Still over budget after full reduction → funded=false with shortfall details
 *
 * @param manifests       - Assembled population manifests
 * @param budgetCapCents  - Budget ceiling in cents (0 = no cap)
 * @returns BudgetValidationResult
 */
export function validateBudget(
  manifests: PopulationManifest[],
  budgetCapCents: number,
): BudgetValidationResult {
  // No-cap mode
  if (budgetCapCents === 0) {
    return {
      funded: true,
      manifests,
      warnings: [],
      estimatedCostCents: estimatePopulationCost(manifests),
    };
  }

  const initialCost = estimatePopulationCost(manifests);

  // Already within budget — no reduction needed
  if (initialCost <= budgetCapCents) {
    return {
      funded: true,
      manifests,
      warnings: [],
      estimatedCostCents: initialCost,
    };
  }

  // Apply tiered reduction
  const { manifests: reducedManifests, warnings } = applyTieredReduction(manifests, budgetCapCents);
  const costAfterReduction = estimatePopulationCost(reducedManifests);

  if (costAfterReduction <= budgetCapCents) {
    return {
      funded: true,
      manifests: reducedManifests,
      warnings,
      estimatedCostCents: costAfterReduction,
    };
  }

  // Still over budget — return shortfall details
  const shortfallCents = costAfterReduction - budgetCapCents;

  return {
    funded: false,
    manifests: reducedManifests,
    warnings,
    estimatedCostCents: costAfterReduction,
    shortfallCents,
    minimumRequiredCents: costAfterReduction,
  };
}
