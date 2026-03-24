import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const toolConnections = pgTable(
  'tool_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    toolId: text('tool_id').notNull(),
    connectionType: text('connection_type').notNull().default('api_key'), // 'oauth' | 'api_key'
    status: text('status').notNull().default('connected'), // 'connected' | 'expired' | 'rate_limited' | 'errored' | 'disconnected'
    displayLabel: text('display_label'), // e.g. 'My HubSpot Account', masked API key 'sk-...xxxx'

    // OAuth encrypted fields
    encryptedAccessToken: text('encrypted_access_token'),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenIv: text('token_iv'),
    tokenTag: text('token_tag'),
    refreshIv: text('refresh_iv'),
    refreshTag: text('refresh_tag'),

    // API key encrypted fields
    encryptedApiKey: text('encrypted_api_key'),
    apiKeyIv: text('api_key_iv'),
    apiKeyTag: text('api_key_tag'),

    // Key version for rotation support
    keyVersion: integer('key_version').notNull().default(1),

    // OAuth expiry
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopes: text('scopes'), // comma-separated OAuth scopes

    // Rate limiting
    rateLimitResetAt: timestamp('rate_limit_reset_at', { withTimezone: true }),

    // Tracking
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tool_connections_user_tool_uniq').on(t.userId, t.toolId),
    index('tool_connections_user_id_idx').on(t.userId),
  ],
);

export type ToolConnection = typeof toolConnections.$inferSelect;
export type NewToolConnection = typeof toolConnections.$inferInsert;
