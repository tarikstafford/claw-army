import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: text('user_id').primaryKey(),
    displayName: text('display_name'),
    evolutionEvents: text('evolution_events').notNull().default('true'),
    budgetAlerts: text('budget_alerts').notNull().default('true'),
    skillEvents: text('skill_events').notNull().default('true'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_preferences_user_id_idx').on(t.userId),
  ],
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
