import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, botSouls } from '@claw/db';
import { eq, desc, sql } from 'drizzle-orm';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateSoul, generateMutatedSoul } from '../services/soul-generator.js';
import { injectSoulIntoAgent } from '../services/soul-injector.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GenerateBody {
  archetypeName: string;
  taskCategory: string;
  botId?: string;
  executionId?: string;
}

interface MutateBody {
  mutationStrength?: number;
}

interface InjectBody {
  agentId: string;
  companyId: string;
  soulId: string;
  adapterType?: string;
}

// ─── Router Factory ──────────────────────────────────────────────────────────────

/**
 * Express router factory for soul CRUD + generation + mutation + injection.
 * Mount at /api/akasa/souls.
 */
export function soulsRouter(): Router {
  const router = Router();

  // GET / — list all non-archetype souls ordered by creation date desc
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const souls = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.isArchetype, false))
        .orderBy(desc(botSouls.createdAt));

      res.json(souls);
    } catch (err) {
      next(err);
    }
  });

  // POST /generate — generate a new soul from an archetype
  router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as GenerateBody;

      if (!body.archetypeName || typeof body.archetypeName !== 'string') {
        res.status(400).json({ error: 'archetypeName is required and must be a string' });
        return;
      }

      if (!body.taskCategory || typeof body.taskCategory !== 'string') {
        res.status(400).json({ error: 'taskCategory is required and must be a string' });
        return;
      }

      const soul = await generateSoul(
        body.archetypeName,
        body.taskCategory,
        body.botId,
        body.executionId,
      );

      res.status(201).json(soul);
    } catch (err) {
      next(err);
    }
  });

  // POST /inject — inject a soul into a Paperclip agent
  router.post('/inject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as InjectBody;

      if (!body.agentId || !body.companyId || !body.soulId) {
        res.status(400).json({ error: 'agentId, companyId, and soulId are required' });
        return;
      }

      // Lookup soul content
      const rows = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.id, body.soulId))
        .limit(1);

      const soul = rows[0];
      if (!soul) {
        res.status(404).json({ error: 'Soul not found' });
        return;
      }

      // Import paperclipDb lazily to allow mocking in tests
      const { createDb } = await import('@paperclipai/db');
      const paperclipDbUrl = process.env['DATABASE_URL'];
      if (!paperclipDbUrl) {
        res.status(500).json({ error: 'DATABASE_URL not configured' });
        return;
      }

      const paperclipDb = createDb(paperclipDbUrl);

      await injectSoulIntoAgent(
        paperclipDb,
        body.agentId,
        body.companyId,
        soul.soulContent,
        soul.id,
        body.adapterType,
      );

      res.status(200).json({ injected: true });
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — get single soul by UUID
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Soul ID is required' });
        return;
      }

      const rows = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.id, id))
        .limit(1);

      const soul = rows[0];
      if (!soul) {
        res.status(404).json({ error: 'Soul not found' });
        return;
      }

      res.json(soul);
    } catch (err) {
      next(err);
    }
  });

  // GET /search — find top-N similar souls by cosine similarity
  router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, limit: limitStr } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'query string is required' });
        return;
      }

      const limit = Math.min(Number.parseInt(limitStr ?? '10', 10) || 10, 100);

      const { embedding } = await embed({
        model: openai.embeddingModel('text-embedding-3-small'),
        value: query,
      });

      const embeddingVector = `[${Array.from(embedding).join(',')}]`;

      const rows = await db.execute<{
        id: string;
        is_archetype: boolean;
        archetype_name: string | null;
        bot_id: string | null;
        execution_id: string | null;
        task_category: string | null;
        soul_content: string;
        content_hash: string;
        generation: number;
        parent_soul_id: string | null;
        dimensions: unknown;
        constitution_directives: unknown;
        embedding: number[];
        human_review_flag: boolean;
        created_at: Date;
        similarity_score: number;
      }>(sql`
        SELECT
          bs.*,
          (1 - (bs.embedding <=> ${embeddingVector}::vector)) AS similarity_score
        FROM ${botSouls} bs
        WHERE bs.embedding IS NOT NULL
        ORDER BY similarity_score DESC
        LIMIT ${limit}
      `);

      res.json(rows.rows);
    } catch (err) {
      next(err);
    }
  });

  // POST /:id/mutate — generate a mutated child soul from parent
  router.post('/:id/mutate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as MutateBody;

      if (!id) {
        res.status(400).json({ error: 'Soul ID is required' });
        return;
      }

      // Verify parent exists
      const parentRows = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.id, id))
        .limit(1);

      const parent = parentRows[0];
      if (!parent) {
        res.status(404).json({ error: 'Parent soul not found' });
        return;
      }

      const mutationStrength =
        typeof body.mutationStrength === 'number' ? body.mutationStrength : 0.2;

      const mutatedSoul = await generateMutatedSoul(id, mutationStrength);

      res.status(201).json(mutatedSoul);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
