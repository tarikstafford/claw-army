import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { adminRoutes } from '../../routes/admin.js';
import { pruneDecisionTraces } from '../../performance/attribution-compiler.js';

vi.mock('@claw/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('@google-cloud/compute', () => {
  const mockListAsync = vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: vi.fn().mockImplementation(function* () {
      yield { done: false, value: {} };
    }),
  });
  return {
    InstancesClient: vi.fn().mockImplementation(() => ({
      listAsync: mockListAsync,
    })),
  };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('../../queue/task-queue.js', () => ({
  taskQueue: {
    getJobCounts: vi.fn(),
  },
}));

vi.mock('../../performance/attribution-compiler.js', () => ({
  pruneDecisionTraces: vi.fn(),
}));

describe('adminRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(adminRoutes, { prefix: '/admin' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /admin/cleanup/decision-traces', () => {
    it('returns 200 with deleted count on success', async () => {
      vi.mocked(pruneDecisionTraces).mockResolvedValue({ deleted: 1234 });

      const res = await app.inject({
        method: 'POST',
        url: '/admin/cleanup/decision-traces',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.deleted).toBe(1234);
      expect(pruneDecisionTraces).toHaveBeenCalledOnce();
    });

    it('returns 200 with deleted:0 when nothing to prune', async () => {
      vi.mocked(pruneDecisionTraces).mockResolvedValue({ deleted: 0 });

      const res = await app.inject({
        method: 'POST',
        url: '/admin/cleanup/decision-traces',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.deleted).toBe(0);
    });
  });

  describe('POST /admin/waitlist', () => {
    it('returns 200 for valid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/waitlist',
        payload: { email: 'test@example.com' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
    });

    it('returns 400 when email lacks @', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/waitlist',
        payload: { email: 'notanemail' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('valid email');
    });

    it('returns 400 when email is too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/waitlist',
        payload: { email: 'ab' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /admin/health', () => {
    it('returns 200 when all subsystems are healthy', async () => {
      const { db } = await import('@claw/db');
      const { default: IORedis } = await import('ioredis');
      const { taskQueue } = await import('../../queue/task-queue.js');

      vi.mocked(db.execute).mockResolvedValue({} as any);
      IORedis.mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue('PONG'),
        disconnect: vi.fn().mockResolvedValue(undefined),
      }));
      vi.mocked(taskQueue.getJobCounts).mockResolvedValue({ waiting: 0, active: 0, failed: 0 });

      const res = await app.inject({
        method: 'GET',
        url: '/admin/health',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('healthy');
      expect(body.subsystems.gce.ok).toBe(true);
      expect(body.subsystems.cloudSQL.ok).toBe(true);
      expect(body.subsystems.redis.ok).toBe(true);
      expect(body.subsystems.bullMQ.ok).toBe(true);
    });

    it('returns 503 when a subsystem is unhealthy', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.execute).mockRejectedValue(new Error('connection refused'));

      const res = await app.inject({
        method: 'GET',
        url: '/admin/health',
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('degraded');
    });
  });
});
