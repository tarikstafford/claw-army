import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { authUsers } from './auth.js';

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  emailEvolutionEvents: boolean('email_evolution_events').notNull().default(true),
  emailBudgetAlerts: boolean('email_budget_alerts').notNull().default(true),
  emailSkillEvents: boolean('email_skill_events').notNull().default(true),
  inAppEvolutionEvents: boolean('in_app_evolution_events').notNull().default(true),
  inAppBudgetAlerts: boolean('in_app_budget_alerts').notNull().default(true),
  inAppSkillEvents: boolean('in_app_skill_events').notNull().default(true),
  budgetAlertThreshold50: boolean('budget_alert_threshold_50').notNull().default(true),
  budgetAlertThreshold75: boolean('budget_alert_threshold_75').notNull().default(true),
  budgetAlertThreshold90: boolean('budget_alert_threshold_90').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
