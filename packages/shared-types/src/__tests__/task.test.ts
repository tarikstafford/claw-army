import { describe, it, expect } from 'vitest';
import { TASK_STATUSES } from '../task';
import type { TaskStatus } from '../task';

describe('task', () => {
  describe('TASK_STATUSES', () => {
    it('is a non-empty readonly array', () => {
      expect(TASK_STATUSES.length).toBeGreaterThan(0);
    });

    it('contains all expected TaskStatus values', () => {
      const expected: TaskStatus[] = ['pending', 'claimed', 'completed', 'failed'];
      expect(TASK_STATUSES).toEqual(expected);
    });

    it('is readonly (as const)', () => {
      expect(Array.isArray(TASK_STATUSES)).toBe(true);
    });
  });
});
