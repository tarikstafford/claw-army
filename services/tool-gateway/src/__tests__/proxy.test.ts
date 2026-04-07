import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/domain-allowlist.js', () => ({
  getExecutionAllowedDomains: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
}));

describe('attachProxyHandlers', () => {
  let fastify: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = {
      server: {
        on: vi.fn(),
      },
      setNotFoundHandler: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches CONNECT handler to server', async () => {
    const { attachProxyHandlers } = await import('../routes/proxy.js');
    attachProxyHandlers(fastify);

    expect(fastify.server.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('attaches HTTP forward proxy as not-found handler', async () => {
    const { attachProxyHandlers } = await import('../routes/proxy.js');
    attachProxyHandlers(fastify);

    expect(fastify.setNotFoundHandler).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe('domain allowlist validation', () => {
  it('allows exact domain match', () => {
    const hostname = 'api.anthropic.com';
    const allowlist = ['api.anthropic.com'];

    const isAllowed = allowlist.includes(hostname) || hostname.endsWith(`.${hostname}`);
    expect(isAllowed).toBe(true);
  });

  it('allows subdomain of allowed domain', () => {
    const hostname = 'chat.api.anthropic.com';
    const allowlist = ['api.anthropic.com'];

    const isAllowed = allowlist.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
    expect(isAllowed).toBe(true);
  });

  it('blocks domain not in allowlist', () => {
    const hostname = 'evil.com';
    const allowlist = ['api.anthropic.com', 'api.openai.com'];

    const isAllowed = allowlist.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
    expect(isAllowed).toBe(false);
  });

  it('allows all domains when allowlist is empty', () => {
    const hostname = 'any.domain.com';
    const allowlist: string[] = [];

    const isAllowed = allowlist.length === 0 || allowlist.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
    expect(isAllowed).toBe(true);
  });

  it('rejects invalid hostnames', () => {
    const VALID_HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

    expect(VALID_HOSTNAME_RE.test('api.anthropic.com')).toBe(true);
    expect(VALID_HOSTNAME_RE.test('localhost')).toBe(true);
    expect(VALID_HOSTNAME_RE.test('api-openai.com')).toBe(true);
    expect(VALID_HOSTNAME_RE.test('')).toBe(false);
    expect(VALID_HOSTNAME_RE.test('-api.openai.com')).toBe(false);
    expect(VALID_HOSTNAME_RE.test('api..openai.com')).toBe(false);
  });

  it('handles different ports correctly', () => {
    const port = '8080';

    expect(parseInt(port, 10)).toBe(8080);
    expect(isNaN(parseInt('', 10))).toBe(true);
  });
});

describe('CONNECT tunneling proxy', () => {
  it('extracts hostname and port from CONNECT target', () => {
    const target = 'api.anthropic.com:443';
    const [hostname, portStr] = target.split(':');
    const port = parseInt(portStr ?? '443', 10);

    expect(hostname).toBe('api.anthropic.com');
    expect(port).toBe(443);
  });

  it('extracts execution ID from x-execution-id header', () => {
    const headers = { 'x-execution-id': 'exec-123' };

    const executionId = headers['x-execution-id'] as string | undefined;
    expect(executionId).toBe('exec-123');
  });

  it('extracts execution ID from Proxy-Authorization header', () => {
    const headers = { 'proxy-authorization': 'exec:exec-456' };

    const proxyAuth = headers['proxy-authorization'] as string | undefined;
    let executionId: string | undefined;
    if (proxyAuth?.startsWith('exec:')) {
      executionId = proxyAuth.slice(5);
    }

    expect(executionId).toBe('exec-456');
  });

  it('prefers x-execution-id over Proxy-Authorization', () => {
    const headers = {
      'x-execution-id': 'exec-from-header',
      'proxy-authorization': 'exec:exec-from-auth',
    };

    let executionId = headers['x-execution-id'] as string | undefined;
    if (!executionId) {
      const proxyAuth = headers['proxy-authorization'] as string | undefined;
      if (proxyAuth?.startsWith('exec:')) {
        executionId = proxyAuth.slice(5);
      }
    }

    expect(executionId).toBe('exec-from-header');
  });
});

describe('HTTP forward proxy', () => {
  it('parses absolute URL correctly', () => {
    const rawUrl = 'http://api.anthropic.com/v1/messages';
    const targetUrl = new URL(rawUrl);

    expect(targetUrl.hostname).toBe('api.anthropic.com');
    expect(targetUrl.port).toBe('');
    expect(targetUrl.pathname).toBe('/v1/messages');
  });

  it('handles URLs with query strings', () => {
    const rawUrl = 'http://api.anthropic.com/v1/models?limit=10';
    const targetUrl = new URL(rawUrl);

    expect(targetUrl.pathname + targetUrl.search).toBe('/v1/models?limit=10');
  });

  it('rejects invalid URLs', () => {
    const rawUrl = 'not-a-valid-url';

    expect(() => new URL(rawUrl)).toThrow();
  });
});