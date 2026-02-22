import { describe, it, expect } from 'vitest';
import {
  computeClassTransition,
  type ClassState,
  type VerdictInput,
} from '../god-layer/class-machine';

// Default state helpers
function noviceState(overrides: Partial<ClassState> = {}): ClassState {
  return {
    currentClass: 'Novice',
    aboveBenchmarkCount: 0,
    belowBenchmarkCount: 0,
    humanConfirmationCount: 0,
    consecutiveBelowCount: 0,
    ...overrides,
  };
}

function understudyState(overrides: Partial<ClassState> = {}): ClassState {
  return {
    currentClass: 'Understudy',
    aboveBenchmarkCount: 0,
    belowBenchmarkCount: 0,
    humanConfirmationCount: 0,
    consecutiveBelowCount: 0,
    ...overrides,
  };
}

function baseVerdict(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    verdictType: 'Promote',
    confidence: 0.80,
    hasHumanConfirmation: true,
    isAboveBenchmark: true,
    isSoulDriven: true,
    hasUnresolvedDA: false,
    benchmarkMature: true,
    ...overrides,
  };
}

describe('computeClassTransition', () => {
  // =========================================================================
  // Case 1: Novice -> Understudy promotion (CLAS-02) — all conditions met
  // =========================================================================
  it('promotes Novice to Understudy when all CLAS-02 thresholds are met', () => {
    const state = noviceState({ aboveBenchmarkCount: 1, humanConfirmationCount: 0 });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.70,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      isSoulDriven: true,
      hasUnresolvedDA: false,
      benchmarkMature: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('promote');
    if (transition.type === 'promote') {
      expect(transition.from).toBe('Novice');
      expect(transition.to).toBe('Understudy');
    }
    // Counter updates: aboveBenchmarkCount incremented (1+1=2), humanConfirmationCount incremented (0+1=1)
    expect(newState.aboveBenchmarkCount).toBe(2);
    expect(newState.humanConfirmationCount).toBe(1);
    expect(newState.consecutiveBelowCount).toBe(0);
    expect(newState.currentClass).toBe('Understudy');
  });

  // =========================================================================
  // Case 2: Novice promotion blocked — benchmark not mature
  // =========================================================================
  it('blocks Novice -> Understudy promotion when benchmarkMature is false', () => {
    const state = noviceState({ aboveBenchmarkCount: 1, humanConfirmationCount: 0 });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.70,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      benchmarkMature: false,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    // Counters still updated even though no transition
    expect(newState.aboveBenchmarkCount).toBe(2);
    expect(newState.currentClass).toBe('Novice');
  });

  // =========================================================================
  // Case 3: Novice promotion blocked — insufficient human confirmations
  // =========================================================================
  it('blocks Novice -> Understudy promotion when hasHumanConfirmation is false and count is 0', () => {
    const state = noviceState({ aboveBenchmarkCount: 1, humanConfirmationCount: 0 });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.70,
      hasHumanConfirmation: false,
      isAboveBenchmark: true,
      benchmarkMature: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Novice');
    // humanConfirmationCount should NOT increment since hasHumanConfirmation is false
    expect(newState.humanConfirmationCount).toBe(0);
    // But above benchmark count should increment
    expect(newState.aboveBenchmarkCount).toBe(2);
  });

  // =========================================================================
  // Case 4: Novice promotion blocked — confidence too low
  // =========================================================================
  it('blocks Novice -> Understudy promotion when confidence <= 0.65', () => {
    const state = noviceState({ aboveBenchmarkCount: 1, humanConfirmationCount: 0 });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.60,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      benchmarkMature: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Novice');
  });

  // =========================================================================
  // Case 5: Understudy -> Artisan promotion (CLAS-03) — all conditions met
  // =========================================================================
  it('promotes Understudy to Artisan when all CLAS-03 thresholds are met', () => {
    const state = understudyState({
      aboveBenchmarkCount: 4,
      belowBenchmarkCount: 0,
      humanConfirmationCount: 1,
      consecutiveBelowCount: 0,
    });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.85,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      isSoulDriven: true,
      hasUnresolvedDA: false,
      benchmarkMature: true,
    });
    const { newState, transition, artisanGraduated } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('promote');
    if (transition.type === 'promote') {
      expect(transition.from).toBe('Understudy');
      expect(transition.to).toBe('Artisan');
    }
    expect(newState.aboveBenchmarkCount).toBe(5);
    expect(newState.humanConfirmationCount).toBe(2);
    expect(newState.currentClass).toBe('Artisan');
    expect(artisanGraduated).toBe(true);
  });

  // =========================================================================
  // Case 6: Understudy -> Artisan blocked — confidence below 0.80
  // =========================================================================
  it('blocks Understudy -> Artisan promotion when confidence <= 0.80', () => {
    const state = understudyState({
      aboveBenchmarkCount: 4,
      belowBenchmarkCount: 0,
      humanConfirmationCount: 1,
    });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.75,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      benchmarkMature: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Understudy');
  });

  // =========================================================================
  // Case 7: Understudy -> Artisan blocked — too many below-benchmark in window
  // =========================================================================
  it('blocks Understudy -> Artisan promotion when belowBenchmarkCount > 1 after update', () => {
    const state = understudyState({
      aboveBenchmarkCount: 4,
      belowBenchmarkCount: 2,
      humanConfirmationCount: 1,
    });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.85,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      benchmarkMature: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Understudy');
  });

  // =========================================================================
  // Case 8: Demotion — 2 consecutive below-benchmark, soul-driven (CLAS-04)
  // =========================================================================
  it('demotes Understudy to Novice on 2 consecutive below-benchmark with soul-driven and confidence > 0.70', () => {
    const state = understudyState({
      consecutiveBelowCount: 1,
      belowBenchmarkCount: 1,
    });
    const verdict = baseVerdict({
      verdictType: 'Demote',
      confidence: 0.75,
      isAboveBenchmark: false,
      isSoulDriven: true,
      hasHumanConfirmation: false,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('demote');
    if (transition.type === 'demote') {
      expect(transition.from).toBe('Understudy');
      expect(transition.to).toBe('Novice');
    }
    // After demotion: consecutiveBelowCount should be 2 (incremented from 1), counters reset on class change
    expect(newState.consecutiveBelowCount).toBe(2);
    expect(newState.currentClass).toBe('Novice');
  });

  // =========================================================================
  // Case 9: Demotion blocked — context-driven (CLAS-04)
  // =========================================================================
  it('blocks demotion when isSoulDriven is false (context-driven — Monitor treatment)', () => {
    const state = understudyState({ consecutiveBelowCount: 1 });
    const verdict = baseVerdict({
      verdictType: 'Demote',
      confidence: 0.75,
      isAboveBenchmark: false,
      isSoulDriven: false,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Understudy');
  });

  // =========================================================================
  // Case 10: Demotion blocked — confidence below 0.70
  // =========================================================================
  it('blocks demotion when confidence <= 0.70', () => {
    const state = understudyState({ consecutiveBelowCount: 1 });
    const verdict = baseVerdict({
      verdictType: 'Demote',
      confidence: 0.65,
      isAboveBenchmark: false,
      isSoulDriven: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Understudy');
  });

  // =========================================================================
  // Case 11: Retirement — post-demotion + 2 more below-benchmark (CLAS-05)
  // =========================================================================
  it('retires Novice agent when Retire verdict is soul-driven', () => {
    const state = noviceState({ consecutiveBelowCount: 1 });
    const verdict = baseVerdict({
      verdictType: 'Retire',
      isAboveBenchmark: false,
      isSoulDriven: true,
      confidence: 0.80,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('retire');
    expect(newState.currentClass).toBe('Retired');
  });

  // =========================================================================
  // Case 12: Already Retired — no further transitions
  // =========================================================================
  it('returns type: none for any verdict when agent is already Retired', () => {
    const state: ClassState = {
      currentClass: 'Retired',
      aboveBenchmarkCount: 5,
      belowBenchmarkCount: 3,
      humanConfirmationCount: 2,
      consecutiveBelowCount: 3,
    };
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.99,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Retired');
  });

  // =========================================================================
  // Case 13: Above-benchmark run updates counters correctly
  // =========================================================================
  it('resets consecutiveBelowCount and increments aboveBenchmarkCount on above-benchmark run', () => {
    const state = noviceState({
      aboveBenchmarkCount: 0,
      consecutiveBelowCount: 2,
      belowBenchmarkCount: 2,
    });
    const verdict = baseVerdict({
      verdictType: 'Maintain',
      isAboveBenchmark: true,
      hasHumanConfirmation: false,
    });
    const { newState } = computeClassTransition(state, verdict);

    expect(newState.aboveBenchmarkCount).toBe(1);
    expect(newState.consecutiveBelowCount).toBe(0);
  });

  // =========================================================================
  // Case 14: Below-benchmark run updates counters correctly
  // =========================================================================
  it('increments consecutiveBelowCount and belowBenchmarkCount on below-benchmark run', () => {
    const state = noviceState({
      consecutiveBelowCount: 0,
      belowBenchmarkCount: 1,
    });
    const verdict = baseVerdict({
      verdictType: 'Monitor',
      isAboveBenchmark: false,
      hasHumanConfirmation: false,
    });
    const { newState } = computeClassTransition(state, verdict);

    expect(newState.consecutiveBelowCount).toBe(1);
    expect(newState.belowBenchmarkCount).toBe(2);
  });

  // =========================================================================
  // Case 15: Unresolved DA blocks Novice -> Understudy promotion
  // =========================================================================
  it('blocks Novice -> Understudy promotion when hasUnresolvedDA is true', () => {
    const state = noviceState({ aboveBenchmarkCount: 1, humanConfirmationCount: 0 });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.70,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      benchmarkMature: true,
      hasUnresolvedDA: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Novice');
  });

  // =========================================================================
  // Additional: Retire with isSoulDriven=false is blocked (non-soul-driven retirement)
  // =========================================================================
  it('blocks retirement when isSoulDriven is false', () => {
    const state = noviceState({ consecutiveBelowCount: 1 });
    const verdict = baseVerdict({
      verdictType: 'Retire',
      isAboveBenchmark: false,
      isSoulDriven: false,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Novice');
  });

  // =========================================================================
  // Additional: Novice promotion requires aboveBenchmarkCount >= 2 after update
  // =========================================================================
  it('blocks Novice -> Understudy when aboveBenchmarkCount is only 1 after counter update (needs 2)', () => {
    // Start at 0 — after increment it becomes 1, need >= 2
    const state = noviceState({ aboveBenchmarkCount: 0, humanConfirmationCount: 0 });
    const verdict = baseVerdict({
      verdictType: 'Promote',
      confidence: 0.70,
      hasHumanConfirmation: true,
      isAboveBenchmark: true,
      benchmarkMature: true,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('none');
    expect(newState.currentClass).toBe('Novice');
    expect(newState.aboveBenchmarkCount).toBe(1);
  });

  // =========================================================================
  // Additional: Artisan can be demoted to Novice
  // =========================================================================
  it('demotes Artisan to Novice on Demote verdict with soul-driven and confidence > 0.70', () => {
    const state: ClassState = {
      currentClass: 'Artisan',
      aboveBenchmarkCount: 10,
      belowBenchmarkCount: 0,
      humanConfirmationCount: 3,
      consecutiveBelowCount: 1,
    };
    const verdict = baseVerdict({
      verdictType: 'Demote',
      confidence: 0.75,
      isAboveBenchmark: false,
      isSoulDriven: true,
      hasHumanConfirmation: false,
    });
    const { newState, transition } = computeClassTransition(state, verdict);

    expect(transition.type).toBe('demote');
    if (transition.type === 'demote') {
      expect(transition.from).toBe('Artisan');
      expect(transition.to).toBe('Novice');
    }
    expect(newState.currentClass).toBe('Novice');
  });
});
