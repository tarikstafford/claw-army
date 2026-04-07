import { describe, it, expect, vi, beforeEach } from 'vitest';

const jwtVerify = vi.fn();

vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock.jwt.token'),
  })),
  jwtVerify,
}));

vi.stubEnv('BOT_JWT_SECRET', 'test-secret-key-for-unit-tests');

describe('session-jwt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifySessionJwt', () => {
    it('returns decoded payload when token is valid', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          taskId: 'task-001',
          toolAllowlist: ['tool-a'],
          thirdPartyGrants: [],
          budgetAllocationCents: 100,
          runtimeLimitSeconds: 1800,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      const result = await verifySessionJwt('valid.jwt.token');

      expect(result.soulId).toBe('soul-001');
      expect(result.taskId).toBe('task-001');
      expect(result.toolAllowlist).toEqual(['tool-a']);
      expect(result.ringLeaderRunId).toBe('run-001');
    });

    it('throws when soulId is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          taskId: 'task-001',
          toolAllowlist: [],
          thirdPartyGrants: [],
          budgetAllocationCents: 100,
          runtimeLimitSeconds: 1800,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing soulId in payload',
      );
    });

    it('throws when taskId is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          toolAllowlist: [],
          thirdPartyGrants: [],
          budgetAllocationCents: 100,
          runtimeLimitSeconds: 1800,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing taskId in payload',
      );
    });

    it('throws when toolAllowlist is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          taskId: 'task-001',
          thirdPartyGrants: [],
          budgetAllocationCents: 100,
          runtimeLimitSeconds: 1800,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing toolAllowlist in payload',
      );
    });

    it('throws when thirdPartyGrants is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          taskId: 'task-001',
          toolAllowlist: [],
          budgetAllocationCents: 100,
          runtimeLimitSeconds: 1800,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing thirdPartyGrants in payload',
      );
    });

    it('throws when budgetAllocationCents is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          taskId: 'task-001',
          toolAllowlist: [],
          thirdPartyGrants: [],
          runtimeLimitSeconds: 1800,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing budgetAllocationCents in payload',
      );
    });

    it('throws when runtimeLimitSeconds is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          taskId: 'task-001',
          toolAllowlist: [],
          thirdPartyGrants: [],
          budgetAllocationCents: 100,
          ringLeaderRunId: 'run-001',
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing runtimeLimitSeconds in payload',
      );
    });

    it('throws when ringLeaderRunId is missing from payload', async () => {
      const { verifySessionJwt } = await import('../../services/session-jwt.js');
      jwtVerify.mockResolvedValue({
        payload: {
          soulId: 'soul-001',
          taskId: 'task-001',
          toolAllowlist: [],
          thirdPartyGrants: [],
          budgetAllocationCents: 100,
          runtimeLimitSeconds: 1800,
        },
      } as any);

      await expect(verifySessionJwt('invalid.jwt.token')).rejects.toThrow(
        'Invalid session JWT: missing ringLeaderRunId in payload',
      );
    });
  });
});
