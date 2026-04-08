import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { guardrailTriggeredEventSchema } from '../guardrail-events';

const VALID_GUARDRAIL_TRIGGERED = {
  type: 'guardrail_triggered',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  reason: 'budget_exceeded',
  action: 'warned',
  timestamp: '2024-01-15T10:30:00.000Z',
};

describe('guardrailTriggeredEventSchema', () => {
  it('parses valid guardrail triggered event', () => {
    const result = guardrailTriggeredEventSchema.parse(VALID_GUARDRAIL_TRIGGERED);
    expect(result.type).toBe('guardrail_triggered');
    expect(result.reason).toBe('budget_exceeded');
    expect(result.action).toBe('warned');
  });

  it('parses guardrail triggered event with all reason values', () => {
    const reasons: Array<'budget_exceeded' | 'rate_limit' | 'loop_detected' | 'idle_timeout'> = [
      'budget_exceeded', 'rate_limit', 'loop_detected', 'idle_timeout'
    ];
    for (const reason of reasons) {
      const result = guardrailTriggeredEventSchema.parse({ ...VALID_GUARDRAIL_TRIGGERED, reason });
      expect(result.reason).toBe(reason);
    }
  });

  it('parses guardrail triggered event with all action values', () => {
    const actions: Array<'warned' | 'throttled' | 'revoked' | 'terminated'> = [
      'warned', 'throttled', 'revoked', 'terminated'
    ];
    for (const action of actions) {
      const result = guardrailTriggeredEventSchema.parse({ ...VALID_GUARDRAIL_TRIGGERED, action });
      expect(result.action).toBe(action);
    }
  });

  it('parses guardrail triggered event with metadata', () => {
    const withMetadata = {
      ...VALID_GUARDRAIL_TRIGGERED,
      metadata: {
        attemptNumber: 3,
        threshold: 10,
      },
    };
    const result = guardrailTriggeredEventSchema.parse(withMetadata);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.attemptNumber).toBe(3);
  });

  it('parses guardrail triggered event without metadata', () => {
    const result = guardrailTriggeredEventSchema.parse(VALID_GUARDRAIL_TRIGGERED);
    expect(result.metadata).toBeUndefined();
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_GUARDRAIL_TRIGGERED;
    expect(() => guardrailTriggeredEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required botId field', () => {
    const { botId: _botId, ...withoutBotId } = VALID_GUARDRAIL_TRIGGERED;
    expect(() => guardrailTriggeredEventSchema.parse(withoutBotId)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_GUARDRAIL_TRIGGERED;
    expect(() => guardrailTriggeredEventSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required reason field', () => {
    const { reason: _reason, ...withoutReason } = VALID_GUARDRAIL_TRIGGERED;
    expect(() => guardrailTriggeredEventSchema.parse(withoutReason)).toThrow(z.ZodError);
  });

  it('throws on missing required action field', () => {
    const { action: _action, ...withoutAction } = VALID_GUARDRAIL_TRIGGERED;
    expect(() => guardrailTriggeredEventSchema.parse(withoutAction)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_GUARDRAIL_TRIGGERED;
    expect(() => guardrailTriggeredEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on invalid reason value', () => {
    const result = { ...VALID_GUARDRAIL_TRIGGERED, reason: 'invalid_reason' };
    expect(() => guardrailTriggeredEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid action value', () => {
    const result = { ...VALID_GUARDRAIL_TRIGGERED, action: 'invalid_action' };
    expect(() => guardrailTriggeredEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for botId', () => {
    const result = { ...VALID_GUARDRAIL_TRIGGERED, botId: 'not-a-uuid' };
    expect(() => guardrailTriggeredEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid timestamp format', () => {
    const result = { ...VALID_GUARDRAIL_TRIGGERED, timestamp: '2024-01-15' };
    expect(() => guardrailTriggeredEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = guardrailTriggeredEventSchema.parse({
      ...VALID_GUARDRAIL_TRIGGERED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });

  it('parses empty metadata object', () => {
    const result = guardrailTriggeredEventSchema.parse({
      ...VALID_GUARDRAIL_TRIGGERED,
      metadata: {},
    });
    expect(result.metadata).toEqual({});
  });

  it('parses metadata with various value types', () => {
    const result = guardrailTriggeredEventSchema.parse({
      ...VALID_GUARDRAIL_TRIGGERED,
      metadata: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        nullValue: null,
        arrayValue: [1, 2, 3],
      },
    });
    expect(result.metadata?.stringValue).toBe('test');
    expect(result.metadata?.numberValue).toBe(42);
    expect(result.metadata?.booleanValue).toBe(true);
    expect(result.metadata?.nullValue).toBeNull();
    expect(result.metadata?.arrayValue).toEqual([1, 2, 3]);
  });
});