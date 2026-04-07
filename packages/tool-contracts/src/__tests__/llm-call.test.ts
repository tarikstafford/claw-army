import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { llmCallRequestSchema, llmCallResponseSchema } from '../llm-call';

const VALID_REQUEST_ARGS = {
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  maxTokens: 1000,
  temperature: 0.7,
};

const VALID_REQUEST = {
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  toolName: 'llm_call',
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  timestamp: '2024-01-15T10:30:00.000Z',
  args: VALID_REQUEST_ARGS,
};

const VALID_RESPONSE = {
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  success: true,
  durationMs: 500,
  result: {
    content: 'Hello! How can I help you today?',
    model: 'gpt-4o',
    promptTokens: 20,
    completionTokens: 15,
    totalTokens: 35,
  },
};

describe('llmCallRequestSchema', () => {
  it('parses valid llm call request', () => {
    const result = llmCallRequestSchema.parse(VALID_REQUEST);
    expect(result.toolName).toBe('llm_call');
    expect(result.args.model).toBe('gpt-4o');
    expect(result.args.messages).toHaveLength(2);
  });

  it('parses request with all message roles', () => {
    const roles = ['system', 'user', 'assistant'] as const;
    for (const role of roles) {
      const result = llmCallRequestSchema.parse({
        ...VALID_REQUEST,
        args: {
          model: 'gpt-4o',
          messages: [{ role, content: 'test' }],
        },
      });
      expect(result.args.messages[0].role).toBe(role);
    }
  });

  it('parses request with optional fields omitted', () => {
    const result = llmCallRequestSchema.parse({
      ...VALID_REQUEST,
      args: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello!' }],
      },
    });
    expect(result.args.maxTokens).toBeUndefined();
    expect(result.args.temperature).toBeUndefined();
  });

  it('parses request with maxTokens and temperature', () => {
    const result = llmCallRequestSchema.parse(VALID_REQUEST);
    expect(result.args.maxTokens).toBe(1000);
    expect(result.args.temperature).toBe(0.7);
  });

  it('parses temperature at boundaries', () => {
    const minTemp = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, temperature: 0 },
    };
    const resultMin = llmCallRequestSchema.parse(minTemp);
    expect(resultMin.args.temperature).toBe(0);

    const maxTemp = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, temperature: 2 },
    };
    const resultMax = llmCallRequestSchema.parse(maxTemp);
    expect(resultMax.args.temperature).toBe(2);
  });

  it('throws on temperature below 0', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, temperature: -0.1 },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on temperature above 2', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, temperature: 2.1 },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on missing required model in args', () => {
    const { model: _model, ...withoutModel } = VALID_REQUEST_ARGS;
    expect(() => llmCallRequestSchema.parse({
      ...VALID_REQUEST,
      args: withoutModel,
    })).toThrow(z.ZodError);
  });

  it('throws on missing required messages in args', () => {
    const { messages: _messages, ...withoutMessages } = VALID_REQUEST_ARGS;
    expect(() => llmCallRequestSchema.parse({
      ...VALID_REQUEST,
      args: withoutMessages,
    })).toThrow(z.ZodError);
  });

  it('throws on empty messages array', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, messages: [] },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on invalid message role', () => {
    const result = {
      ...VALID_REQUEST,
      args: {
        ...VALID_REQUEST_ARGS,
        messages: [{ role: 'invalid', content: 'test' }],
      },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for maxTokens', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, maxTokens: 'thousand' },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-positive maxTokens', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, maxTokens: 0 },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer maxTokens', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, maxTokens: 100.5 },
    };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong toolName literal', () => {
    const result = { ...VALID_REQUEST, toolName: 'fetch_url' };
    expect(() => llmCallRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = llmCallRequestSchema.parse({
      ...VALID_REQUEST,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });

  it('strips extra fields in args by default', () => {
    const result = llmCallRequestSchema.parse({
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, extraField: 'should be removed' },
    });
    expect(result.args).not.toHaveProperty('extraField');
  });
});

describe('llmCallResponseSchema', () => {
  it('parses valid llm call response', () => {
    const result = llmCallResponseSchema.parse(VALID_RESPONSE);
    expect(result.success).toBe(true);
    expect(result.result?.content).toBe('Hello! How can I help you today?');
    expect(result.result?.totalTokens).toBe(35);
  });

  it('parses response with all token fields', () => {
    const result = llmCallResponseSchema.parse(VALID_RESPONSE);
    expect(result.result?.promptTokens).toBe(20);
    expect(result.result?.completionTokens).toBe(15);
    expect(result.result?.totalTokens).toBe(35);
  });

  it('parses response with success false (no result)', () => {
    const noResult = {
      invocationId: '550e8400-e29b-41d4-a716-446655440002',
      success: false,
      durationMs: 50,
    };
    const result = llmCallResponseSchema.parse(noResult);
    expect(result.success).toBe(false);
    expect(result.result).toBeUndefined();
  });

  it('parses response with success false and error', () => {
    const withError = {
      ...VALID_RESPONSE,
      success: false,
      result: undefined,
      error: 'Model unavailable',
    };
    const result = llmCallResponseSchema.parse(withError);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Model unavailable');
  });

  it('throws on missing required invocationId', () => {
    const { invocationId: _invocationId, ...withoutInvocationId } = VALID_RESPONSE;
    expect(() => llmCallResponseSchema.parse(withoutInvocationId)).toThrow(z.ZodError);
  });

  it('throws on missing required success', () => {
    const { success: _success, ...withoutSuccess } = VALID_RESPONSE;
    expect(() => llmCallResponseSchema.parse(withoutSuccess)).toThrow(z.ZodError);
  });

  it('throws on missing required durationMs', () => {
    const { durationMs: _durationMs, ...withoutDurationMs } = VALID_RESPONSE;
    expect(() => llmCallResponseSchema.parse(withoutDurationMs)).toThrow(z.ZodError);
  });

  it('throws on wrong type for content', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, content: 123 },
    };
    expect(() => llmCallResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for model', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, model: 123 },
    };
    expect(() => llmCallResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for promptTokens', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, promptTokens: 'twenty' },
    };
    expect(() => llmCallResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer promptTokens', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, promptTokens: 20.5 },
    };
    expect(() => llmCallResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = llmCallResponseSchema.parse({
      ...VALID_RESPONSE,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});