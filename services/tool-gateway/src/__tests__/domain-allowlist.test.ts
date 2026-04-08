import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockEq = vi.fn();

vi.mock('@claw/db', () => ({
  db: {
    select: mockDbSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    }),
    insert: vi.fn(),
  },
  executions: {
    id: 'id',
    allowedDomains: 'allowed_domains',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mockEq,
}));

describe('getExecutionAllowedDomains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDbSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns domains from database when cache misses', async () => {
    mockWhere.mockResolvedValue([{ allowedDomains: ['api.anthropic.com', 'api.openai.com'] }]);

    const { getExecutionAllowedDomains } = await import('../services/domain-allowlist.js');

    const result = await getExecutionAllowedDomains('exec-123');
    expect(result).toEqual(['api.anthropic.com', 'api.openai.com']);
  });

  it('returns null when execution has no allowedDomains set', async () => {
    mockWhere.mockResolvedValue([{ allowedDomains: null }]);

    const { getExecutionAllowedDomains } = await import('../services/domain-allowlist.js');

    const result = await getExecutionAllowedDomains('exec-123');
    expect(result).toBeNull();
  });

  it('returns null when execution is not found', async () => {
    mockWhere.mockResolvedValue([]);

    const { getExecutionAllowedDomains } = await import('../services/domain-allowlist.js');

    const result = await getExecutionAllowedDomains('nonexistent-exec');
    expect(result).toBeNull();
  });

  it('uses cache on subsequent calls within TTL', async () => {
    mockWhere.mockResolvedValue([{ allowedDomains: ['cached.domain.com'] }]);

    const { getExecutionAllowedDomains } = await import('../services/domain-allowlist.js');

    await getExecutionAllowedDomains('exec-cached');

    mockWhere.mockResolvedValue([{ allowedDomains: ['different.domain.com'] }]);

    const result = await getExecutionAllowedDomains('exec-cached');

    expect(result).toEqual(['cached.domain.com']);
  });

  it('fetches fresh data after cache expires', async () => {
    vi.useFakeTimers();

    mockWhere.mockResolvedValue([{ allowedDomains: ['original.domain.com'] }]);

    const { getExecutionAllowedDomains } = await import('../services/domain-allowlist.js');

    await getExecutionAllowedDomains('exec-expire');

    mockWhere.mockResolvedValue([{ allowedDomains: ['fresh.domain.com'] }]);

    vi.advanceTimersByTime(61_000);

    const result = await getExecutionAllowedDomains('exec-expire');

    expect(result).toEqual(['fresh.domain.com']);

    vi.useRealTimers();
  });
});