import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { fetchUrlRequestSchema, fetchUrlResponseSchema } from '../fetch-url';

const VALID_REQUEST_ARGS = {
  url: 'https://example.com/api/data',
  method: 'GET' as const,
  headers: { 'Content-Type': 'application/json' },
  body: undefined,
};

const VALID_REQUEST = {
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  toolName: 'fetch_url',
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  timestamp: '2024-01-15T10:30:00.000Z',
  args: VALID_REQUEST_ARGS,
};

const VALID_RESPONSE = {
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  success: true,
  durationMs: 250,
  result: {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: '{"data":"test"}',
    truncated: false,
  },
};

describe('fetchUrlRequestSchema', () => {
  it('parses valid fetch url request', () => {
    const result = fetchUrlRequestSchema.parse(VALID_REQUEST);
    expect(result.toolName).toBe('fetch_url');
    expect(result.args.url).toBe('https://example.com/api/data');
    expect(result.args.method).toBe('GET');
  });

  it('parses request with all HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'] as const;
    for (const method of methods) {
      const result = fetchUrlRequestSchema.parse({
        ...VALID_REQUEST,
        args: { ...VALID_REQUEST_ARGS, method },
      });
      expect(result.args.method).toBe(method);
    }
  });

  it('parses request with optional headers omitted', () => {
    const result = fetchUrlRequestSchema.parse({
      ...VALID_REQUEST,
      args: { url: 'https://example.com' },
    });
    expect(result.args.headers).toBeUndefined();
  });

  it('parses request with body', () => {
    const result = fetchUrlRequestSchema.parse({
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, body: '{"key":"value"}' },
    });
    expect(result.args.body).toBe('{"key":"value"}');
  });

  it('throws on invalid URL format', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, url: 'not-a-url' },
    };
    expect(() => fetchUrlRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on missing required url in args', () => {
    const { url: _url, ...withoutUrl } = VALID_REQUEST_ARGS;
    expect(() => fetchUrlRequestSchema.parse({
      ...VALID_REQUEST,
      args: withoutUrl,
    })).toThrow(z.ZodError);
  });

  it('throws on missing required method in args', () => {
    const { method: _method, ...withoutMethod } = VALID_REQUEST_ARGS;
    expect(() => fetchUrlRequestSchema.parse({
      ...VALID_REQUEST,
      args: withoutMethod,
    })).toThrow(z.ZodError);
  });

  it('throws on invalid method value', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, method: 'PATCH' },
    };
    expect(() => fetchUrlRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for headers', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, headers: 'not-an-object' },
    };
    expect(() => fetchUrlRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for body', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, body: 123 },
    };
    expect(() => fetchUrlRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on missing required toolName', () => {
    const { toolName: _toolName, ...withoutToolName } = VALID_REQUEST;
    expect(() => fetchUrlRequestSchema.parse(withoutToolName)).toThrow(z.ZodError);
  });

  it('throws on wrong toolName literal', () => {
    const result = { ...VALID_REQUEST, toolName: 'llm_call' };
    expect(() => fetchUrlRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = fetchUrlRequestSchema.parse({
      ...VALID_REQUEST,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });

  it('strips extra fields in args by default', () => {
    const result = fetchUrlRequestSchema.parse({
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, extraField: 'should be removed' },
    });
    expect(result.args).not.toHaveProperty('extraField');
  });
});

describe('fetchUrlResponseSchema', () => {
  it('parses valid fetch url response', () => {
    const result = fetchUrlResponseSchema.parse(VALID_RESPONSE);
    expect(result.success).toBe(true);
    expect(result.result?.statusCode).toBe(200);
    expect(result.result?.body).toBe('{"data":"test"}');
  });

  it('parses response with success true and result', () => {
    const result = fetchUrlResponseSchema.parse(VALID_RESPONSE);
    expect(result.result?.truncated).toBe(false);
    expect(result.result?.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('parses response with success false (no result)', () => {
    const noResult = {
      invocationId: '550e8400-e29b-41d4-a716-446655440002',
      success: false,
      durationMs: 100,
    };
    const result = fetchUrlResponseSchema.parse(noResult);
    expect(result.success).toBe(false);
    expect(result.result).toBeUndefined();
  });

  it('parses response with success false and error', () => {
    const withError = {
      ...VALID_RESPONSE,
      success: false,
      result: undefined,
      error: 'Connection refused',
    };
    const result = fetchUrlResponseSchema.parse(withError);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('throws on missing required invocationId', () => {
    const { invocationId: _invocationId, ...withoutInvocationId } = VALID_RESPONSE;
    expect(() => fetchUrlResponseSchema.parse(withoutInvocationId)).toThrow(z.ZodError);
  });

  it('throws on missing required success', () => {
    const { success: _success, ...withoutSuccess } = VALID_RESPONSE;
    expect(() => fetchUrlResponseSchema.parse(withoutSuccess)).toThrow(z.ZodError);
  });

  it('throws on missing required durationMs', () => {
    const { durationMs: _durationMs, ...withoutDurationMs } = VALID_RESPONSE;
    expect(() => fetchUrlResponseSchema.parse(withoutDurationMs)).toThrow(z.ZodError);
  });

  it('throws on wrong type for statusCode', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, statusCode: '200' },
    };
    expect(() => fetchUrlResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for headers', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, headers: 'not-an-object' },
    };
    expect(() => fetchUrlResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for body', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, body: 123 },
    };
    expect(() => fetchUrlResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for truncated', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, truncated: 'false' },
    };
    expect(() => fetchUrlResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = fetchUrlResponseSchema.parse({
      ...VALID_RESPONSE,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});