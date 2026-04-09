import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { bots } from './bots';

export const skillLoadouts = pgTable(
  'skill_loadouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id').notNull(),
    skillName: varchar('skill_name', { length: 255 }).notNull(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    addedAt: timestamp('added_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index('skill_loadouts_bot_id_idx').on(t.botId),
    index('skill_loadouts_skill_id_idx').on(t.skillId),
    index('skill_loadouts_is_active_idx').on(t.isActive),
  ],
);

export type SkillLoadout = typeof skillLoadouts.$inferSelect;
export type NewSkillLoadout = typeof skillLoadouts.$inferInsert;