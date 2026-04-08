import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { soulsRoutes } from '../../routes/souls.js';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      $dynamic: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (value: unknown) => void) => { resolve([]); }),
    })),
    selectDistinct: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (value: unknown) => void) => { resolve([]); }),
    })),
  },
  botSouls: {},
  agentClasses: {},
  bots: {},
}));

describe('soulsRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(soulsRoutes, { prefix: '/souls' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /souls/:id', () => {
    it('returns 200 with soul data when found', async () => {
      const { db } = await import('@claw/db');
      const mockRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        taskCategory: 'data-analysis',
        generation: 2,
        isArchetype: false,
        archetypeName: null,
        soulContent: '# SOUL\nYou are a data analyst.',
        dimensions: { creativity: 0.7, precision: 0.9 },
        constitutionDirectives: { maxTokens: 4000 },
        parentSoulId: null,
        botId: '223e4567-e89b-12d3-a456-426614174000',
        executionId: '323e4567-e89b-12d3-a456-426614174000',
        agentClass: 'Understudy',
        compositeScore: '0.85',
        createdAt: new Date('2025-01-01'),
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => { resolve([mockRow]); }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls/123e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(mockRow.id);
      expect(body.agentClass).toBe('Understudy');
      expect(body.compositeScore).toBe(0.85);
    });

    it('returns 404 when soul not found', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => { resolve([]); }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls/123e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Soul not found');
    });
  });

  describe('GET /souls/categories', () => {
    it('returns 200 with distinct task categories', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.selectDistinct).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => {
          resolve([{ taskCategory: 'lead-generation' }, { taskCategory: 'data-analysis' }]);
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls/categories',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.categories).toEqual(['lead-generation', 'data-analysis']);
    });

    it('returns empty array when no categories exist', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.selectDistinct).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => { resolve([]); }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls/categories',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.categories).toEqual([]);
    });
  });

  describe('GET /souls', () => {
    it('returns paginated souls without filters', async () => {
      const { db } = await import('@claw/db');
      const mockRows = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          taskCategory: 'data-analysis',
          generation: 1,
          isArchetype: false,
          archetypeName: null,
          agentClass: 'Novice',
          compositeScore: '0.6',
          createdAt: new Date('2025-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        $dynamic: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => { resolve(mockRows); }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls',
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 200 with category filter', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        $dynamic: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => { resolve([]); }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls?category=data-analysis',
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 200 with limit and offset', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        $dynamic: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: unknown) => void) => { resolve([]); }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/souls?limit=10&offset=20',
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
