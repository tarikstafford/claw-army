import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export type ReviewTargetType = 'soul' | 'skill';
export const REVIEW_TARGET_TYPES = ['soul', 'skill'] as const;

export const marketplaceReviews = pgTable(
  'marketplace_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    targetId: uuid('target_id').notNull(),
    targetType: text('target_type').notNull().$type<ReviewTargetType>(),
    rating: integer('rating').notNull(),
    reviewText: text('review_text'),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('marketplace_reviews_user_target_uniq').on(t.userId, t.targetId),
    index('marketplace_reviews_target_idx').on(t.targetId, t.targetType),
  ],
);

export type MarketplaceReview = typeof marketplaceReviews.$inferSelect;
export type NewMarketplaceReview = typeof marketplaceReviews.$inferInsert;
