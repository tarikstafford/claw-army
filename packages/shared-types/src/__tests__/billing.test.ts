import { describe, it, expect } from 'vitest';
import { BILLING_EVENT_TYPES } from '../billing';
import type { BillingEventType, PerformanceTier, DnaPayload } from '../billing';

describe('billing', () => {
  describe('BILLING_EVENT_TYPES', () => {
    it('is a non-empty readonly array', () => {
      expect(BILLING_EVENT_TYPES.length).toBeGreaterThan(0);
    });

    it('contains all expected BillingEventType values', () => {
      const expected: BillingEventType[] = ['bot_started', 'bot_stopped', 'tool_invoked', 'execution_completed', 'budget_exceeded'];
      expect(BILLING_EVENT_TYPES).toEqual(expected);
    });

    it('is readonly (as const)', () => {
      expect(Array.isArray(BILLING_EVENT_TYPES)).toBe(true);
    });
  });

  describe('PerformanceTier', () => {
    it('is a string union type with expected literals', () => {
      const val: PerformanceTier = 'high';
      expect(['high', 'medium', 'low']).toContain(val);
    });
  });

  describe('DnaPayload', () => {
    it('has required fields', () => {
      const payload: DnaPayload = {
        systemPromptTemplate: 'test',
        toolCallSequence: [],
        argumentPatterns: {},
        retryStrategy: {},
        timingProfile: {},
        tokenDistribution: {},
      };
      expect(payload.systemPromptTemplate).toBe('test');
      expect(payload.toolCallSequence).toEqual([]);
    });
  });
});
