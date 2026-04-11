import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * tool_registry — stores tool endpoint definitions imported from OpenAPI/Swagger specs.
 *
 * Each row represents a single operation (e.g., GET /contacts, POST /deals)
 * from an imported OpenAPI spec. The spec-level metadata (title, version, baseUrl)
 * is denormalized onto each row via specId grouping.
 *
 * Uses logical FK on userId (no references()) — same pattern as tool_connections.
 */
export const toolRegistry = pgTable(
  'tool_registry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),

    // Spec-level metadata (shared across all endpoints from the same import)
    specId: uuid('spec_id').notNull(), // groups endpoints from the same import
    specTitle: text('spec_title').notNull(),
    specVersion: text('spec_version'),
    specUrl: text('spec_url'), // original URL or null if raw spec was pasted
    baseUrl: text('base_url').notNull(), // resolved server URL for invocations

    // Endpoint-level metadata
    operationId: text('operation_id'),
    method: text('method').notNull(), // 'get' | 'post' | 'put' | 'patch' | 'delete'
    path: text('path').notNull(), // e.g. '/contacts/{contactId}'
    summary: text('summary'),
    description: text('description'),

    // Schema data for tool invocation
    parameters: jsonb('parameters').$type<Record<string, unknown>[]>(), // query, path, header params
    requestBody: jsonb('request_body').$type<Record<string, unknown>>(), // dereferenced request body schema
    responseSchema: jsonb('response_schema').$type<Record<string, unknown>>(), // dereferenced 200 response schema
    tags: jsonb('tags').$type<string[]>().default([]),

    // Status
    isEnabled: boolean('is_enabled').notNull().default(true),

    // Tracking
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tool_registry_user_id_idx').on(t.userId),
    index('tool_registry_spec_id_idx').on(t.specId),
    uniqueIndex('tool_registry_spec_method_path_uniq').on(t.specId, t.method, t.path),
  ],
);

export type ToolRegistryEntry = typeof toolRegistry.$inferSelect;
export type NewToolRegistryEntry = typeof toolRegistry.$inferInsert;
