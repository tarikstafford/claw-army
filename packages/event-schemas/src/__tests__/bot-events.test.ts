import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  botStartedEventSchema,
  botStoppedEventSchema,
  botHeartbeatEventSchema,
} from '../bot-events';

const VALID_BOT_STARTED = {
  type: 'bot_started',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_BOT_STOPPED = {
  type: 'bot_stopped',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  timestamp: '2024-01-15T10:30:00.000Z',
  reason: 'completed',
};

const VALID_BOT_HEARTBEAT = {
  type: 'bot_heartbeat',
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  timestamp: '2024-01-15T10:30:00.000Z',
};

describe('botStartedEventSchema', () => {
  it('parses valid bot started event', () => {
    const result = botStartedEventSchema.parse(VALID_BOT_STARTED);
    expect(result.type).toBe('bot_started');
    expect(result.botId).toBe(VALID_BOT_STARTED.botId);
    expect(result.executionId).toBe(VALID_BOT_STARTED.executionId);
    expect(result.timestamp).toBe(VALID_BOT_STARTED.timestamp);
  });

  it('parses bot started event with metadata', () => {
    const withMetadata = {
      ...VALID_BOT_STARTED,
      metadata: {
        imageTag: 'v1.0.0',
        containerId: 'abc123',
        instanceName: 'bot-instance-1',
        internalIp: '192.168.1.1',
        port: 8080,
        zone: 'us-east-1a',
      },
    };
    const result = botStartedEventSchema.parse(withMetadata);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.imageTag).toBe('v1.0.0');
  });

  it('parses bot started event without metadata', () => {
    const result = botStartedEventSchema.parse(VALID_BOT_STARTED);
    expect(result.metadata).toBeUndefined();
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_BOT_STARTED;
    expect(() => botStartedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required botId field', () => {
    const { botId: _botId, ...withoutBotId } = VALID_BOT_STARTED;
    expect(() => botStartedEventSchema.parse(withoutBotId)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_BOT_STARTED;
    expect(() => botStartedEventSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_BOT_STARTED;
    expect(() => botStartedEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for botId', () => {
    const result = { ...VALID_BOT_STARTED, botId: 'not-a-uuid' };
    expect(() => botStartedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid timestamp format', () => {
    const result = { ...VALID_BOT_STARTED, timestamp: '2024-01-15' };
    expect(() => botStartedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = botStartedEventSchema.parse({
      ...VALID_BOT_STARTED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('botStoppedEventSchema', () => {
  it('parses valid bot stopped event', () => {
    const result = botStoppedEventSchema.parse(VALID_BOT_STOPPED);
    expect(result.type).toBe('bot_stopped');
    expect(result.reason).toBe('completed');
  });

  it('parses bot stopped event with all reason values', () => {
    const reasons: Array<'completed' | 'terminated' | 'failed' | 'budget_exceeded' | 'idle_timeout'> = [
      'completed', 'terminated', 'failed', 'budget_exceeded', 'idle_timeout'
    ];
    for (const reason of reasons) {
      const result = botStoppedEventSchema.parse({ ...VALID_BOT_STOPPED, reason });
      expect(result.reason).toBe(reason);
    }
  });

  it('parses bot stopped event with metadata', () => {
    const withMetadata = {
      ...VALID_BOT_STOPPED,
      metadata: {
        tasksClaimed: 10,
        tasksCompleted: 8,
        tasksFailed: 1,
      },
    };
    const result = botStoppedEventSchema.parse(withMetadata);
    expect(result.metadata?.tasksClaimed).toBe(10);
    expect(result.metadata?.tasksCompleted).toBe(8);
    expect(result.metadata?.tasksFailed).toBe(1);
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_BOT_STOPPED;
    expect(() => botStoppedEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required reason field', () => {
    const { reason: _reason, ...withoutReason } = VALID_BOT_STOPPED;
    expect(() => botStoppedEventSchema.parse(withoutReason)).toThrow(z.ZodError);
  });

  it('throws on invalid reason value', () => {
    const result = { ...VALID_BOT_STOPPED, reason: 'invalid_reason' };
    expect(() => botStoppedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for tasksClaimed in metadata', () => {
    const result = {
      ...VALID_BOT_STOPPED,
      metadata: { tasksClaimed: 'ten' },
    };
    expect(() => botStoppedEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = botStoppedEventSchema.parse({
      ...VALID_BOT_STOPPED,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('botHeartbeatEventSchema', () => {
  it('parses valid bot heartbeat event', () => {
    const result = botHeartbeatEventSchema.parse(VALID_BOT_HEARTBEAT);
    expect(result.type).toBe('bot_heartbeat');
    expect(result.botId).toBe(VALID_BOT_HEARTBEAT.botId);
    expect(result.executionId).toBe(VALID_BOT_HEARTBEAT.executionId);
  });

  it('parses bot heartbeat event with currentTaskId', () => {
    const withTaskId = {
      ...VALID_BOT_HEARTBEAT,
      currentTaskId: '550e8400-e29b-41d4-a716-446655440099',
    };
    const result = botHeartbeatEventSchema.parse(withTaskId);
    expect(result.currentTaskId).toBe('550e8400-e29b-41d4-a716-446655440099');
  });

  it('parses bot heartbeat event without currentTaskId', () => {
    const result = botHeartbeatEventSchema.parse(VALID_BOT_HEARTBEAT);
    expect(result.currentTaskId).toBeUndefined();
  });

  it('throws on missing required type field', () => {
    const { type: _type, ...withoutType } = VALID_BOT_HEARTBEAT;
    expect(() => botHeartbeatEventSchema.parse(withoutType)).toThrow(z.ZodError);
  });

  it('throws on missing required botId field', () => {
    const { botId: _botId, ...withoutBotId } = VALID_BOT_HEARTBEAT;
    expect(() => botHeartbeatEventSchema.parse(withoutBotId)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_BOT_HEARTBEAT;
    expect(() => botHeartbeatEventSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_BOT_HEARTBEAT;
    expect(() => botHeartbeatEventSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for currentTaskId', () => {
    const result = { ...VALID_BOT_HEARTBEAT, currentTaskId: 'not-a-uuid' };
    expect(() => botHeartbeatEventSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = botHeartbeatEventSchema.parse({
      ...VALID_BOT_HEARTBEAT,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});