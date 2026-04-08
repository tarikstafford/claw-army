import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, dnaStore, botSouls, agentClasses } from '@claw/db';
import { eq, desc, asc, and, gte, sql } from 'drizzle-orm';
import { generateMutatedSoul } from '../services/soul-generator.js';

interface PublishBody {
  title: string;
  description: string;
}

interface AcquireBody {
  agentId: string;
  companyId: string;
  adapterType?: string;
}

interface BrowseQuery {
  taskCategory?: string;
  minClass?: string;
  minScore?: string;
  sortBy?: string;
  page?: string;
}

export function akashicRouter(): Router {
  const router = Router();

  router.post('/:dnaId/publish', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dnaId } = req.params;
      const body = req.body as PublishBody;

      if (!dnaId) {
        res.status(400).json({ error: 'DNA ID is required' });
        return;
      }

      if (!body.title || typeof body.title !== 'string') {
        res.status(400).json({ error: 'title is required and must be a string' });
        return;
      }

      if (!body.description || typeof body.description !== 'string') {
        res.status(400).json({ error: 'description is required and must be a string' });
        return;
      }

      const rows = await db
        .select()
        .from(dnaStore)
        .where(eq(dnaStore.id, dnaId))
        .limit(1);

      const entry = rows[0];
      if (!entry) {
        res.status(404).json({ error: 'DNA entry not found' });
        return;
      }

      if (!entry.soulId) {
        res.status(400).json({ error: 'Cannot publish DNA without an associated soul' });
        return;
      }

      const soulRows = await db
        .select()
        .from(botSouls)
        .where(eq(botSouls.id, entry.soulId))
        .limit(1);

      const soul = soulRows[0];
      if (!soul || !soul.botId) {
        res.status(400).json({ error: 'Cannot publish: soul has no associated bot' });
        return;
      }

      const classRows = await db
        .select()
        .from(agentClasses)
        .where(eq(agentClasses.botId, soul.botId))
        .limit(1);

      const agentClass = classRows[0];
      if (!agentClass || agentClass.currentClass !== 'Artisan') {
        res.status(403).json({ error: 'Only Artisan-class agents can publish to Akashic' });
        return;
      }

      await db
        .update(dnaStore)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          publishTitle: body.title,
          publishDescription: body.description,
        })
        .where(eq(dnaStore.id, dnaId));

      res.status(200).json({ published: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:dnaId/unpublish', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dnaId } = req.params;

      if (!dnaId) {
        res.status(400).json({ error: 'DNA ID is required' });
        return;
      }

      const rows = await db
        .select()
        .from(dnaStore)
        .where(eq(dnaStore.id, dnaId))
        .limit(1);

      const entry = rows[0];
      if (!entry) {
        res.status(404).json({ error: 'DNA entry not found' });
        return;
      }

      if (!entry.isPublished) {
        res.status(400).json({ error: 'DNA entry is not published' });
        return;
      }

      await db
        .update(dnaStore)
        .set({
          isPublished: false,
          publishedAt: null,
          publishTitle: null,
          publishDescription: null,
        })
        .where(eq(dnaStore.id, dnaId));

      res.status(200).json({ unpublished: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/browse', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as BrowseQuery;
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const pageSize = 20;
      const offset = (page - 1) * pageSize;

      const conditions = [eq(dnaStore.isPublished, true)];

      if (query.taskCategory) {
        conditions.push(eq(dnaStore.objectiveCategory, query.taskCategory));
      }

      if (query.minScore) {
        const minScore = parseFloat(query.minScore);
        if (!isNaN(minScore)) {
          conditions.push(gte(dnaStore.compositeScore, minScore.toString()));
        }
      }

      let orderByColumn = desc(dnaStore.compositeScore);
      if (query.sortBy === 'generation') {
        orderByColumn = desc(dnaStore.capturedAt);
      } else if (query.sortBy === 'acquiredCount') {
        orderByColumn = desc(dnaStore.acquiredCount);
      }

      const [listResult, countResult] = await Promise.allSettled([
        db
          .select({
            id: dnaStore.id,
            publishTitle: dnaStore.publishTitle,
            publishDescription: dnaStore.publishDescription,
            compositeScore: dnaStore.compositeScore,
            objectiveCategory: dnaStore.objectiveCategory,
            capturedAt: dnaStore.capturedAt,
            acquiredCount: dnaStore.acquiredCount,
            version: dnaStore.version,
            mutationLineage: dnaStore.mutationLineage,
            dnaPayload: dnaStore.dnaPayload,
          })
          .from(dnaStore)
          .where(and(...conditions))
          .orderBy(orderByColumn)
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(dnaStore)
          .where(and(...conditions)),
      ]);

      const list = listResult.status === 'fulfilled' ? listResult.value : [];
      const count = countResult.status === 'fulfilled' && countResult.value[0]
        ? Number(countResult.value[0].count)
        : 0;

      const entries = list.map(row => {
        const payload = row.dnaPayload as Record<string, unknown> | null;
        const lineage = row.mutationLineage as string[] | null;
        return {
          id: row.id,
          title: row.publishTitle,
          description: row.publishDescription,
          compositeScore: parseFloat(row.compositeScore as string),
          objectiveCategory: row.objectiveCategory,
          generation: row.version,
          mutationLineageDepth: lineage ? lineage.length : 0,
          taskCategory: payload?.taskCategory as string | null ?? row.objectiveCategory,
          acquiredCount: row.acquiredCount,
          capturedAt: row.capturedAt,
        };
      });

      res.json({
        entries,
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:dnaId/acquire', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dnaId } = req.params;
      const body = req.body as AcquireBody;

      if (!dnaId) {
        res.status(400).json({ error: 'DNA ID is required' });
        return;
      }

      if (!body.agentId || !body.companyId) {
        res.status(400).json({ error: 'agentId and companyId are required' });
        return;
      }

      const rows = await db
        .select()
        .from(dnaStore)
        .where(eq(dnaStore.id, dnaId))
        .limit(1);

      const entry = rows[0];
      if (!entry) {
        res.status(404).json({ error: 'DNA entry not found' });
        return;
      }

      if (!entry.isPublished) {
        res.status(400).json({ error: 'DNA entry is not published' });
        return;
      }

      if (!entry.soulId) {
        res.status(400).json({ error: 'DNA entry has no associated soul' });
        return;
      }

      const newSoul = await generateMutatedSoul(entry.soulId, 0.1);

      const { createDb } = await import('@paperclipai/db');
      const paperclipDbUrl = process.env['DATABASE_URL'];
      if (!paperclipDbUrl) {
        res.status(500).json({ error: 'DATABASE_URL not configured' });
        return;
      }

      const paperclipDb = createDb(paperclipDbUrl);

      const { injectSoulIntoAgent } = await import('../services/soul-injector.js');
      await injectSoulIntoAgent(
        paperclipDb,
        body.agentId,
        body.companyId,
        newSoul.soulContent,
        newSoul.id,
        body.adapterType,
      );

      await db
        .update(dnaStore)
        .set({ acquiredCount: entry.acquiredCount + 1 })
        .where(eq(dnaStore.id, dnaId));

      res.status(201).json({
        acquired: true,
        newSoulId: newSoul.id,
        generation: newSoul.generation,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
