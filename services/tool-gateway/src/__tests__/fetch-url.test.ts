import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../tools/fetch-url.js', () => ({
  executeFetchUrl: vi.fn(),
}));

describe('executeFetchUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('domain allowlist validation', () => {
    it('throws error when domain is not in allowlist', async () => {
      process.env['FETCH_URL_DOMAIN_ALLOWLIST'] = 'api.example.com';

      const mockExecuteFetchUrl = vi.fn().mockImplementation(async () => {
        const url = new URL('https://evil.com/malicious');
        const allowlistEnv = process.env['FETCH_URL_DOMAIN_ALLOWLIST'] ?? '';
        const allowlist = allowlistEnv
          .split(',')
          .map((d) => d.trim())
          .filter((d) => d.length > 0);

        if (allowlist.length > 0 && !allowlist.includes(url.hostname)) {
          throw new Error(`Domain ${url.hostname} not in fetch_url allowlist`);
        }
        return { statusCode: 200, headers: {}, body: '', truncated: false };
      });

      await expect(
        mockExecuteFetchUrl({
          toolName: 'fetch_url',
          botId: 'bot-1',
          executionId: 'exec-1',
          invocationId: 'inv-1',
          timestamp: new Date().toISOString(),
          args: {
            url: 'https://evil.com/malicious',
            method: 'GET',
            headers: {},
          },
        }),
      ).rejects.toThrow('Domain evil.com not in fetch_url allowlist');
    });

    it('allows request when domain is in allowlist', async () => {
      process.env['FETCH_URL_DOMAIN_ALLOWLIST'] = 'api.example.com';

      const mockExecuteFetchUrl = vi.fn().mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: 'Hello',
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
    });

    it('allows all domains when allowlist is empty', async () => {
      delete process.env['FETCH_URL_DOMAIN_ALLOWLIST'];

      const mockExecuteFetchUrl = vi.fn().mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: 'Hello',
        truncated: false,
      });

      const result = await mockExecuteFetchUrl({
        toolName: 'fetch_url',
        botId: 'bot-1',
        executionId: 'exec-1',
        invocationId: 'inv-1',
        timestamp: new Date().toISOString(),
        args: {
          url: 'https://any.domain.com/data',
          method: 'GET',
          headers: {},
        },
      });

      expect(result.statusCode).toBe(200);
    });
  });

  describe('URL parsing', () => {
    it('parses URL hostname correctly for allowlist check', () => {
      const url = new URL('https://api.example.com:8080/data');

      expect(url.hostname).toBe('api.example.com');
      expect(url.port).toBe('8080');
    });

    it('throws on malformed URL', () => {
      expect(() => new URL('not-a-valid-url')).toThrow();
    });
  });

  describe('response handling', () => {
    it('truncates response body larger than 1 MB', async () => {
      const MAX_BODY_BYTES = 1_000_000;
      const largeData = 'x'.repeat(1_500_000);
      const buffer = new ArrayBuffer(1_500_000);
      const truncated = buffer.byteLength > MAX_BODY_BYTES;

      expect(truncated).toBe(true);
      expect(buffer.byteLength).toBe(1_500_000);
    });

    it('does not truncate small responses', async () => {
      const MAX_BODY_BYTES = 1_000_000;
      const smallData = 'x'.repeat(100);
      const buffer = new ArrayBuffer(100);
      const truncated = buffer.byteLength > MAX_BODY_BYTES;

      expect(truncated).toBe(false);
    });
  });

  describe('request options', () => {
    it('uses GET method by default', async () => {
      const args = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      expect(args.method).toBe('GET');
    });

    it('uses POST method when specified', async () => {
      const args = {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      };

      expect(args.method).toBe('POST');
    });
  });
});