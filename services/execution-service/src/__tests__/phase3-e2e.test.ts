/**
 * Phase 3 End-to-End Integration Test
 *
 * Tests the full Tool Gateway enforcement pipeline against a running gateway.
 *
 * Prerequisites:
 *   - Tool Gateway must be running on port 3002 (BOT_JWT_SECRET=claw-dev-secret-do-not-use-in-prod)
 *   - PostgreSQL must be running on localhost:5432 (database: clawdb)
 *   - Redis must be running on localhost:6379
 *
 * To start the gateway for testing:
 *   BOT_JWT_SECRET=claw-dev-secret-do-not-use-in-prod \
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clawdb \
 *   REDIS_URL=redis://localhost:6379 \
 *   ARTIFACT_ROOT=/tmp/claw-test-artifacts \
 *   FETCH_URL_DOMAIN_ALLOWLIST= \
 *   npx tsx services/tool-gateway/src/main.ts
 *
 * Success criteria tested:
 *   SC#2 — Disallowed tool returns 403 with audit log entry (rejected: true, reason: not_in_allowlist)
 *   SC#3 — Malformed args return 422 with Zod validation details (rejected: true, reason: schema_validation_failed)
 *   SC#4 — 61st call in a minute returns 429 (rejected: true, reason: rate_limit_exceeded)
 *   SC#5 — write_file returns 200 with artifactId and sizeBytes
 *   SC#5 — fetch_url returns 200 with statusCode and body (GATE-07)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jose from 'jose';
import { randomUUID } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env['TOOL_GATEWAY_URL'] ?? 'http://localhost:3002';
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/clawdb';
const BOT_JWT_SECRET = process.env['BOT_JWT_SECRET'] ?? 'claw-dev-secret-do-not-use-in-prod';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function isGatewayRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function mintJwt(botId: string, executionId: string): Promise<string> {
  const secret = new TextEncoder().encode(BOT_JWT_SECRET);
  return new jose.SignJWT({ botId, executionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(botId)
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(secret);
}

async function invokeToolRaw(
  toolName: string,
  args: unknown,
  botId: string,
  executionId: string,
  jwt: string,
): Promise<Response> {
  return fetch(`${GATEWAY_URL}/tool.invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      toolName,
      botId,
      executionId,
      invocationId: randomUUID(),
      timestamp: new Date().toISOString(),
      args,
    }),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// DB helpers (direct SQL for test setup/teardown)
// ──────────────────────────────────────────────────────────────────────────────

let pgClient: import('pg').Client | null = null;

async function getDb() {
  if (!pgClient) {
    const { Client } = await import('pg');
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
  }
  return pgClient;
}

async function createTestExecution(
  executionId: string,
  allowedTools: string[],
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO executions (id, status, objective, max_bots, budget_cap_cents, runtime_limit_seconds, allowed_tools)
     VALUES ($1, 'running', 'Phase 3 E2E Test', 1, 100000, 3600, $2)
     ON CONFLICT (id) DO UPDATE SET allowed_tools = $2`,
    [executionId, allowedTools],
  );
}

async function createTestBot(botId: string, executionId: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO bots (id, execution_id, status, image_tag)
     VALUES ($1, $2, 'working', 'claw-tool-gateway-test:latest')
     ON CONFLICT (id) DO NOTHING`,
    [botId, executionId],
  );
}

async function getToolInvocations(botId: string): Promise<Array<{
  tool_name: string;
  rejected: boolean;
  rejection_reason: string | null;
  duration_ms: number | null;
  invoked_at: Date;
}>> {
  const db = await getDb();
  const result = await db.query(
    `SELECT tool_name, rejected, rejection_reason, duration_ms, invoked_at
     FROM tool_invocations
     WHERE bot_id = $1
     ORDER BY invoked_at ASC`,
    [botId],
  );
  return result.rows;
}

async function cleanupTestData(executionIds: string[]): Promise<void> {
  if (executionIds.length === 0) return;
  const db = await getDb();
  // tool_invocations and bots cascade-delete when execution is deleted
  const placeholders = executionIds.map((_, i) => `$${i + 1}`).join(', ');
  await db.query(`DELETE FROM executions WHERE id IN (${placeholders})`, executionIds);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase 3 E2E Integration Tests', () => {
  let gatewayRunning = false;
  const testExecutionIds: string[] = [];

  beforeAll(async () => {
    gatewayRunning = await isGatewayRunning();
    if (!gatewayRunning) {
      console.warn(
        '[phase3-e2e] Tool Gateway is not running at ' + GATEWAY_URL +
        '. All tests will be skipped.\n' +
        '[phase3-e2e] Start it with:\n' +
        '[phase3-e2e]   BOT_JWT_SECRET=claw-dev-secret-do-not-use-in-prod \\\n' +
        '[phase3-e2e]   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clawdb \\\n' +
        '[phase3-e2e]   REDIS_URL=redis://localhost:6379 \\\n' +
        '[phase3-e2e]   ARTIFACT_ROOT=/tmp/claw-test-artifacts \\\n' +
        '[phase3-e2e]   FETCH_URL_DOMAIN_ALLOWLIST= \\\n' +
        '[phase3-e2e]   npx tsx services/tool-gateway/src/main.ts',
      );
    }
  });

  afterAll(async () => {
    await cleanupTestData(testExecutionIds);
    if (pgClient) {
      await pgClient.end();
      pgClient = null;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#2 — Allowlist rejection
  // Disallowed tool returns 403 and creates audit log with rejected: true
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#2: Disallowed tool returns 403 and is logged with rejected: true', async () => {
    if (!gatewayRunning) {
      console.warn('Skipping SC#2: gateway not running');
      return;
    }

    const executionId = randomUUID();
    const botId = randomUUID();
    testExecutionIds.push(executionId);

    // Create execution with llm_call and write_file allowed (fetch_url excluded)
    await createTestExecution(executionId, ['llm_call', 'write_file']);
    await createTestBot(botId, executionId);

    const jwt = await mintJwt(botId, executionId);

    // Attempt fetch_url — not in allowed_tools
    const res = await invokeToolRaw(
      'fetch_url',
      { url: 'https://example.com', method: 'GET' },
      botId,
      executionId,
      jwt,
    );

    expect(res.status).toBe(403);

    const body = await res.json() as { success: boolean; error: string; allowedTools: string[] };
    expect(body.success).toBe(false);
    expect(body.error).toContain('not in execution allowed_tools');
    expect(body.allowedTools).toEqual(expect.arrayContaining(['llm_call', 'write_file']));

    // Verify audit log entry
    await new Promise<void>((r) => setTimeout(r, 100)); // allow async DB write
    const invocations = await getToolInvocations(botId);
    expect(invocations.length).toBeGreaterThanOrEqual(1);

    const logEntry = invocations[invocations.length - 1];
    expect(logEntry).toBeDefined();
    expect(logEntry!.tool_name).toBe('fetch_url');
    expect(logEntry!.rejected).toBe(true);
    expect(logEntry!.rejection_reason).toBe('not_in_allowlist');
    expect(logEntry!.invoked_at).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#3 — Schema validation rejection
  // Malformed args return 422 with Zod error details
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#3: Malformed args return 422 with Zod validation error and audit log', async () => {
    if (!gatewayRunning) {
      console.warn('Skipping SC#3: gateway not running');
      return;
    }

    const executionId = randomUUID();
    const botId = randomUUID();
    testExecutionIds.push(executionId);

    // Create execution with llm_call allowed
    await createTestExecution(executionId, ['llm_call', 'write_file', 'fetch_url']);
    await createTestBot(botId, executionId);

    const jwt = await mintJwt(botId, executionId);

    // Malformed llm_call: model should be string, not number
    const res = await invokeToolRaw(
      'llm_call',
      { model: 123, messages: [] }, // model should be string; messages should have valid role/content
      botId,
      executionId,
      jwt,
    );

    expect(res.status).toBe(422);

    const body = await res.json() as { success: boolean; error: string; issues: unknown[] };
    expect(body.success).toBe(false);
    expect(body.error).toContain('Schema validation failed');
    expect(body.issues).toBeDefined();
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);

    // Verify audit log entry
    await new Promise<void>((r) => setTimeout(r, 100));
    const invocations = await getToolInvocations(botId);
    expect(invocations.length).toBeGreaterThanOrEqual(1);

    const logEntry = invocations[invocations.length - 1];
    expect(logEntry!.tool_name).toBe('llm_call');
    expect(logEntry!.rejected).toBe(true);
    expect(logEntry!.rejection_reason).toBe('schema_validation_failed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#4 — Rate limit enforcement
  // 61st rapid-fire call returns 429 (fresh UUID botId = clean Redis state)
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#4: 61st call in a minute returns 429 with rejected audit log entry', async () => {
    if (!gatewayRunning) {
      console.warn('Skipping SC#4: gateway not running');
      return;
    }

    // Fresh UUID botId ensures zero Redis state (no rate limit reset needed)
    const executionId = randomUUID();
    const botId = randomUUID();
    testExecutionIds.push(executionId);

    await createTestExecution(executionId, ['write_file']);
    await createTestBot(botId, executionId);

    const jwt = await mintJwt(botId, executionId);

    // Send 60 write_file requests rapidly (all should succeed)
    const writeFileArgs = { path: 'rate-limit-test.txt', content: 'x' };

    const responses = await Promise.all(
      Array.from({ length: 60 }, () =>
        invokeToolRaw('write_file', writeFileArgs, botId, executionId, jwt),
      ),
    );

    // All 60 should be allowed (some may be 200, some may fail on tool execution
    // if disk write fails, but they should not be 429)
    const rateLimitedBefore = responses.filter((r) => r.status === 429);
    expect(rateLimitedBefore.length).toBe(0);

    // 61st call — should be rate limited
    const res61 = await invokeToolRaw('write_file', writeFileArgs, botId, executionId, jwt);
    expect(res61.status).toBe(429);

    const body = await res61.json() as { success: boolean; error: string; retryAfter: number };
    expect(body.success).toBe(false);
    expect(body.error).toContain('rate limit exceeded');
    expect(body.retryAfter).toBeGreaterThan(0);

    // Verify audit log — the 61st should be logged as rejected: true
    await new Promise<void>((r) => setTimeout(r, 200));
    const invocations = await getToolInvocations(botId);

    const rateLimitedEntries = invocations.filter(
      (inv) => inv.rejected && inv.rejection_reason === 'rate_limit_exceeded',
    );
    expect(rateLimitedEntries.length).toBeGreaterThanOrEqual(1);
  }, 30_000); // Allow up to 30s for 61 sequential requests

  // ──────────────────────────────────────────────────────────────────────────
  // SC#5 — Tool dispatch: write_file
  // Returns 200 with artifactId and sizeBytes, logged as rejected: false
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#5 (write_file): Returns 200 with artifactId and sizeBytes, audit-logged', async () => {
    if (!gatewayRunning) {
      console.warn('Skipping SC#5 (write_file): gateway not running');
      return;
    }

    const executionId = randomUUID();
    const botId = randomUUID();
    testExecutionIds.push(executionId);

    await createTestExecution(executionId, ['write_file']);
    await createTestBot(botId, executionId);

    const jwt = await mintJwt(botId, executionId);

    const res = await invokeToolRaw(
      'write_file',
      { path: 'test-output.txt', content: 'hello world' },
      botId,
      executionId,
      jwt,
    );

    expect(res.status).toBe(200);

    const body = await res.json() as {
      success: boolean;
      result: { artifactId: string; path: string; sizeBytes: number };
      durationMs: number;
    };
    expect(body.success).toBe(true);
    expect(body.result).toBeDefined();

    // artifactId must be a UUID
    expect(body.result.artifactId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // sizeBytes must be correct for 'hello world' (11 UTF-8 bytes)
    expect(body.result.sizeBytes).toBe(11);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);

    // Verify audit log entry
    await new Promise<void>((r) => setTimeout(r, 100));
    const invocations = await getToolInvocations(botId);
    expect(invocations.length).toBeGreaterThanOrEqual(1);

    const logEntry = invocations[invocations.length - 1];
    expect(logEntry!.tool_name).toBe('write_file');
    expect(logEntry!.rejected).toBe(false);
    expect(logEntry!.rejection_reason).toBeNull();
    expect(logEntry!.duration_ms).toBeGreaterThanOrEqual(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#5 — Tool dispatch: fetch_url (GATE-07)
  // Returns 200 with statusCode and body (no API key required — uses example.com)
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#5 (fetch_url): Returns 200 with statusCode and body, audit-logged (GATE-07)', async () => {
    if (!gatewayRunning) {
      console.warn('Skipping SC#5 (fetch_url): gateway not running');
      return;
    }

    const executionId = randomUUID();
    const botId = randomUUID();
    testExecutionIds.push(executionId);

    await createTestExecution(executionId, ['fetch_url']);
    await createTestBot(botId, executionId);

    const jwt = await mintJwt(botId, executionId);

    // Use example.com — always returns 200 with stable content, no auth required
    const res = await invokeToolRaw(
      'fetch_url',
      { url: 'https://example.com', method: 'GET' },
      botId,
      executionId,
      jwt,
    );

    expect(res.status).toBe(200);

    const body = await res.json() as {
      success: boolean;
      result: { statusCode: number; body: string; headers: Record<string, string>; truncated: boolean };
      durationMs: number;
    };
    expect(body.success).toBe(true);
    expect(body.result).toBeDefined();
    expect(body.result.statusCode).toBe(200);
    expect(body.result.body).toBeTruthy();
    expect(body.result.body.length).toBeGreaterThan(0);
    expect(typeof body.result.truncated).toBe('boolean');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);

    // Verify audit log entry — proves GATE-07 end-to-end without an API key
    await new Promise<void>((r) => setTimeout(r, 100));
    const invocations = await getToolInvocations(botId);
    expect(invocations.length).toBeGreaterThanOrEqual(1);

    const logEntry = invocations[invocations.length - 1];
    expect(logEntry!.tool_name).toBe('fetch_url');
    expect(logEntry!.rejected).toBe(false);
    expect(logEntry!.rejection_reason).toBeNull();
    expect(logEntry!.duration_ms).toBeGreaterThanOrEqual(0);
  }, 30_000); // Allow 30s for external HTTP request
});
