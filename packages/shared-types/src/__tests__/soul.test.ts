import { describe, it, expect } from 'vitest';
import { VERDICT_TYPES } from '../soul';
import type { VerdictType } from '../soul';

describe('soul', () => {
  describe('VERDICT_TYPES', () => {
    it('is a non-empty readonly array', () => {
      expect(VERDICT_TYPES.length).toBeGreaterThan(0);
    });

    it('contains all expected VerdictType values', () => {
      const expected: VerdictType[] = ['Promote', 'Maintain', 'Monitor', 'Demote', 'Retire'];
      expect(VERDICT_TYPES).toEqual(expected);
    });

    it('is readonly (as const)', () => {
      expect(Array.isArray(VERDICT_TYPES)).toBe(true);
    });
  });
});
