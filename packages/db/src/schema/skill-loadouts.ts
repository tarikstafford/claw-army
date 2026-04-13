import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { bots } from './bots.js';
import { agentSkills } from './agent-skills.js';

export const skillLoadouts = pgTable(
  'skill_loadouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => agentSkills.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    equippedAt: timestamp('equipped_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true, precision: 3 }),
  },
  (t) => [
    index('skill_loadouts_bot_id_idx').on(t.botId),
    index('skill_loadouts_skill_id_idx').on(t.skillId),
    unique('skill_loadouts_bot_skill_active_unique').on(t.botId, t.skillId),
  ],
);

export type SkillLoadout = typeof skillLoadouts.$inferSelect;
export type NewSkillLoadout = typeof skillLoadouts.$inferInsert;
