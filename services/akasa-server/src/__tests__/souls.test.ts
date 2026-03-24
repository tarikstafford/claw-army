import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock @claw/db before importing soulsRouter
vi.mock('@claw/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
  };
  return {
    db: mockDb,
    botSouls: { id: 'id', isArchetype: 'is_archetype', createdAt: 'created_at' },
  };
});

// Mock soul-generator before importing soulsRouter
vi.mock('../services/soul-generator.js', () => ({
  generateSoul: vi.fn(),
  generateMutatedSoul: vi.fn(),
}));

describe('soulsRouter', () => {
  let app: express.Express;
  let mockDb: ReturnType<typeof import('@claw/db')['db']>;
  let generateSoul: ReturnType<typeof vi.fn>;
  let generateMutatedSoul: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@claw/db');
    mockDb = dbModule.db as unknown as typeof mockDb;

    const generatorModule = await import('../services/soul-generator.js');
    generateSoul = generatorModule.generateSoul as ReturnType<typeof vi.fn>;
    generateMutatedSoul = generatorModule.generateMutatedSoul as ReturnType<typeof vi.fn>;

    const { soulsRouter } = await import('../routes/souls.js');
    app = express();
    app.use(express.json());
    app.use('/api/akasa/souls', soulsRouter());
  });

  describe('GET /api/akasa/souls', () => {
    it('returns 200 with array of souls', async () => {
      const mockSouls = [
        { id: 'soul-1', taskCategory: 'web-research', generation: 1, isArchetype: false },
        { id: 'soul-2', taskCategory: 'code-generation', generation: 2, isArchetype: false },
      ];

      // Chain mock to resolve with mockSouls at the end
      (mockDb as unknown as { orderBy: ReturnType<typeof vi.fn> }).orderBy = vi.fn().mockResolvedValue(mockSouls);

      const res = await request(app).get('/api/akasa/souls');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/akasa/souls/:id', () => {
    it('returns 404 for non-existent UUID', async () => {
      // Return empty array for limit query (no soul found)
      (mockDb as unknown as { limit: ReturnType<typeof vi.fn> }).limit = vi.fn().mockResolvedValue([]);

      const res = await request(app).get('/api/akasa/souls/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/akasa/souls/generate', () => {
    it('returns 201 with soul object containing soulContent, dimensions, contentHash', async () => {
      const mockSoul = {
        id: 'new-soul-id',
        soulContent: '# SOUL.md\n## Identity and Role\nTest agent',
        dimensions: {
          identityRole: 'Test agent',
          decisionPriorities: 'Prioritize accuracy',
          toolUsageDoctrine: 'Use tools sparingly',
          riskTolerance: 'Low risk',
          communicationStyle: 'Concise',
          recoveryBehavior: 'Retry once',
          ethicalHardStops: 'No harmful content',
        },
        contentHash: 'a'.repeat(64),
        generation: 1,
        isArchetype: false,
      };

      generateSoul.mockResolvedValue(mockSoul);

      const res = await request(app)
        .post('/api/akasa/souls/generate')
        .send({ archetypeName: 'cautious-verifier', taskCategory: 'web-research' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('soulContent');
      expect(res.body).toHaveProperty('dimensions');
      expect(res.body).toHaveProperty('contentHash');
    });

    it('returns 400 if archetypeName is missing', async () => {
      const res = await request(app)
        .post('/api/akasa/souls/generate')
        .send({ taskCategory: 'web-research' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/akasa/souls/:id/mutate', () => {
    it('returns 201 with child soul having parentSoulId set and generation incremented', async () => {
      const parentSoul = {
        id: 'parent-soul-id',
        generation: 1,
        isArchetype: false,
        soulContent: '# SOUL.md content',
        dimensions: {},
        contentHash: 'b'.repeat(64),
      };

      const childSoul = {
        id: 'child-soul-id',
        parentSoulId: 'parent-soul-id',
        generation: 2,
        isArchetype: false,
        soulContent: '# Mutated SOUL.md content',
        dimensions: {},
        contentHash: 'c'.repeat(64),
      };

      // Parent lookup returns parent soul
      (mockDb as unknown as { limit: ReturnType<typeof vi.fn> }).limit = vi.fn().mockResolvedValue([parentSoul]);
      generateMutatedSoul.mockResolvedValue(childSoul);

      const res = await request(app)
        .post('/api/akasa/souls/parent-soul-id/mutate')
        .send({ mutationStrength: 0.2 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('parentSoulId');
      expect(res.body.generation).toBeGreaterThan(1);
    });
  });
});
