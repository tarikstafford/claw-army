import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockEq = vi.fn();

vi.mock('@claw/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockInsert.mockReturnValue({
      values: mockValues.mockResolvedValue(undefined),
    }),
  },
  executions: {
    id: 'id',
    allowedTools: 'allowed_tools',
    allowedDomains: 'allowed_domains',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mockEq,
}));

describe('checkAllowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });
  });

  it('returns allowed: true when tool is in the allowlist', async () => {
    mockWhere.mockResolvedValue([
      { allowedTools: ['llm_call', 'fetch_url', 'write_file'] },
    ]);

    const { checkAllowlist } = await import('../services/allowlist.js');

    const result = await checkAllowlist('exec-123', 'llm_call');
    expect(result).toEqual({ allowed: true });
  });

  it('returns allowed: false with allowedTools when tool is not in the allowlist', async () => {
    mockWhere.mockResolvedValue([
      { allowedTools: ['fetch_url', 'write_file'] },
    ]);

    const { checkAllowlist } = await import('../services/allowlist.js');

    const result = await checkAllowlist('exec-123', 'llm_call');
    expect(result).toEqual({
      allowed: false,
      allowedTools: ['fetch_url', 'write_file'],
    });
  });

  it('returns allowed: false when execution is not found', async () => {
    mockWhere.mockResolvedValue([]);

    const { checkAllowlist } = await import('../services/allowlist.js');

    const result = await checkAllowlist('nonexistent-exec', 'llm_call');
    expect(result).toEqual({ allowed: false, allowedTools: [] });
  });

  it('returns allowed: false when execution has empty allowedTools', async () => {
    mockWhere.mockResolvedValue([{ allowedTools: [] }]);

    const { checkAllowlist } = await import('../services/allowlist.js');

    const result = await checkAllowlist('exec-123', 'llm_call');
    expect(result).toEqual({ allowed: false, allowedTools: [] });
  });

  it('handles tool names with special characters', async () => {
    mockWhere.mockResolvedValue([
      { allowedTools: ['tool_with_underscore', 'tool-with-dash'] },
    ]);

    const { checkAllowlist } = await import('../services/allowlist.js');

    const result = await checkAllowlist('exec-123', 'tool_with_underscore');
    expect(result).toEqual({ allowed: true });
  });
});