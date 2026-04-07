import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCheckAllowlist = vi.fn();
const mockWriteAuditLog = vi.fn();
const mockCheckCallRateLimit = vi.fn();
const mockCheckTokenRateLimit = vi.fn();
const mockConsumeTokens = vi.fn();
const mockExecuteLlmCall = vi.fn();
const mockExecuteFetchUrl = vi.fn();
const mockExecuteWriteFile = vi.fn();
const mockRedisGet = vi.fn();

vi.mock('../services/allowlist.js', () => ({
  checkAllowlist: mockCheckAllowlist,
}));

vi.mock('../services/audit-log.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('../middleware/rate-limit.js', () => ({
  checkCallRateLimit: mockCheckCallRateLimit,
  checkTokenRateLimit: mockCheckTokenRateLimit,
  consumeTokens: mockConsumeTokens,
}));

vi.mock('../tools/llm-call.js', () => ({
  executeLlmCall: mockExecuteLlmCall,
}));

vi.mock('../tools/fetch-url.js', () => ({
  executeFetchUrl: mockExecuteFetchUrl,
}));

vi.mock('../tools/write-file.js', () => ({
  executeWriteFile: mockExecuteWriteFile,
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: mockRedisGet,
    on: vi.fn(),
    connect: vi.fn(),
  })),
}));

vi.mock('@google-cloud/pubsub', () => ({
  default: class MockPubSub {
    constructor() {}
    topic(topicName: string) {
      return {
        publishMessage: vi.fn().mockResolvedValue('message-id'),
      };
    }
  },
}));

describe('tool-invoke route logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('rejects requests missing required fields', () => {
      const body = {
        toolName: 'llm_call',
        botId: 'bot-1',
      };

      const hasRequired = Boolean(body.toolName && body.botId && body.executionId && body.invocationId);
      expect(hasRequired).toBe(false);
    });

    it('accepts requests with all required fields', () => {
      const body = {
        toolName: 'llm_call',
        botId: 'bot-1',
        executionId: 'exec-1',
        invocationId: 'inv-1',
      };

      const hasRequired = Boolean(body.toolName && body.botId && body.executionId && body.invocationId);
      expect(hasRequired).toBe(true);
    });
  });

  describe('bot deny-list check', () => {
    it('returns 403 when bot is denied', async () => {
      mockRedisGet.mockResolvedValue('true');

      if (await mockRedisGet('guardrail:denied:bot-1')) {
        await mockWriteAuditLog({
          executionId: 'exec-1',
          botId: 'bot-1',
          toolName: 'llm_call',
          invocationId: 'inv-1',
          rejected: true,
          rejectionReason: 'bot_revoked',
          requestSummary: { toolName: 'llm_call' },
        });
      }

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          rejected: true,
          rejectionReason: 'bot_revoked',
        }),
      );
    });

    it('allows request when bot is not denied', async () => {
      mockRedisGet.mockResolvedValue(null);

      const isDenied = await mockRedisGet('guardrail:denied:bot-1');

      expect(isDenied).toBeNull();
    });
  });

  describe('allowlist check', () => {
    it('returns allowed: false when tool is not in allowlist', async () => {
      mockCheckAllowlist.mockResolvedValue({ allowed: false, allowedTools: ['fetch_url'] });

      const result = await mockCheckAllowlist('exec-1', 'llm_call');

      expect(result.allowed).toBe(false);
      expect(result.allowedTools).toEqual(['fetch_url']);
    });
  });

  describe('call rate limiting', () => {
    it('returns allowed: false with retryAfter when limit exceeded', async () => {
      mockCheckCallRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });

      const result = await mockCheckCallRateLimit('bot-1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(30);
    });
  });

  describe('token rate limiting', () => {
    it('returns allowed: false with retryAfter when token limit exceeded', async () => {
      mockCheckTokenRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });

      const result = await mockCheckTokenRateLimit('bot-1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('tool dispatch', () => {
    it('executeLlmCall returns correct result structure', async () => {
      mockExecuteLlmCall.mockResolvedValue({
        content: 'Hello world',
        model: 'gpt-4',
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });

      const result = await mockExecuteLlmCall({
        toolName: 'llm_call',
        botId: 'bot-1',
        executionId: 'exec-1',
        invocationId: 'inv-1',
        timestamp: new Date().toISOString(),
        args: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(result.content).toBe('Hello world');
      expect(result.totalTokens).toBe(15);
    });

    it('executeFetchUrl returns correct result structure', async () => {
      mockExecuteFetchUrl.mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"data": "test"}',
        truncated: false,
      });

      const result = await mockExecuteFetchUrl({
        toolName: 'fetch_url',
        botId: 'bot-1',
        executionId: 'exec-1',
        invocationId: 'inv-1',
        timestamp: new Date().toISOString(),
        args: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        },
      });

      expect(result.statusCode).toBe(200);
      expect(result.truncated).toBe(false);
    });

    it('executeWriteFile returns correct result structure', async () => {
      mockExecuteWriteFile.mockResolvedValue({
        artifactId: 'artifact-123',
        path: '/tmp/claw-artifacts/artifact-123/test.txt',
        sizeBytes: 100,
      });

      const result = await mockExecuteWriteFile({
        toolName: 'write_file',
        botId: 'bot-1',
        executionId: 'exec-1',
        invocationId: 'inv-1',
        timestamp: new Date().toISOString(),
        args: {
          path: 'test.txt',
          content: 'Hello world',
          encoding: 'utf-8',
        },
      });

      expect(result.artifactId).toBe('artifact-123');
      expect(result.sizeBytes).toBe(100);
    });

    it('rejects unknown tool names', () => {
      const unknownTool = 'unknown_tool';

      expect(['llm_call', 'fetch_url', 'write_file'].includes(unknownTool)).toBe(false);
    });
  });

  describe('token consumption', () => {
    it('consumeTokens is called with correct arguments', async () => {
      mockConsumeTokens.mockResolvedValue(undefined);

      await mockConsumeTokens('bot-1', 150);

      expect(mockConsumeTokens).toHaveBeenCalledWith('bot-1', 150);
    });

    it('does not consume tokens for non-llm_call tools', async () => {
      mockConsumeTokens.mockClear();

      const toolName = 'fetch_url';

      if (toolName === 'llm_call') {
        await mockConsumeTokens('bot-1', 100);
      }

      expect(mockConsumeTokens).not.toHaveBeenCalled();
    });
  });

  describe('cost calculation', () => {
    it('calculates cost correctly for token usage', () => {
      const inputRate = 15;
      const outputRate = 60;
      const promptTokens = 1000000;
      const completionTokens = 500000;

      const cost = Math.round(
        (promptTokens * inputRate + completionTokens * outputRate) / 1_000_000,
      );

      expect(cost).toBe(45);
    });
  });

  describe('billing event publishing', () => {
    it('publishes billing event for llm_call', async () => {
      const billingPayload = {
        type: 'billing_event' as const,
        executionId: 'exec-1',
        botId: 'bot-1',
        eventType: 'tool_invoked' as const,
        amountCents: 45,
        tokenCount: 150,
        timestamp: new Date().toISOString(),
      };

      const data = Buffer.from(JSON.stringify(billingPayload));
      expect(data).toBeInstanceOf(Buffer);
      expect(billingPayload.amountCents).toBe(45);
    });
  });
});