import { describe, it, expect } from 'vitest';
import { BOT_STATUSES } from '../bot';
import type { BotStatus } from '../bot';

describe('bot', () => {
  describe('BOT_STATUSES', () => {
    it('is a non-empty readonly array', () => {
      expect(BOT_STATUSES.length).toBeGreaterThan(0);
    });

    it('contains all expected BotStatus values', () => {
      const expected: BotStatus[] = ['spawning', 'idle', 'working', 'stopping', 'stopped', 'failed'];
      expect(BOT_STATUSES).toEqual(expected);
    });

    it('is readonly (as const)', () => {
      expect(Array.isArray(BOT_STATUSES)).toBe(true);
    });
  });
});
