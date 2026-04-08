import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { armyBuilderRoutes } from '../../routes/army-builder.js';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
  },
  agentClasses: {},
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue({
    languageModel: vi.fn(),
  }),
}));

describe('armyBuilderRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(armyBuilderRoutes, { prefix: '/army-builder' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /army-builder/analysis', () => {
    it('returns analysis with categories from LLM and library depth', async () => {
      const { generateText } = await import('ai');
      const { db } = await import('@claw/db');

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(['lead-generation', 'data-analysis']),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { taskCategory: 'lead-generation', currentClass: 'Novice', count: 5 },
              { taskCategory: 'lead-generation', currentClass: 'Understudy', count: 3 },
              { taskCategory: 'lead-generation', currentClass: 'Artisan', count: 2 },
              { taskCategory: 'data-analysis', currentClass: 'Novice', count: 4 },
              { taskCategory: 'data-analysis', currentClass: 'Understudy', count: 2 },
              { taskCategory: 'data-analysis', currentClass: 'Artisan', count: 1 },
            ]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Sell more products&maxBots=12',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.categories).toContain('lead-generation');
      expect(body.categories).toContain('data-analysis');
      expect(body.libraryDepth).toHaveLength(2);
      expect(body.budgetTiers).toBeDefined();
      expect(body.blocked).toBe(false);
    });

    it('falls back to "general" category when LLM extraction fails', async () => {
      const { generateText } = await import('ai');
      const { db } = await import('@claw/db');

      vi.mocked(generateText).mockRejectedValue(new Error('LLM error'));
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Sell more products&maxBots=6',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.categories).toEqual(['general']);
    });

    it('returns blocked=true when maxBots is below minimum', async () => {
      const { generateText } = await import('ai');
      const { db } = await import('@claw/db');

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(['lead-generation', 'data-analysis', 'content-writing']),
      } as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Sell more products&maxBots=3',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.blocked).toBe(true);
      expect(body.blockReason).toContain('3 bots cannot cover 3 task categories');
      expect(body.blockReason).toContain('minimum of 3 agents each');
      expect(body.blockReason).toContain('9 required');
    });

    it('calculates correct budget tiers', async () => {
      const { generateText } = await import('ai');
      const { db } = await import('@claw/db');

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(['lead-generation']),
      } as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { taskCategory: 'lead-generation', currentClass: 'Novice', count: 10 },
              { taskCategory: 'lead-generation', currentClass: 'Understudy', count: 5 },
              { taskCategory: 'lead-generation', currentClass: 'Artisan', count: 3 },
            ]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Sell products&maxBots=12',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.budgetTiers.full.agentCount).toBe(12);
      expect(body.budgetTiers.full.perCategory).toBe(12);

      expect(body.budgetTiers.reduced.agentCount).toBe(9);
      expect(body.budgetTiers.reduced.perCategory).toBe(9);

      expect(body.budgetTiers.minimumViable.agentCount).toBe(3);
      expect(body.budgetTiers.minimumViable.perCategory).toBe(3);
    });

    it('returns empty library depth when no agents exist for category', async () => {
      const { generateText } = await import('ai');
      const { db } = await import('@claw/db');

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(['new-category']),
      } as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Do something new&maxBots=6',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.libraryDepth).toHaveLength(1);
      expect(body.libraryDepth[0].totalAgents).toBe(0);
    });

    it('returns 400 when objective is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?maxBots=12',
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when maxBots is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Sell%20products',
      });

      expect(res.statusCode).toBe(400);
    });

    it('correctly counts agents by class', async () => {
      const { generateText } = await import('ai');
      const { db } = await import('@claw/db');

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(['analytics']),
      } as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { taskCategory: 'analytics', currentClass: 'Novice', count: 3 },
              { taskCategory: 'analytics', currentClass: 'Understudy', count: 2 },
              { taskCategory: 'analytics', currentClass: 'Artisan', count: 1 },
            ]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/army-builder/analysis?objective=Analyze data&maxBots=6',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const analyticsDepth = body.libraryDepth.find(
        (d: { taskCategory: string }) => d.taskCategory === 'analytics',
      );
      expect(analyticsDepth.noviceCount).toBe(3);
      expect(analyticsDepth.understudyCount).toBe(2);
      expect(analyticsDepth.artisanCount).toBe(1);
      expect(analyticsDepth.totalAgents).toBe(6);
    });
  });
});
