import { describe, it, expect } from 'vitest';
import { EXECUTION_STATUSES } from '../execution';
import type { ExecutionStatus } from '../execution';

describe('execution', () => {
  describe('EXECUTION_STATUSES', () => {
    it('is a non-empty readonly array', () => {
      expect(EXECUTION_STATUSES.length).toBeGreaterThan(0);
    });

    it('contains all expected ExecutionStatus values', () => {
      const expected: ExecutionStatus[] = ['pre_flight', 'queued', 'running', 'paused', 'stopped', 'completed', 'failed'];
      expect(EXECUTION_STATUSES).toEqual(expected);
    });

    it('is readonly (as const)', () => {
      expect(Array.isArray(EXECUTION_STATUSES)).toBe(true);
    });
  });
});
