import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  executionCreatedEventSchema,
  executionStatusChangedEventSchema,
  taskClaimedEventSchema,
  taskCompletedEventSchema,
} from '../execution-events';

const VALID_EXECUTION_CREATED = {
  type: 'execution_created',
  executionId: '550e8400-e29b-41d4-a716-446655440000',
  objective: 'Complete the task',
  maxBots: 5,
  budgetCapCents: 10000,
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_EXECUTION_STATUS_CHANGED = {
  type: 'execution_status_changed',
  executionId: '550e8400-e29b-41d4-a716-446655440000',
  fromStatus: 'queued',
  toStatus: 'running',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_TASK_CLAIMED = {
  type: 'task_claimed',
  taskId: '550e8400-e29b-41d4-a716-446655440001',
  botId: '550e8400-e29b-41d4-a716-446655440002',
  executionId: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_TASK_COMPLETED = {
  type: 'task_completed',
  taskId: '550e8400-e29b-41d4-a716-446655440001',
  botId: '550e8400-e29b-41d4-a716-446655440002',
  executionId: '550e8400-e29b-41d4-a716-446655440000',
  durationMs: 1500,
  timestamp: '2024-01-15T10:30:00.000Z',
};

describe('executionCreatedEventSchema', () => {
  it('parses valid execution created event', () => {
    const result = executionCreatedEventSchema.parse(VALID_EXECUTION_CREATED);
    expect(result.type).toBe('execution_created');
    expect(result.objective).toBe('Complete the task');
    expect(result.maxBots).toBe(5);
    expect(result.budgetCapCents).toBe(10000);
  });

  it('parses execution created event with null budgetCapCents', () => {
    const result = executionCreatedEventSchema.parse({
      ...VALID_EXECUTION_CREATED,
      budgetCapCents: null,
    });
    expect(result.budgetCapCents).toBeNull();
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_EXECUTION_CREATED;
    expect(() => executionCreatedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required objective field', () => {
    const { objective: _objective, ...withoutObjective } = VALID_EXECUTION_CREATED;
    expect(() => executionCreatedEventSchema.parse(withoutObjective)).toThrow(z.ZodError);
  });

  it('throws on missing required maxBots field', () => {
    const { maxBots: _maxBots, ...withoutMaxBots } = VALID_EXECUTION_CREATED;
    expect(() => executionCreatedEventSchema.parse(withoutMaxBots)).toThrow(z.ZodError);
  });

  it('throws on missing required budgetCapCents field', () => {
    const { budgetCapCents: _budgetCapCents, ...withoutBudgetCapCents } = VALID_EXECUTION_CREATED;
    expect(() => executionCreatedEventSchema.parse(withoutBudgetCapCents)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_EXECUTION_CREATED;
    expect(() => executionCreatedEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for maxBots', () => {
    const result = { ...VALID_EXECUTION_CREATED, maxBots: 'five' };
    expect(() => executionCreatedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-positive maxBots', () => {
    const result = { ...VALID_EXECUTION_CREATED, maxBots: 0 };
    expect(() => executionCreatedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on negative maxBots', () => {
    const result = { ...VALID_EXECUTION_CREATED, maxBots: -1 };
    expect(() => executionCreatedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer maxBots', () => {
    const result = { ...VALID_EXECUTION_CREATED, maxBots: 3.5 };
    expect(() => executionCreatedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid timestamp format', () => {
    const result = { ...VALID_EXECUTION_CREATED, timestamp: 'not-a-date' };
    expect(() => executionCreatedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = executionCreatedEventSchema.parse({
      ...VALID_EXECUTION_CREATED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('executionStatusChangedEventSchema', () => {
  it('parses valid execution status changed event', () => {
    const result = executionStatusChangedEventSchema.parse(VALID_EXECUTION_STATUS_CHANGED);
    expect(result.type).toBe('execution_status_changed');
    expect(result.fromStatus).toBe('queued');
    expect(result.toStatus).toBe('running');
  });

  it('parses all valid status values', () => {
    const statuses = ['queued', 'running', 'paused', 'stopped', 'completed', 'failed'] as const;
    for (const fromStatus of statuses) {
      for (const toStatus of statuses) {
        const result = executionStatusChangedEventSchema.parse({
          ...VALID_EXECUTION_STATUS_CHANGED,
          fromStatus,
          toStatus,
        });
        expect(result.fromStatus).toBe(fromStatus);
        expect(result.toStatus).toBe(toStatus);
      }
    }
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_EXECUTION_STATUS_CHANGED;
    expect(() => executionStatusChangedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required fromStatus field', () => {
    const { fromStatus: _fromStatus, ...withoutFromStatus } = VALID_EXECUTION_STATUS_CHANGED;
    expect(() => executionStatusChangedEventSchema.parse(withoutFromStatus)).toThrow(z.ZodError);
  });

  it('throws on missing required toStatus field', () => {
    const { toStatus: _toStatus, ...withoutToStatus } = VALID_EXECUTION_STATUS_CHANGED;
    expect(() => executionStatusChangedEventSchema.parse(withoutToStatus)).toThrow(z.ZodError);
  });

  it('throws on invalid fromStatus value', () => {
    const result = { ...VALID_EXECUTION_STATUS_CHANGED, fromStatus: 'invalid' };
    expect(() => executionStatusChangedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid toStatus value', () => {
    const result = { ...VALID_EXECUTION_STATUS_CHANGED, toStatus: 'invalid' };
    expect(() => executionStatusChangedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = executionStatusChangedEventSchema.parse({
      ...VALID_EXECUTION_STATUS_CHANGED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('taskClaimedEventSchema', () => {
  it('parses valid task claimed event', () => {
    const result = taskClaimedEventSchema.parse(VALID_TASK_CLAIMED);
    expect(result.type).toBe('task_claimed');
    expect(result.taskId).toBe(VALID_TASK_CLAIMED.taskId);
    expect(result.botId).toBe(VALID_TASK_CLAIMED.botId);
    expect(result.executionId).toBe(VALID_TASK_CLAIMED.executionId);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_TASK_CLAIMED;
    expect(() => taskClaimedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required taskId field', () => {
    const { taskId: _taskId, ...withoutTaskId } = VALID_TASK_CLAIMED;
    expect(() => taskClaimedEventSchema.parse(withoutTaskId)).toThrow(z.ZodError);
  });

  it('throws on missing required botId field', () => {
    const { botId: _botId, ...withoutBotId } = VALID_TASK_CLAIMED;
    expect(() => taskClaimedEventSchema.parse(withoutBotId)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_TASK_CLAIMED;
    expect(() => taskClaimedEventSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_TASK_CLAIMED;
    expect(() => taskClaimedEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for taskId', () => {
    const result = { ...VALID_TASK_CLAIMED, taskId: 'not-a-uuid' };
    expect(() => taskClaimedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = taskClaimedEventSchema.parse({
      ...VALID_TASK_CLAIMED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('taskCompletedEventSchema', () => {
  it('parses valid task completed event', () => {
    const result = taskCompletedEventSchema.parse(VALID_TASK_COMPLETED);
    expect(result.type).toBe('task_completed');
    expect(result.durationMs).toBe(1500);
  });

  it('parses task completed event with zero duration', () => {
    const result = taskCompletedEventSchema.parse({
      ...VALID_TASK_COMPLETED,
      durationMs: 0,
    });
    expect(result.durationMs).toBe(0);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_TASK_COMPLETED;
    expect(() => taskCompletedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required durationMs field', () => {
    const { durationMs: _durationMs, ...withoutDurationMs } = VALID_TASK_COMPLETED;
    expect(() => taskCompletedEventSchema.parse(withoutDurationMs)).toThrow(z.ZodError);
  });

  it('throws on negative durationMs', () => {
    const result = { ...VALID_TASK_COMPLETED, durationMs: -1 };
    expect(() => taskCompletedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer durationMs', () => {
    const result = { ...VALID_TASK_COMPLETED, durationMs: 1500.5 };
    expect(() => taskCompletedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for durationMs', () => {
    const result = { ...VALID_TASK_COMPLETED, durationMs: 'fast' };
    expect(() => taskCompletedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = taskCompletedEventSchema.parse({
      ...VALID_TASK_COMPLETED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});