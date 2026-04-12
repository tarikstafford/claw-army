import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, marketplaceReviews, type ReviewTargetType, REVIEW_TARGET_TYPES } from '@claw/db';
import { eq, and, sql } from 'drizzle-orm';

interface SubmitReviewBody {
  userId: string;
  targetId: string;
  targetType: ReviewTargetType;
  rating: number;
  reviewText?: string;
}

interface ReviewsQuery {
  targetId?: string;
  targetType?: string;
}

interface SummaryQuery {
  targetId?: string;
}

export function reviewsRouter(): Router {
  const router = Router();

  // POST / — submit or update a review
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as SubmitReviewBody;

      if (!body.userId || typeof body.userId !== 'string') {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      if (!body.targetId || typeof body.targetId !== 'string') {
        res.status(400).json({ error: 'targetId is required' });
        return;
      }

      if (!body.targetType || !REVIEW_TARGET_TYPES.includes(body.targetType)) {
        res.status(400).json({ error: 'targetType must be "soul" or "skill"' });
        return;
      }

      if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
        res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
        return;
      }

      // Upsert: one review per user per target
      const existing = await db
        .select({ id: marketplaceReviews.id })
        .from(marketplaceReviews)
        .where(
          and(
            eq(marketplaceReviews.userId, body.userId),
            eq(marketplaceReviews.targetId, body.targetId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        const updated = await db
          .update(marketplaceReviews)
          .set({
            rating: body.rating,
            reviewText: body.reviewText ?? null,
            updatedAt: new Date(),
          })
          .where(eq(marketplaceReviews.id, existing[0].id))
          .returning();

        res.json(updated[0]);
        return;
      }

      const inserted = await db
        .insert(marketplaceReviews)
        .values({
          userId: body.userId,
          targetId: body.targetId,
          targetType: body.targetType,
          rating: body.rating,
          reviewText: body.reviewText ?? null,
        })
        .returning();

      res.status(201).json(inserted[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET / — list reviews for a target
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as ReviewsQuery;

      if (!query.targetId) {
        res.status(400).json({ error: 'targetId query parameter is required' });
        return;
      }

      const conditions = [eq(marketplaceReviews.targetId, query.targetId)];

      if (query.targetType && REVIEW_TARGET_TYPES.includes(query.targetType as ReviewTargetType)) {
        conditions.push(eq(marketplaceReviews.targetType, query.targetType as ReviewTargetType));
      }

      const reviews = await db
        .select()
        .from(marketplaceReviews)
        .where(and(...conditions))
        .orderBy(marketplaceReviews.createdAt);

      res.json(reviews);
    } catch (err) {
      next(err);
    }
  });

  // GET /summary — average rating + count for a target
  router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as SummaryQuery;

      if (!query.targetId) {
        res.status(400).json({ error: 'targetId query parameter is required' });
        return;
      }

      const result = await db
        .select({
          avgRating: sql<string>`COALESCE(AVG(${marketplaceReviews.rating}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(marketplaceReviews)
        .where(eq(marketplaceReviews.targetId, query.targetId));

      const row = result[0];
      res.json({
        targetId: query.targetId,
        avgRating: row ? parseFloat(row.avgRating) : 0,
        count: row ? Number(row.count) : 0,
      });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id — delete own review
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Review ID is required' });
        return;
      }

      const rows = await db
        .select()
        .from(marketplaceReviews)
        .where(eq(marketplaceReviews.id, id))
        .limit(1);

      const review = rows[0];
      if (!review) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      // userId check: the caller must pass their userId as a query param
      const userId = req.query['userId'] as string | undefined;
      if (!userId || userId !== review.userId) {
        res.status(403).json({ error: 'You can only delete your own reviews' });
        return;
      }

      await db
        .delete(marketplaceReviews)
        .where(eq(marketplaceReviews.id, id));

      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
