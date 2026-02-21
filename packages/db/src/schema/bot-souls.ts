import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const botSouls = pgTable(
  'bot_souls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    isArchetype: boolean('is_archetype').notNull().default(false),
    archetypeName: varchar('archetype_name', { length: 100 }),
    botId: uuid('bot_id'),       // null for archetypes; no FK to avoid circular ref with bots
    executionId: uuid('execution_id'), // null for archetypes; no FK to avoid circular ref
    taskCategory: varchar('task_category', { length: 255 }),
    soulContent: text('soul_content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(), // SHA-256 hex digest
    generation: integer('generation').notNull().default(1),
    // Self-referencing FK — uses AnyPgColumn to break the circular type inference
    parentSoulId: uuid('parent_soul_id').references((): AnyPgColumn => botSouls.id),
    dimensions: jsonb('dimensions').notNull(), // 7-dimension breakdown as JSONB
    constitutionDirectives: jsonb('constitution_directives').notNull(), // array of inviolable directives
    embedding: vector('embedding', { dimensions: 1536 }), // nullable; populated in Phase 9 for cosine similarity
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('bot_souls_is_archetype_idx').on(t.isArchetype),
    index('bot_souls_bot_id_idx').on(t.botId),
    index('bot_souls_task_category_idx').on(t.taskCategory),
    index('bot_souls_content_hash_idx').on(t.contentHash),
    index('bot_souls_parent_soul_id_idx').on(t.parentSoulId),
  ],
);

export type BotSoul = typeof botSouls.$inferSelect;
export type NewBotSoul = typeof botSouls.$inferInsert;
