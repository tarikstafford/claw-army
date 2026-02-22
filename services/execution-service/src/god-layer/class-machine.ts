/**
 * Agent Class State Machine
 *
 * Pure function — no DB I/O, no imports from @claw/db or ioredis.
 *
 * Computes class transitions (Novice -> Understudy -> Artisan, demotion,
 * retirement) based on accumulated run counters, council verdict data,
 * and benchmark maturity.
 *
 * Used by the God Layer worker inside its DB transaction.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassState {
  currentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired';
  aboveBenchmarkCount: number;
  belowBenchmarkCount: number;
  humanConfirmationCount: number;
  consecutiveBelowCount: number;
}

export interface VerdictInput {
  verdictType: 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';
  confidence: number; // weighted council confidence score
  hasHumanConfirmation: boolean;
  isAboveBenchmark: boolean;
  isSoulDriven: boolean; // from Soul Analyst — context-driven = false
  hasUnresolvedDA: boolean; // unresolved Devil's Advocate arguments
  benchmarkMature: boolean; // false during pioneer thin-data period
}

export type ClassTransition =
  | { type: 'promote'; from: 'Novice'; to: 'Understudy' }
  | { type: 'promote'; from: 'Understudy'; to: 'Artisan' }
  | { type: 'demote'; from: 'Understudy' | 'Artisan'; to: 'Novice' }
  | { type: 'retire' }
  | { type: 'none' };

export interface ClassTransitionResult {
  newState: ClassState;
  transition: ClassTransition;
  artisanGraduated?: boolean;
}

// ---------------------------------------------------------------------------
// Thresholds (CLAS-01 through CLAS-05)
// ---------------------------------------------------------------------------

/** CLAS-02: Novice -> Understudy */
const NOVICE_PROMOTION = {
  minAboveBenchmark: 2,
  minHumanConfirmations: 1,
  minConfidence: 0.65,
} as const;

/** CLAS-03: Understudy -> Artisan */
const UNDERSTUDY_PROMOTION = {
  minAboveBenchmark: 5,
  maxBelowBenchmark: 1,
  minHumanConfirmations: 2,
  minConfidence: 0.80,
} as const;

/** CLAS-04: Demotion */
const DEMOTION = {
  minConsecutiveBelow: 2,
  minConfidence: 0.70,
} as const;

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

/**
 * Compute the next agent class state and any transition type.
 *
 * **Counter update logic runs first, before transition evaluation.**
 * This means promotion/demotion thresholds are evaluated against
 * the UPDATED counters (including the current verdict's contribution).
 */
export function computeClassTransition(
  state: ClassState,
  verdict: VerdictInput,
): ClassTransitionResult {
  // -------------------------------------------------------------------------
  // Step 1: Update counters (always runs, regardless of verdict type)
  // -------------------------------------------------------------------------
  let {
    aboveBenchmarkCount,
    belowBenchmarkCount,
    humanConfirmationCount,
    consecutiveBelowCount,
    currentClass,
  } = state;

  if (verdict.isAboveBenchmark) {
    aboveBenchmarkCount += 1;
    consecutiveBelowCount = 0; // reset streak on above-benchmark run
  } else {
    belowBenchmarkCount += 1;
    consecutiveBelowCount += 1;
  }

  if (verdict.hasHumanConfirmation) {
    humanConfirmationCount += 1;
  }

  const updatedState: ClassState = {
    currentClass,
    aboveBenchmarkCount,
    belowBenchmarkCount,
    humanConfirmationCount,
    consecutiveBelowCount,
  };

  // -------------------------------------------------------------------------
  // Step 2: Transition evaluation (using updated counters)
  // -------------------------------------------------------------------------

  // Guard: Already retired — no further transitions possible
  if (currentClass === 'Retired') {
    return { newState: updatedState, transition: { type: 'none' } };
  }

  // Retire: verdictType === 'Retire' AND isSoulDriven
  if (verdict.verdictType === 'Retire') {
    if (verdict.isSoulDriven) {
      const retiredState: ClassState = { ...updatedState, currentClass: 'Retired' };
      return { newState: retiredState, transition: { type: 'retire' } };
    }
    // Non-soul-driven Retire is treated as Monitor (no class change)
    return { newState: updatedState, transition: { type: 'none' } };
  }

  // Demote (CLAS-04)
  if (verdict.verdictType === 'Demote') {
    // Context-driven: do NOT demote regardless of other conditions
    if (!verdict.isSoulDriven) {
      return { newState: updatedState, transition: { type: 'none' } };
    }

    // All guards must be met: consecutive >= 2, confidence > 0.70, soul-driven
    const canDemote =
      consecutiveBelowCount >= DEMOTION.minConsecutiveBelow &&
      verdict.confidence > DEMOTION.minConfidence;

    if (canDemote && (currentClass === 'Understudy' || currentClass === 'Artisan')) {
      const demotedFrom = currentClass as 'Understudy' | 'Artisan';
      const demotedState: ClassState = {
        ...updatedState,
        currentClass: 'Novice',
      };
      return {
        newState: demotedState,
        transition: { type: 'demote', from: demotedFrom, to: 'Novice' },
      };
    }

    return { newState: updatedState, transition: { type: 'none' } };
  }

  // Promote: Novice -> Understudy (CLAS-02)
  if (verdict.verdictType === 'Promote' && currentClass === 'Novice') {
    const canPromote =
      aboveBenchmarkCount >= NOVICE_PROMOTION.minAboveBenchmark &&
      humanConfirmationCount >= NOVICE_PROMOTION.minHumanConfirmations &&
      verdict.confidence > NOVICE_PROMOTION.minConfidence &&
      !verdict.hasUnresolvedDA &&
      verdict.benchmarkMature;

    if (canPromote) {
      const promotedState: ClassState = { ...updatedState, currentClass: 'Understudy' };
      return {
        newState: promotedState,
        transition: { type: 'promote', from: 'Novice', to: 'Understudy' },
      };
    }

    return { newState: updatedState, transition: { type: 'none' } };
  }

  // Promote: Understudy -> Artisan (CLAS-03)
  if (verdict.verdictType === 'Promote' && currentClass === 'Understudy') {
    const canPromote =
      aboveBenchmarkCount >= UNDERSTUDY_PROMOTION.minAboveBenchmark &&
      belowBenchmarkCount <= UNDERSTUDY_PROMOTION.maxBelowBenchmark &&
      humanConfirmationCount >= UNDERSTUDY_PROMOTION.minHumanConfirmations &&
      verdict.confidence > UNDERSTUDY_PROMOTION.minConfidence &&
      verdict.benchmarkMature;

    if (canPromote) {
      const promotedState: ClassState = { ...updatedState, currentClass: 'Artisan' };
      return {
        newState: promotedState,
        transition: { type: 'promote', from: 'Understudy', to: 'Artisan' },
        artisanGraduated: true,
      };
    }

    return { newState: updatedState, transition: { type: 'none' } };
  }

  // Maintain / Monitor or any unhandled verdict type — no class change
  return { newState: updatedState, transition: { type: 'none' } };
}
