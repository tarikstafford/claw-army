import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  billingEventSchema,
  budgetExceededEventSchema,
} from '../billing-events';

const VALID_BILLING_EVENT = {
  type: 'billing_event',
  executionId: '550e8400-e29b-41d4-a716-446655440000',
  botId: '550e8400-e29b-41d4-a716-446655440001',
  eventType: 'bot_started',
  amountCents: 1000,
  tokenCount: 500,
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_BUDGET_EXCEEDED_EVENT = {
  type: 'budget_exceeded',
  executionId: '550e8400-e29b-41d4-a716-446655440000',
  budgetCapCents: 10000,
  totalSpentCents: 10500,
  timestamp: '2024-01-15T10:30:00.000Z',
};

describe('billingEventSchema', () => {
  it('parses valid billing event', () => {
    const result = billingEventSchema.parse(VALID_BILLING_EVENT);
    expect(result.type).toBe('billing_event');
    expect(result.executionId).toBe(VALID_BILLING_EVENT.executionId);
    expect(result.eventType).toBe('bot_started');
    expect(result.timestamp).toBe(VALID_BILLING_EVENT.timestamp);
  });

  it('parses minimal valid billing event (all optional fields omitted)', () => {
    const minimal = {
      type: 'billing_event',
      executionId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'tool_invoked',
      timestamp: '2024-01-15T10:30:00.000Z',
    };
    const result = billingEventSchema.parse(minimal);
    expect(result.type).toBe('billing_event');
    expect(result.executionId).toBe(minimal.executionId);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_BILLING_EVENT;
    expect(() => billingEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_BILLING_EVENT;
    expect(() => billingEventSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required eventType field', () => {
    const { eventType: _eventType, ...withoutEventType } = VALID_BILLING_EVENT;
    expect(() => billingEventSchema.parse(withoutEventType)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_BILLING_EVENT;
    expect(() => billingEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for executionId', () => {
    const result = { ...VALID_BILLING_EVENT, executionId: 'not-a-uuid' };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for botId', () => {
    const result = { ...VALID_BILLING_EVENT, botId: 123 };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for eventType', () => {
    const result = { ...VALID_BILLING_EVENT, eventType: 'invalid_type' };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on negative amountCents', () => {
    const result = { ...VALID_BILLING_EVENT, amountCents: -100 };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer amountCents', () => {
    const result = { ...VALID_BILLING_EVENT, amountCents: 10.5 };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid timestamp format', () => {
    const result = { ...VALID_BILLING_EVENT, timestamp: 'not-a-date' };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid ISO datetime (missing timezone)', () => {
    const result = { ...VALID_BILLING_EVENT, timestamp: '2024-01-15T10:30:00' };
    expect(() => billingEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = billingEventSchema.parse({
      ...VALID_BILLING_EVENT,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('budgetExceededEventSchema', () => {
  it('parses valid budget exceeded event', () => {
    const result = budgetExceededEventSchema.parse(VALID_BUDGET_EXCEEDED_EVENT);
    expect(result.type).toBe('budget_exceeded');
    expect(result.executionId).toBe(VALID_BUDGET_EXCEEDED_EVENT.executionId);
    expect(result.budgetCapCents).toBe(10500);
    expect(result.totalSpentCents).toBe(10000);
    expect(result.timestamp).toBe(VALID_BUDGET_EXCEEDED_EVENT.timestamp);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_BUDGET_EXCEEDED_EVENT;
    expect(() => budgetExceededEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_BUDGET_EXCEEDED_EVENT;
    expect(() => budgetExceededEventSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required budgetCapCents field', () => {
    const { budgetCapCents: _budgetCapCents, ...withoutBudgetCapCents } = VALID_BUDGET_EXCEEDED_EVENT;
    expect(() => budgetExceededEventSchema.parse(withoutBudgetCapCents)).toThrow(z.ZodError);
  });

  it('throws on missing required totalSpentCents field', () => {
    const { totalSpentCents: _totalSpentCents, ...withoutTotalSpentCents } = VALID_BUDGET_EXCEEDED_EVENT;
    expect(() => budgetExceededEventSchema.parse(withoutTotalSpentCents)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_BUDGET_EXCEEDED_EVENT;
    expect(() => budgetExceededEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for budgetCapCents', () => {
    const result = { ...VALID_BUDGET_EXCEEDED_EVENT, budgetCapCents: 'ten thousand' };
    expect(() => budgetExceededEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on negative budgetCapCents', () => {
    const result = { ...VALID_BUDGET_EXCEEDED_EVENT, budgetCapCents: -1 };
    expect(() => budgetExceededEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer budgetCapCents', () => {
    const result = { ...VALID_BUDGET_EXCEEDED_EVENT, budgetCapCents: 100.5 };
    expect(() => budgetExceededEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid timestamp format', () => {
    const result = { ...VALID_BUDGET_EXCEEDED_EVENT, timestamp: 'invalid-date' };
    expect(() => budgetExceededEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = budgetExceededEventSchema.parse({
      ...VALID_BUDGET_EXCEEDED_EVENT,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});