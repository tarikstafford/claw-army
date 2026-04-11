import crypto from 'node:crypto';
import SwaggerParser from '@apidevtools/swagger-parser';
import { db, toolRegistry } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import type { NewToolRegistryEntry, ToolRegistryEntry } from '@claw/db';

/**
 * Represents a discovered endpoint from an OpenAPI spec, before DB insertion.
 */
export interface DiscoveredEndpoint {
  operationId: string | null;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  parameters: Record<string, unknown>[] | null;
  requestBody: Record<string, unknown> | null;
  responseSchema: Record<string, unknown> | null;
  tags: string[];
}

/**
 * Parsed OpenAPI spec metadata + discovered endpoints.
 */
export interface ParsedSpec {
  title: string;
  version: string | null;
  baseUrl: string;
  endpoints: DiscoveredEndpoint[];
}

const SUPPORTED_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Parse and dereference an OpenAPI/Swagger spec from a URL or raw JSON object.
 * Uses SwaggerParser.dereference() to resolve all $ref pointers.
 */
export async function parseOpenApiSpec(input: string | Record<string, unknown>): Promise<ParsedSpec> {
  // dereference resolves all $ref pointers in-place
  const api = await SwaggerParser.dereference(input as string);

  const info = api.info;
  if (!info?.title) {
    throw new Error('OpenAPI spec missing required info.title');
  }

  // Resolve base URL from servers array (OpenAPI 3.x) or host+basePath (Swagger 2.x)
  let baseUrl = '';
  const apiAny = api as Record<string, unknown>;
  if (Array.isArray(apiAny['servers']) && apiAny['servers'].length > 0) {
    const server = apiAny['servers'][0] as Record<string, unknown>;
    baseUrl = (server['url'] as string) ?? '';
  } else if (apiAny['host']) {
    const scheme = Array.isArray(apiAny['schemes']) && apiAny['schemes'].length > 0
      ? (apiAny['schemes'][0] as string)
      : 'https';
    const basePath = (apiAny['basePath'] as string) ?? '';
    baseUrl = `${scheme}://${apiAny['host'] as string}${basePath}`;
  }

  if (!baseUrl) {
    throw new Error('Could not resolve base URL from OpenAPI spec (no servers or host field)');
  }

  // Strip trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  const endpoints: DiscoveredEndpoint[] = [];

  const paths = api.paths ?? {};
  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of SUPPORTED_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method];
      if (!operation || typeof operation !== 'object') continue;

      const op = operation as Record<string, unknown>;

      // Extract parameters (path-level + operation-level merged)
      const pathLevelParams = Array.isArray((pathItem as Record<string, unknown>)['parameters'])
        ? ((pathItem as Record<string, unknown>)['parameters'] as Record<string, unknown>[])
        : [];
      const opLevelParams = Array.isArray(op['parameters'])
        ? (op['parameters'] as Record<string, unknown>[])
        : [];
      const mergedParams = [...pathLevelParams, ...opLevelParams];

      // Extract request body schema (OpenAPI 3.x)
      let requestBody: Record<string, unknown> | null = null;
      if (op['requestBody'] && typeof op['requestBody'] === 'object') {
        const rb = op['requestBody'] as Record<string, unknown>;
        const content = rb['content'] as Record<string, unknown> | undefined;
        if (content) {
          // Prefer application/json
          const jsonContent = content['application/json'] as Record<string, unknown> | undefined;
          if (jsonContent?.['schema']) {
            requestBody = jsonContent['schema'] as Record<string, unknown>;
          }
        }
      }

      // Extract 200/201 response schema
      let responseSchema: Record<string, unknown> | null = null;
      const responses = op['responses'] as Record<string, unknown> | undefined;
      if (responses) {
        const successResponse = (responses['200'] ?? responses['201']) as Record<string, unknown> | undefined;
        if (successResponse) {
          const content = successResponse['content'] as Record<string, unknown> | undefined;
          if (content) {
            const jsonContent = content['application/json'] as Record<string, unknown> | undefined;
            if (jsonContent?.['schema']) {
              responseSchema = jsonContent['schema'] as Record<string, unknown>;
            }
          }
          // Swagger 2.x uses schema directly on the response
          if (!responseSchema && successResponse['schema']) {
            responseSchema = successResponse['schema'] as Record<string, unknown>;
          }
        }
      }

      const tags = Array.isArray(op['tags']) ? (op['tags'] as string[]) : [];

      endpoints.push({
        operationId: (op['operationId'] as string) ?? null,
        method,
        path: pathStr,
        summary: (op['summary'] as string) ?? null,
        description: (op['description'] as string) ?? null,
        parameters: mergedParams.length > 0 ? mergedParams : null,
        requestBody,
        responseSchema,
        tags,
      });
    }
  }

  return {
    title: info.title,
    version: info.version ?? null,
    baseUrl,
    endpoints,
  };
}

/**
 * Import parsed endpoints into the tool_registry table.
 * Returns the created registry entries.
 */
export async function importEndpoints(
  userId: string,
  parsedSpec: ParsedSpec,
  specUrl: string | null,
  selectedPaths?: Array<{ method: string; path: string }>,
): Promise<ToolRegistryEntry[]> {
  const specId = crypto.randomUUID();

  // Filter to selected endpoints if provided, otherwise import all
  let endpointsToImport = parsedSpec.endpoints;
  if (selectedPaths && selectedPaths.length > 0) {
    const selectionSet = new Set(selectedPaths.map(s => `${s.method}:${s.path}`));
    endpointsToImport = parsedSpec.endpoints.filter(
      ep => selectionSet.has(`${ep.method}:${ep.path}`),
    );
  }

  if (endpointsToImport.length === 0) {
    return [];
  }

  const rows: NewToolRegistryEntry[] = endpointsToImport.map(ep => ({
    userId,
    specId,
    specTitle: parsedSpec.title,
    specVersion: parsedSpec.version,
    specUrl,
    baseUrl: parsedSpec.baseUrl,
    operationId: ep.operationId,
    method: ep.method,
    path: ep.path,
    summary: ep.summary,
    description: ep.description,
    parameters: ep.parameters,
    requestBody: ep.requestBody,
    responseSchema: ep.responseSchema,
    tags: ep.tags,
  }));

  const inserted = await db.insert(toolRegistry).values(rows).returning();
  return inserted;
}

/**
 * List all tool registry entries for a user.
 */
export async function listToolRegistry(userId: string): Promise<ToolRegistryEntry[]> {
  return db.select().from(toolRegistry).where(eq(toolRegistry.userId, userId));
}

/**
 * Delete all endpoints for a given specId (unregister an entire imported spec).
 */
export async function deleteSpec(userId: string, specId: string): Promise<number> {
  const result = await db
    .delete(toolRegistry)
    .where(and(eq(toolRegistry.userId, userId), eq(toolRegistry.specId, specId)))
    .returning();
  return result.length;
}

/**
 * Toggle isEnabled for a specific registry entry.
 */
export async function toggleEndpoint(
  userId: string,
  entryId: string,
  isEnabled: boolean,
): Promise<ToolRegistryEntry | null> {
  const [updated] = await db
    .update(toolRegistry)
    .set({ isEnabled, updatedAt: new Date() })
    .where(and(eq(toolRegistry.id, entryId), eq(toolRegistry.userId, userId)))
    .returning();
  return updated ?? null;
}
