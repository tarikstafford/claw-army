import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { decisionTracesRoutes } from '../../routes/decision-traces.js';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
  },
  decisionTraces: {},
}));

describe('decisionTracesRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(decisionTracesRoutes, { prefix: '/decision-traces' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  const mockTraces = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      decisionType: 'tool_call',
      directiveReferenced: 'Maximize conversion',
      attributionConfidence: '0.850',
      outcome: 'success',
      decidedAt: new Date('2025-01-01T10:00:00Z'),
      executionId: '223e4567-e89b-12d3-a456-426614174000',
    },
    {
      id: '323e4567-e89b-12d3-a456-426614174000',
      decisionType: 'output_step',
      directiveReferenced: null,
      attributionConfidence: null,
      outcome: 'success',
      decidedAt: new Date('2025-01-01T10:05:00Z'),
      executionId: '223e4567-e89b-12d3-a456-426614174000',
    },
  ];

  describe('GET /decision-traces/:botId', () => {
    it('returns paginated traces for a bot', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockTraces),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/decision-traces/123e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.traces).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.hasMore).toBe(false);
    });

    it('returns hasMore=true when there are more results', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([mockTraces[0]]),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/decision-traces/123e4567-e89b-12d3-a456-426614174000?limit=1&offset=0',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.hasMore).toBe(true);
    });

    it('uses default limit and offset', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/decision-traces/123e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.traces).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('accepts custom limit and offset', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 100 }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/decision-traces/123e4567-e89b-12d3-a456-426614174000?limit=25&offset=50',
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns traces with all fields correctly mapped', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([mockTraces[0]]),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/decision-traces/123e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.traces[0].decisionType).toBe('tool_call');
      expect(body.traces[0].directiveReferenced).toBe('Maximize conversion');
      expect(body.traces[0].attributionConfidence).toBe('0.850');
      expect(body.traces[0].outcome).toBe('success');
    });
  });
});
