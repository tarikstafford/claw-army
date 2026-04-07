import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { negativeSignalsRoutes } from '../../routes/negative-signals.js';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
  },
  negativeSignalRegister: {},
  botSouls: {},
}));

describe('negativeSignalsRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(negativeSignalsRoutes, { prefix: '/negative-signals' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  const mockSignals = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      soulId: '223e4567-e89b-12d3-a456-426614174000',
      botId: '323e4567-e89b-12d3-a456-426614174000',
      executionId: '423e4567-e89b-12d3-a456-426614174000',
      failureType: 'tool_rejection',
      directiveFailureSummary: 'Agent attempted to use forbidden tool',
      registeredAt: new Date('2025-01-01T10:00:00Z'),
      taskCategory: 'lead-generation',
      generation: 2,
    },
    {
      id: '523e4567-e89b-12d3-a456-426614174000',
      soulId: '623e4567-e89b-12d3-a456-426614174000',
      botId: '723e4567-e89b-12d3-a456-426614174000',
      executionId: null,
      failureType: 'timeout',
      directiveFailureSummary: null,
      registeredAt: new Date('2025-01-02T10:00:00Z'),
      taskCategory: 'data-analysis',
      generation: 1,
    },
  ];

  describe('GET /negative-signals', () => {
    it('returns paginated signals without filters', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockSignals),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              mockResolvedValue: [{ count: 2 }],
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.signals).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.hasMore).toBe(false);
    });

    it('returns hasMore=true when there are more results', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([mockSignals[0]]),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              mockResolvedValue: [{ count: 10 }],
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals?limit=1&offset=0',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.hasMore).toBe(true);
    });

    it('filters by failureType when provided', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([mockSignals[0]]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                mockResolvedValue: [{ count: 1 }],
              }),
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals?failureType=tool_rejection',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.signals[0].failureType).toBe('tool_rejection');
    });

    it('uses default limit and offset', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              mockResolvedValue: [{ count: 0 }],
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.signals).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('accepts custom limit and offset', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              mockResolvedValue: [{ count: 100 }],
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals?limit=25&offset=50',
      });

      expect(res.statusCode).toBe(200);
    });

    it('maps null generation to null in response', async () => {
      const { db } = await import('@claw/db');

      const signalWithNullGen = {
        ...mockSignals[0],
        generation: null,
      };

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([signalWithNullGen]),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              mockResolvedValue: [{ count: 1 }],
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.signals[0].generation).toBeNull();
    });

    it('converts generation to number when not null', async () => {
      const { db } = await import('@claw/db');

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              $dynamic: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([mockSignals[0]]),
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue({
              mockResolvedValue: [{ count: 1 }],
            }),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/negative-signals',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.signals[0].generation).toBe(2);
      expect(typeof body.signals[0].generation).toBe('number');
    });
  });
});
