import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBetterAuth = vi.fn().mockReturnValue({
  handler: vi.fn(),
});
const mockDrizzleAdapter = vi.fn().mockReturnValue({ adapter: 'drizzle' });

vi.mock('better-auth', () => ({
  betterAuth: mockBetterAuth,
}));

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: mockDrizzleAdapter,
}));

vi.mock('@claw/db', () => ({
  db: { mockDb: true },
  authUsers: { table: 'auth_users' },
  authSessions: { table: 'auth_sessions' },
  authAccounts: { table: 'auth_accounts' },
  authVerifications: { table: 'auth_verifications' },
}));

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('betterAuth configuration', () => {
    it('uses dev-secret-change-me when AUTH_SECRET is not set', async () => {
      // AUTH_SECRET uses ?? so only undefined/missing triggers the fallback
      delete process.env['AUTH_SECRET'];

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'dev-secret-change-me',
        }),
      );
    });

    it('uses AUTH_SECRET from environment when set', async () => {
      vi.stubEnv('AUTH_SECRET', 'my-production-secret');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'my-production-secret',
        }),
      );
    });

    it('sets basePath to /auth', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          basePath: '/auth',
        }),
      );
    });

    it('disables email and password auth', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAndPassword: { enabled: false },
        }),
      );
    });
  });

  describe('drizzle adapter', () => {
    it('passes db instance with pg provider and auth schema tables', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');

      await import('../auth.js');

      expect(mockDrizzleAdapter).toHaveBeenCalledWith(
        { mockDb: true },
        {
          provider: 'pg',
          schema: {
            user: { table: 'auth_users' },
            session: { table: 'auth_sessions' },
            account: { table: 'auth_accounts' },
            verification: { table: 'auth_verifications' },
          },
        },
      );
    });
  });

  describe('social providers', () => {
    it('configures Google OAuth with environment variables', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id-123');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret-456');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          socialProviders: {
            google: {
              clientId: 'google-client-id-123',
              clientSecret: 'google-client-secret-456',
            },
          },
        }),
      );
    });

    it('defaults Google credentials to empty strings when env vars are missing', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      // Do not stub GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          socialProviders: {
            google: {
              clientId: '',
              clientSecret: '',
            },
          },
        }),
      );
    });
  });

  describe('trusted origins', () => {
    it('defaults to localhost:5173 when TRUSTED_ORIGINS is not set', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          trustedOrigins: ['http://localhost:5173'],
        }),
      );
    });

    it('splits comma-separated TRUSTED_ORIGINS into array', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      vi.stubEnv('TRUSTED_ORIGINS', 'https://app.example.com, https://staging.example.com');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          trustedOrigins: ['https://app.example.com', 'https://staging.example.com'],
        }),
      );
    });
  });

  describe('PUBLIC_URL handling', () => {
    it('sets baseURL from PUBLIC_URL origin when provided', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      vi.stubEnv('PUBLIC_URL', 'https://api.example.com/v1');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.example.com',
        }),
      );
    });

    it('does not set baseURL when PUBLIC_URL is not provided', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');

      await import('../auth.js');

      const config = mockBetterAuth.mock.calls[0]![0];
      expect(config).not.toHaveProperty('baseURL');
    });

    it('disables secure cookies for HTTP PUBLIC_URL', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      vi.stubEnv('PUBLIC_URL', 'http://localhost:3000');

      await import('../auth.js');

      expect(mockBetterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: { useSecureCookies: false },
        }),
      );
    });

    it('does not disable secure cookies for HTTPS PUBLIC_URL', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      vi.stubEnv('PUBLIC_URL', 'https://api.example.com');

      await import('../auth.js');

      const config = mockBetterAuth.mock.calls[0]![0];
      expect(config).not.toHaveProperty('advanced');
    });
  });
});
