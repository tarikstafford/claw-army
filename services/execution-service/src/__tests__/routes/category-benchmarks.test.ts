import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { categoryBenchmarksRoutes } from '../../routes/category-benchmarks.js';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
  },
  categoryBenchmarks: {},
}));

describe('categoryBenchmarksRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(categoryBenchmarksRoutes, { prefix: '/category-benchmarks' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /category-benchmarks', () => {
    it('returns 200 with benchmarks ordered by task category', async () => {
      const { db } = await import('@claw/db');
      const mockBenchmarks = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          taskCategory: 'content-writing',
          pioneerBotId: '223e4567-e89b-12d3-a456-426614174000',
          pioneerSoulId: '323e4567-e89b-12d3-a456-426614174000',
          pioneerExecutionId: '423e4567-e89b-12d3-a456-426614174000',
          baselineCompositeScore: '0.82',
          confirmedRunCount: 10,
          thinDataFlag: false,
          benchmarkMature: true,
          standardPromotion: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-15'),
        },
        {
          id: '523e4567-e89b-12d3-a456-426614174000',
          taskCategory: 'lead-generation',
          pioneerBotId: '623e4567-e89b-12d3-a456-426614174000',
          pioneerSoulId: '723e4567-e89b-12d3-a456-426614174000',
          pioneerExecutionId: '823e4567-e89b-12d3-a456-426614174000',
          baselineCompositeScore: '0.75',
          confirmedRunCount: 5,
          thinDataFlag: true,
          benchmarkMature: false,
          standardPromotion: false,
          createdAt: new Date('2025-01-10'),
          updatedAt: new Date('2025-01-10'),
        },
      ];
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockBenchmarks),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/category-benchmarks',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.benchmarks).toHaveLength(2);
      expect(body.benchmarks[0].taskCategory).toBe('content-writing');
      expect(body.benchmarks[1].taskCategory).toBe('lead-generation');
    });

    it('returns empty array when no benchmarks exist', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/category-benchmarks',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.benchmarks).toEqual([]);
    });

    it('returns benchmarks with correct field types', async () => {
      const { db } = await import('@claw/db');
      const mockBenchmarks = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          taskCategory: 'data-analysis',
          pioneerBotId: '223e4567-e89b-12d3-a456-426614174000',
          pioneerSoulId: null,
          pioneerExecutionId: '423e4567-e89b-12d3-a456-426614174000',
          baselineCompositeScore: '0.90',
          confirmedRunCount: 20,
          thinDataFlag: false,
          benchmarkMature: true,
          standardPromotion: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-20'),
        },
      ];
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockBenchmarks),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/category-benchmarks',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.benchmarks[0].thinDataFlag).toBe(false);
      expect(body.benchmarks[0].benchmarkMature).toBe(true);
      expect(body.benchmarks[0].standardPromotion).toBe(true);
      expect(body.benchmarks[0].pioneerSoulId).toBeNull();
    });
  });
});
