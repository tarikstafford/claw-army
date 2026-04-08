import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  toolInvocationRequestBaseSchema,
  toolInvocationResponseBaseSchema,
  TOOL_NAMES,
} from '../common';

const VALID_REQUEST_BASE = {
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  toolName: 'llm_call',
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  timestamp: '2024-01-15T10:30:00.000Z',
};

const VALID_RESPONSE_BASE = {
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  success: true,
  durationMs: 150,
};

describe('toolInvocationRequestBaseSchema', () => {
  it('parses valid request base', () => {
    const result = toolInvocationRequestBaseSchema.parse(VALID_REQUEST_BASE);
    expect(result.botId).toBe(VALID_REQUEST_BASE.botId);
    expect(result.executionId).toBe(VALID_REQUEST_BASE.executionId);
    expect(result.toolName).toBe('llm_call');
    expect(result.invocationId).toBe(VALID_REQUEST_BASE.invocationId);
    expect(result.timestamp).toBe(VALID_REQUEST_BASE.timestamp);
  });

  it('parses request base with all tool names', () => {
    for (const toolName of TOOL_NAMES) {
      const result = toolInvocationRequestBaseSchema.parse({
        ...VALID_REQUEST_BASE,
        toolName,
      });
      expect(result.toolName).toBe(toolName);
    }
  });

  it('throws on missing required botId field', () => {
    const { botId: _botId, ...withoutBotId } = VALID_REQUEST_BASE;
    expect(() => toolInvocationRequestBaseSchema.parse(withoutBotId)).toThrow(z.ZodError);
  });

  it('throws on missing required executionId field', () => {
    const { executionId: _executionId, ...withoutExecutionId } = VALID_REQUEST_BASE;
    expect(() => toolInvocationRequestBaseSchema.parse(withoutExecutionId)).toThrow(z.ZodError);
  });

  it('throws on missing required toolName field', () => {
    const { toolName: _toolName, ...withoutToolName } = VALID_REQUEST_BASE;
    expect(() => toolInvocationRequestBaseSchema.parse(withoutToolName)).toThrow(z.ZodError);
  });

  it('throws on missing required invocationId field', () => {
    const { invocationId: _invocationId, ...withoutInvocationId } = VALID_REQUEST_BASE;
    expect(() => toolInvocationRequestBaseSchema.parse(withoutInvocationId)).toThrow(z.ZodError);
  });

  it('throws on missing required timestamp field', () => {
    const { timestamp: _timestamp, ...withoutTimestamp } = VALID_REQUEST_BASE;
    expect(() => toolInvocationRequestBaseSchema.parse(withoutTimestamp)).toThrow(z.ZodError);
  });

  it('throws on wrong type for botId', () => {
    const result = { ...VALID_REQUEST_BASE, botId: 'not-a-uuid' };
    expect(() => toolInvocationRequestBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for executionId', () => {
    const result = { ...VALID_REQUEST_BASE, executionId: 123 };
    expect(() => toolInvocationRequestBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for invocationId', () => {
    const result = { ...VALID_REQUEST_BASE, invocationId: 'not-a-uuid' };
    expect(() => toolInvocationRequestBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid timestamp format', () => {
    const result = { ...VALID_REQUEST_BASE, timestamp: '2024-01-15' };
    expect(() => toolInvocationRequestBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid ISO datetime (missing timezone)', () => {
    const result = { ...VALID_REQUEST_BASE, timestamp: '2024-01-15T10:30:00' };
    expect(() => toolInvocationRequestBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = toolInvocationRequestBaseSchema.parse({
      ...VALID_REQUEST_BASE,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('toolInvocationResponseBaseSchema', () => {
  it('parses valid response base with success', () => {
    const result = toolInvocationResponseBaseSchema.parse(VALID_RESPONSE_BASE);
    expect(result.invocationId).toBe(VALID_RESPONSE_BASE.invocationId);
    expect(result.success).toBe(true);
    expect(result.durationMs).toBe(150);
    expect(result.error).toBeUndefined();
  });

  it('parses response base with success false and error', () => {
    const withError = {
      ...VALID_RESPONSE_BASE,
      success: false,
      error: 'Tool execution failed: connection timeout',
    };
    const result = toolInvocationResponseBaseSchema.parse(withError);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Tool execution failed: connection timeout');
  });

  it('parses response base without error field', () => {
    const result = toolInvocationResponseBaseSchema.parse(VALID_RESPONSE_BASE);
    expect(result.error).toBeUndefined();
  });

  it('throws on missing required invocationId field', () => {
    const { invocationId: _invocationId, ...withoutInvocationId } = VALID_RESPONSE_BASE;
    expect(() => toolInvocationResponseBaseSchema.parse(withoutInvocationId)).toThrow(z.ZodError);
  });

  it('throws on missing required success field', () => {
    const { success: _success, ...withoutSuccess } = VALID_RESPONSE_BASE;
    expect(() => toolInvocationResponseBaseSchema.parse(withoutSuccess)).toThrow(z.ZodError);
  });

  it('throws on missing required durationMs field', () => {
    const { durationMs: _durationMs, ...withoutDurationMs } = VALID_RESPONSE_BASE;
    expect(() => toolInvocationResponseBaseSchema.parse(withoutDurationMs)).toThrow(z.ZodError);
  });

  it('throws on wrong type for success', () => {
    const result = { ...VALID_RESPONSE_BASE, success: 'yes' };
    expect(() => toolInvocationResponseBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for durationMs', () => {
    const result = { ...VALID_RESPONSE_BASE, durationMs: 'fast' };
    expect(() => toolInvocationResponseBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on negative durationMs', () => {
    const result = { ...VALID_RESPONSE_BASE, durationMs: -1 };
    expect(() => toolInvocationResponseBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer durationMs', () => {
    const result = { ...VALID_RESPONSE_BASE, durationMs: 150.5 };
    expect(() => toolInvocationResponseBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for error', () => {
    const result = { ...VALID_RESPONSE_BASE, error: 123 };
    expect(() => toolInvocationResponseBaseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = toolInvocationResponseBaseSchema.parse({
      ...VALID_RESPONSE_BASE,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});

describe('TOOL_NAMES', () => {
  it('contains all expected tool names', () => {
    expect(TOOL_NAMES).toContain('llm_call');
    expect(TOOL_NAMES).toContain('fetch_url');
    expect(TOOL_NAMES).toContain('write_file');
  });

  it('has exactly 3 tool names', () => {
    expect(TOOL_NAMES).toHaveLength(3);
  });

  it('is a readonly array', () => {
    expect(Object.isFrozen(TOOL_NAMES)).toBe(true);
  });
});