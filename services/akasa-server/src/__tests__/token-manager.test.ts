import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ─── Setup ────────────────────────────────────────────────────────────────────
const TEST_KEY = Buffer.from('a'.repeat(32), 'utf8').toString('base64');

beforeAll(() => {
  process.env['TOOL_ENCRYPTION_KEY'] = TEST_KEY;
});

// ─── Mock @claw/db ────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

vi.mock('@claw/db', () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhereFn = vi.fn();
  const mockLimit = vi.fn();

  // Chain: db.select().from().where().limit()
  mockLimit.mockResolvedValue([]);
  mockWhereFn.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhereFn });
  mockSelect.mockReturnValue({ from: mockFrom });

  return {
    db: {
      select: mockSelect,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
    toolConnections: {
      id: 'id',
      connectionType: 'connection_type',
      status: 'status',
      encryptedAccessToken: 'encrypted_access_token',
      encryptedRefreshToken: 'encrypted_refresh_token',
      encryptedApiKey: 'encrypted_api_key',
      tokenIv: 'token_iv',
      tokenTag: 'token_tag',
      refreshIv: 'refresh_iv',
      refreshTag: 'refresh_tag',
      apiKeyIv: 'api_key_iv',
      apiKeyTag: 'api_key_tag',
      tokenExpiresAt: 'token_expires_at',
      keyVersion: 'key_version',
      updatedAt: 'updated_at',
    },
    eq: vi.fn((a: unknown, b: unknown) => ({ eq: a, val: b })),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFarFutureExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60); // 60 minutes from now
  return d;
}

function buildNearFutureExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 3); // 3 minutes from now (< 5 min threshold)
  return d;
}

function buildPastExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 10); // 10 minutes ago
  return d;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getValidToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns decrypted API key for api_key connections without calling refreshFn', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const { db } = await import('@claw/db');

    const plainApiKey = 'my-api-key-value';
    const enc = encryptCredential(plainApiKey);

    const mockConnection = {
      id: 'conn-1',
      connectionType: 'api_key',
      status: 'connected',
      encryptedApiKey: enc.ciphertext,
      apiKeyIv: enc.iv,
      apiKeyTag: enc.tag,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenIv: null,
      tokenTag: null,
      tokenExpiresAt: null,
    };

    // Setup the mock chain to return our connection
    const mockLimit = vi.fn().mockResolvedValue([mockConnection]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const { getValidToken } = await import('../services/token-manager.js');
    const refreshFn = vi.fn();

    const result = await getValidToken('conn-1', refreshFn);
    expect(result).toBe(plainApiKey);
    expect(refreshFn).not.toHaveBeenCalled();
  });

  it('returns decrypted access token when token has >5 min remaining', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const { db } = await import('@claw/db');

    const plainToken = 'access-token-fresh';
    const enc = encryptCredential(plainToken);

    const mockConnection = {
      id: 'conn-2',
      connectionType: 'oauth',
      status: 'connected',
      encryptedAccessToken: enc.ciphertext,
      tokenIv: enc.iv,
      tokenTag: enc.tag,
      encryptedRefreshToken: null,
      refreshIv: null,
      refreshTag: null,
      encryptedApiKey: null,
      tokenExpiresAt: buildFarFutureExpiry(),
    };

    const mockLimit = vi.fn().mockResolvedValue([mockConnection]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const { getValidToken } = await import('../services/token-manager.js');
    const refreshFn = vi.fn();

    const result = await getValidToken('conn-2', refreshFn);
    expect(result).toBe(plainToken);
    expect(refreshFn).not.toHaveBeenCalled();
  });

  it('calls refreshFn and re-encrypts when token expires within 5 min', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const { db } = await import('@claw/db');

    const oldToken = 'old-access-token';
    const oldRefreshToken = 'old-refresh-token';
    const newToken = 'new-access-token-refreshed';
    const newRefreshToken = 'new-refresh-token';

    const encAccess = encryptCredential(oldToken);
    const encRefresh = encryptCredential(oldRefreshToken);

    const mockConnection = {
      id: 'conn-3',
      connectionType: 'oauth',
      status: 'connected',
      encryptedAccessToken: encAccess.ciphertext,
      tokenIv: encAccess.iv,
      tokenTag: encAccess.tag,
      encryptedRefreshToken: encRefresh.ciphertext,
      refreshIv: encRefresh.iv,
      refreshTag: encRefresh.tag,
      encryptedApiKey: null,
      tokenExpiresAt: buildNearFutureExpiry(),
    };

    const mockLimit = vi.fn().mockResolvedValue([mockConnection]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const newExpiry = new Date(Date.now() + 3600 * 1000);
    const refreshFn = vi.fn().mockResolvedValue({
      accessToken: newToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiry,
    });

    // Setup update chain
    const mockReturning = vi.fn().mockResolvedValue([{ ...mockConnection, status: 'connected' }]);
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    const { getValidToken } = await import('../services/token-manager.js');
    const result = await getValidToken('conn-3', refreshFn);

    expect(refreshFn).toHaveBeenCalledWith(oldRefreshToken);
    expect(result).toBe(newToken);
  });

  it('calls refreshFn when token is already expired', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const { db } = await import('@claw/db');

    const oldToken = 'expired-access-token';
    const oldRefreshToken = 'expired-refresh-token';
    const newToken = 'refreshed-token-after-expiry';

    const encAccess = encryptCredential(oldToken);
    const encRefresh = encryptCredential(oldRefreshToken);

    const mockConnection = {
      id: 'conn-4',
      connectionType: 'oauth',
      status: 'expired',
      encryptedAccessToken: encAccess.ciphertext,
      tokenIv: encAccess.iv,
      tokenTag: encAccess.tag,
      encryptedRefreshToken: encRefresh.ciphertext,
      refreshIv: encRefresh.iv,
      refreshTag: encRefresh.tag,
      encryptedApiKey: null,
      tokenExpiresAt: buildPastExpiry(),
    };

    const mockLimit = vi.fn().mockResolvedValue([mockConnection]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const newExpiry = new Date(Date.now() + 3600 * 1000);
    const refreshFn = vi.fn().mockResolvedValue({
      accessToken: newToken,
      expiresAt: newExpiry,
    });

    const mockReturning = vi.fn().mockResolvedValue([{ ...mockConnection }]);
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    const { getValidToken } = await import('../services/token-manager.js');
    const result = await getValidToken('conn-4', refreshFn);

    expect(refreshFn).toHaveBeenCalledWith(oldRefreshToken);
    expect(result).toBe(newToken);
  });

  it('sets connection status to expired and rethrows when refreshFn throws', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const { db } = await import('@claw/db');

    const oldToken = 'expiring-access-token';
    const oldRefreshToken = 'bad-refresh-token';

    const encAccess = encryptCredential(oldToken);
    const encRefresh = encryptCredential(oldRefreshToken);

    const mockConnection = {
      id: 'conn-5',
      connectionType: 'oauth',
      status: 'connected',
      encryptedAccessToken: encAccess.ciphertext,
      tokenIv: encAccess.iv,
      tokenTag: encAccess.tag,
      encryptedRefreshToken: encRefresh.ciphertext,
      refreshIv: encRefresh.iv,
      refreshTag: encRefresh.tag,
      encryptedApiKey: null,
      tokenExpiresAt: buildNearFutureExpiry(),
    };

    const mockLimit = vi.fn().mockResolvedValue([mockConnection]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const refreshFn = vi.fn().mockRejectedValue(new Error('Token refresh failed: invalid_grant'));

    // Setup update chain for the error case
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    const { getValidToken } = await import('../services/token-manager.js');

    await expect(getValidToken('conn-5', refreshFn)).rejects.toThrow('Token refresh failed');
    // Verify the update was called to set status='expired'
    expect(db.update).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
  });
});
