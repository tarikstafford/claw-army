import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { writeFileRequestSchema, writeFileResponseSchema } from '../write-file';

const VALID_REQUEST_ARGS = {
  path: '/workspace/output.txt',
  content: 'Hello, world!',
  encoding: 'utf-8' as const,
};

const VALID_REQUEST = {
  botId: '550e8400-e29b-41d4-a716-446655440000',
  executionId: '550e8400-e29b-41d4-a716-446655440001',
  toolName: 'write_file',
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  timestamp: '2024-01-15T10:30:00.000Z',
  args: VALID_REQUEST_ARGS,
};

const VALID_RESPONSE = {
  invocationId: '550e8400-e29b-41d4-a716-446655440002',
  success: true,
  durationMs: 100,
  result: {
    artifactId: '550e8400-e29b-41d4-a716-446655440099',
    path: '/workspace/output.txt',
    sizeBytes: 13,
  },
};

describe('writeFileRequestSchema', () => {
  it('parses valid write file request', () => {
    const result = writeFileRequestSchema.parse(VALID_REQUEST);
    expect(result.toolName).toBe('write_file');
    expect(result.args.path).toBe('/workspace/output.txt');
    expect(result.args.content).toBe('Hello, world!');
    expect(result.args.encoding).toBe('utf-8');
  });

  it('parses request with utf-8 encoding', () => {
    const result = writeFileRequestSchema.parse({
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, encoding: 'utf-8' },
    });
    expect(result.args.encoding).toBe('utf-8');
  });

  it('parses request with base64 encoding', () => {
    const result = writeFileRequestSchema.parse({
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, encoding: 'base64' },
    });
    expect(result.args.encoding).toBe('base64');
  });

  it('parses request with encoding omitted (uses default)', () => {
    const withoutEncoding = {
      ...VALID_REQUEST,
      args: { path: '/workspace/output.txt', content: 'Hello' },
    };
    const result = writeFileRequestSchema.parse(withoutEncoding);
    expect(result.args.encoding).toBe('utf-8');
  });

  it('throws on missing required path in args', () => {
    const { path: _path, ...withoutPath } = VALID_REQUEST_ARGS;
    expect(() => writeFileRequestSchema.parse({
      ...VALID_REQUEST,
      args: withoutPath,
    })).toThrow(z.ZodError);
  });

  it('throws on missing required content in args', () => {
    const { content: _content, ...withoutContent } = VALID_REQUEST_ARGS;
    expect(() => writeFileRequestSchema.parse({
      ...VALID_REQUEST,
      args: withoutContent,
    })).toThrow(z.ZodError);
  });

  it('throws on invalid encoding value', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, encoding: 'utf-16' },
    };
    expect(() => writeFileRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for path', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, path: 123 },
    };
    expect(() => writeFileRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for content', () => {
    const result = {
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, content: { text: 'Hello' } },
    };
    expect(() => writeFileRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong toolName literal', () => {
    const result = { ...VALID_REQUEST, toolName: 'llm_call' };
    expect(() => writeFileRequestSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = writeFileRequestSchema.parse({
      ...VALID_REQUEST,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });

  it('strips extra fields in args by default', () => {
    const result = writeFileRequestSchema.parse({
      ...VALID_REQUEST,
      args: { ...VALID_REQUEST_ARGS, extraField: 'should be removed' },
    });
    expect(result.args).not.toHaveProperty('extraField');
  });
});

describe('writeFileResponseSchema', () => {
  it('parses valid write file response', () => {
    const result = writeFileResponseSchema.parse(VALID_RESPONSE);
    expect(result.success).toBe(true);
    expect(result.result?.artifactId).toBe('550e8400-e29b-41d4-a716-446655440099');
    expect(result.result?.path).toBe('/workspace/output.txt');
    expect(result.result?.sizeBytes).toBe(13);
  });

  it('parses response with success false (no result)', () => {
    const noResult = {
      invocationId: '550e8400-e29b-41d4-a716-446655440002',
      success: false,
      durationMs: 50,
    };
    const result = writeFileResponseSchema.parse(noResult);
    expect(result.success).toBe(false);
    expect(result.result).toBeUndefined();
  });

  it('parses response with success false and error', () => {
    const withError = {
      ...VALID_RESPONSE,
      success: false,
      result: undefined,
      error: 'Permission denied',
    };
    const result = writeFileResponseSchema.parse(withError);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('throws on missing required invocationId', () => {
    const { invocationId: _invocationId, ...withoutInvocationId } = VALID_RESPONSE;
    expect(() => writeFileResponseSchema.parse(withoutInvocationId)).toThrow(z.ZodError);
  });

  it('throws on missing required success', () => {
    const { success: _success, ...withoutSuccess } = VALID_RESPONSE;
    expect(() => writeFileResponseSchema.parse(withoutSuccess)).toThrow(z.ZodError);
  });

  it('throws on missing required durationMs', () => {
    const { durationMs: _durationMs, ...withoutDurationMs } = VALID_RESPONSE;
    expect(() => writeFileResponseSchema.parse(withoutDurationMs)).toThrow(z.ZodError);
  });

  it('throws on wrong type for artifactId', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, artifactId: 'not-a-uuid' },
    };
    expect(() => writeFileResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for path', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, path: 123 },
    };
    expect(() => writeFileResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on wrong type for sizeBytes', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, sizeBytes: 'thirteen' },
    };
    expect(() => writeFileResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on negative sizeBytes', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, sizeBytes: -1 },
    };
    expect(() => writeFileResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('throws on non-integer sizeBytes', () => {
    const result = {
      ...VALID_RESPONSE,
      result: { ...VALID_RESPONSE.result, sizeBytes: 13.5 },
    };
    expect(() => writeFileResponseSchema.parse(result)).toThrow(z.ZodError);
  });

  it('strips extra fields by default', () => {
    const result = writeFileResponseSchema.parse({
      ...VALID_RESPONSE,
      extraField: 'should be removed',
    });
    expect(result).not.toHaveProperty('extraField');
  });
});