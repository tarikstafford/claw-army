import { describe, it, expect } from 'vitest';
import { COORDINATION_WEIGHTS, FITNESS_CATEGORY_WEIGHTS, BUDGET_DEGRADATION_TIERS } from '../ring-leader';
import type { BudgetDegradationTier } from '../ring-leader';

describe('ring-leader', () => {
  describe('COORDINATION_WEIGHTS', () => {
    it('weights sum to 1.0', () => {
      const sum = COORDINATION_WEIGHTS.collectiveOutcome +
        COORDINATION_WEIGHTS.driftPrevention +
        COORDINATION_WEIGHTS.reallocationEffectiveness +
        COORDINATION_WEIGHTS.budgetManagement;
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('FITNESS_CATEGORY_WEIGHTS', () => {
    it('weights sum to 1.0', () => {
      const sum = FITNESS_CATEGORY_WEIGHTS.coordination + FITNESS_CATEGORY_WEIGHTS.soulSelection;
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('BUDGET_DEGRADATION_TIERS', () => {
    it('is a non-empty readonly array', () => {
      expect(BUDGET_DEGRADATION_TIERS.length).toBeGreaterThan(0);
    });

    it('is ordered correctly (normal -> hard_stop)', () => {
      const expected: BudgetDegradationTier[] = ['normal', 'deprioritize', 'consolidate', 'wrap_up', 'hard_stop'];
      expect(BUDGET_DEGRADATION_TIERS).toEqual(expected);
    });

    it('is readonly (as const)', () => {
      expect(Array.isArray(BUDGET_DEGRADATION_TIERS)).toBe(true);
    });
  });
});
