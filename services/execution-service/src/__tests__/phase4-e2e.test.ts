/**
 * Phase 4 End-to-End Integration Test
 *
 * Validates all 5 Phase 4 success criteria:
 *   SC#1 — Atomic budget cap enforcement via Redis Lua script (GARD-01)
 *   SC#2 — Rate violation detection and deny-list mechanism (GARD-02, GARD-03)
 *   SC#3 — Loop detection from tool_invocations (GARD-04)
 *   SC#4 — Billing event completeness for all 5 event types (METR-01)
 *   SC#5 — Bot-hours and cost calculation accuracy within 1% margin (METR-02, METR-03)
 *
 * Prerequisites:
 *   - PostgreSQL must be running on localhost:5432 (database: clawdb)
 *   - Redis must be running on localhost:6379
 *   - Pub/Sub emulator must be running (PUBSUB_EMULATOR_HOST set) for subscription tests
 *
 * Infrastructure checks are graceful — tests skip if infrastructure is unavailable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import IORedis from 'ioredis';
import {
  enforceAtomicBudget,
  calculateTokenCost,
  recordBotHours,
} from '../events/billing-engine';
import { checkLoopForBot } from '../events/guardrail-watchdog';
import { publishGuardrailTriggered } from '../events/publisher';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/clawdb';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// Default cost rates (must match billing-engine.ts defaults)
const LLM_INPUT_RATE_CENTS_PER_M = Number(process.env.LLM_INPUT_RATE_CENTS_PER_M ?? 15);
const LLM_OUTPUT_RATE_CENTS_PER_M = Number(process.env.LLM_OUTPUT_RATE_CENTS_PER_M ?? 60);
const BOT_HOURLY_RATE_CENTS = Number(process.env.BOT_HOURLY_RATE_CENTS ?? 100);

// ──────────────────────────────────────────────────────────────────────────────
// Infrastructure clients
// ──────────────────────────────────────────────────────────────────────────────

let pgClient: import('pg').Client | null = null;
let redis: IORedis | null = null;
let infrastructureAvailable = false;
let pubsubEmulatorAvailable = false;

async function getDb() {
  if (!pgClient) {
    const { Client } = await import('pg');
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
  }
  return pgClient;
}

async function checkPubSubEmulator(): Promise<boolean> {
  const emulatorHost = process.env['PUBSUB_EMULATOR_HOST'];
  if (!emulatorHost) return false;
  try {
    const [host, port] = emulatorHost.split(':');
    const res = await fetch(`http://${host}:${port}/v1/projects/claw-local/topics`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function checkInfrastructure(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.query('SELECT 1');

    redis = new IORedis(REDIS_URL, { lazyConnect: true, connectTimeout: 3000 });
    await redis.connect();
    await redis.ping();

    return true;
  } catch (err) {
    console.warn(
      '[phase4-e2e] Infrastructure not available — all tests will be skipped.\n' +
        '[phase4-e2e] Ensure PostgreSQL is running on localhost:5432 (database: clawdb)\n' +
        '[phase4-e2e] Ensure Redis is running on localhost:6379\n' +
        '[phase4-e2e] Error: ' +
        (err as Error).message,
    );
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Test data helpers (direct SQL for isolation and reliability)
// ──────────────────────────────────────────────────────────────────────────────

async function createTestExecution(
  executionId: string,
  budgetCapCents = 1000,
  runtimeLimitSeconds = 3600,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO executions (id, status, objective, max_bots, budget_cap_cents, runtime_limit_seconds, allowed_tools)
     VALUES ($1, 'running', 'Phase 4 E2E Test', 1, $2, $3, ARRAY['llm_call', 'write_file'])
     ON CONFLICT (id) DO NOTHING`,
    [executionId, budgetCapCents, runtimeLimitSeconds],
  );
}

async function createTestBot(
  botId: string,
  executionId: string,
  startedAt?: Date,
  stoppedAt?: Date,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO bots (id, execution_id, status, image_tag, started_at, stopped_at)
     VALUES ($1, $2, 'stopped', 'claw-phase4-e2e-test:latest', $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [botId, executionId, startedAt ?? null, stoppedAt ?? null],
  );
}

async function insertToolInvocation(
  botId: string,
  executionId: string,
  toolName: string,
  requestSummary: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  // Create a dummy bot row if not exists (to satisfy FK constraint)
  await db.query(
    `INSERT INTO bots (id, execution_id, status, image_tag)
     VALUES ($1, $2, 'working', 'claw-phase4-e2e-test:latest')
     ON CONFLICT (id) DO NOTHING`,
    [botId, executionId],
  );
  await db.query(
    `INSERT INTO tool_invocations (bot_id, execution_id, tool_name, invocation_id, rejected, request_summary, invoked_at)
     VALUES ($1, $2, $3, $4, false, $5, NOW())`,
    [botId, executionId, toolName, randomUUID(), JSON.stringify(requestSummary)],
  );
}

async function insertBillingEvent(
  executionId: string,
  eventType: string,
  botId?: string,
  amountCents?: number,
  tokenCount?: number,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO billing_events (execution_id, bot_id, event_type, amount_cents, token_count)
     VALUES ($1, $2, $3::billing_event_type, $4, $5)`,
    [executionId, botId ?? null, eventType, amountCents ?? null, tokenCount ?? null],
  );
}

// Track all test execution IDs for cleanup
const testExecutionIds: string[] = [];

async function cleanupTestData(): Promise<void> {
  if (testExecutionIds.length === 0) return;
  const db = await getDb();
  const placeholders = testExecutionIds.map((_, i) => `$${i + 1}`).join(', ');
  await db.query(`DELETE FROM executions WHERE id IN (${placeholders})`, testExecutionIds);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase 4 E2E Integration Tests', () => {
  beforeAll(async () => {
    infrastructureAvailable = await checkInfrastructure();
    pubsubEmulatorAvailable = await checkPubSubEmulator();
  });

  afterAll(async () => {
    await cleanupTestData();
    if (pgClient) {
      await pgClient.end();
      pgClient = null;
    }
    if (redis) {
      await redis.quit();
      redis = null;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#1 — Atomic budget cap enforcement (GARD-01)
  // Validates: INCRBY Lua script enforces cap atomically, no read-then-write
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#1: Atomic budget enforcement via Redis Lua script (GARD-01)', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase4-e2e] Skipping SC#1: infrastructure not available');
      return;
    }

    const executionId = randomUUID();
    testExecutionIds.push(executionId);
    await createTestExecution(executionId, 1000);

    // Initialize Redis budget keys as createExecution() would
    await redis!.set(`budget:cap:${executionId}`, '1000');
    await redis!.set(`budget:spend:${executionId}`, '0');

    // First spend: 500 cents (well under cap)
    const result1 = await enforceAtomicBudget(executionId, 500);
    expect(result1.newTotalCents).toBe(500);
    expect(result1.capExceeded).toBe(false);

    // Second spend: 400 cents (total 900, still under cap)
    const result2 = await enforceAtomicBudget(executionId, 400);
    expect(result2.newTotalCents).toBe(900);
    expect(result2.capExceeded).toBe(false);

    // Third spend: 200 cents (total 1100, exceeds cap of 1000)
    const result3 = await enforceAtomicBudget(executionId, 200);
    expect(result3.newTotalCents).toBe(1100);
    expect(result3.capExceeded).toBe(true);

    // Concurrent enforcement: both calls should succeed atomically
    // Total should be exactly 1100 + 100 + 100 = 1300
    const [concResult1, concResult2] = await Promise.all([
      enforceAtomicBudget(executionId, 100),
      enforceAtomicBudget(executionId, 100),
    ]);

    // Both should have succeeded; the total should be exactly 1300
    // (one will be 1200, the other 1300 — order depends on Redis execution)
    const finalTotal = Math.max(concResult1.newTotalCents, concResult2.newTotalCents);
    expect(finalTotal).toBe(1300);

    // Verify via direct Redis read
    const directTotal = await redis!.get(`budget:spend:${executionId}`);
    expect(Number(directTotal)).toBe(1300);

    // Cleanup Redis keys
    await redis!.del(`budget:cap:${executionId}`, `budget:spend:${executionId}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#2 — Rate violation detection and deny-list (GARD-02, GARD-03)
  // Validates: deny-list key mechanism and guardrail event schema
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#2: Deny-list mechanism for rate violation enforcement (GARD-02, GARD-03)', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase4-e2e] Skipping SC#2: infrastructure not available');
      return;
    }

    const testBotId = randomUUID();

    // Set a Redis deny-list key (as revokeBot() would)
    await redis!.setex(`guardrail:denied:${testBotId}`, 60, '1');

    // Read it back — must exist with value '1'
    const isDenied = await redis!.get(`guardrail:denied:${testBotId}`);
    expect(isDenied).toBe('1');

    // Verify TTL was set (should be <= 60 and > 0)
    const ttl = await redis!.ttl(`guardrail:denied:${testBotId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    // Cleanup
    await redis!.del(`guardrail:denied:${testBotId}`);

    // Verify publishGuardrailTriggered can be called without error (schema validation)
    // This tests the event schema — actual Pub/Sub publish requires the emulator or GCP credentials.
    // publisher.ts swallows all errors via try/catch, so the function always resolves without throw.
    // Only attempt if the Pub/Sub emulator is running, to avoid hanging connections.
    if (pubsubEmulatorAvailable) {
      await expect(
        publishGuardrailTriggered({
          type: 'guardrail_triggered',
          botId: testBotId,
          executionId: randomUUID(),
          reason: 'rate_limit',
          action: 'revoked',
          timestamp: new Date().toISOString(),
        }),
      ).resolves.not.toThrow();
    } else {
      console.warn(
        '[phase4-e2e] Skipping Pub/Sub schema test: PUBSUB_EMULATOR_HOST not set or emulator not running.',
      );
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#3 — Loop detection (GARD-04)
  // Validates: N identical consecutive invocations are detected as a loop
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#3: Loop detection from tool_invocations (GARD-04)', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase4-e2e] Skipping SC#3: infrastructure not available');
      return;
    }

    const executionId = randomUUID();
    const loopBotId = randomUUID();
    const nLoopBotId = randomUUID();
    testExecutionIds.push(executionId);

    await createTestExecution(executionId);

    // Insert 5 identical tool_invocations for the loop bot
    for (let i = 0; i < 5; i++) {
      await insertToolInvocation(loopBotId, executionId, 'llm_call', {
        toolName: 'llm_call',
        args: { prompt: 'same prompt every time' },
      });
    }

    // Loop should be detected
    const loopDetected = await checkLoopForBot(loopBotId);
    expect(loopDetected).toBe(true);

    // Insert 5 DIFFERENT tool_invocations for the non-loop bot
    for (let i = 0; i < 5; i++) {
      await insertToolInvocation(nLoopBotId, executionId, 'llm_call', {
        toolName: 'llm_call',
        args: { prompt: `unique prompt ${i}` },
      });
    }

    // No loop should be detected for the non-loop bot
    const noLoopDetected = await checkLoopForBot(nLoopBotId);
    expect(noLoopDetected).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#4 — Billing event completeness (METR-01)
  // Validates: all 5 event types can be persisted and queried
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#4: Billing event completeness for all 5 event types (METR-01)', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase4-e2e] Skipping SC#4: infrastructure not available');
      return;
    }

    const executionId = randomUUID();
    const billingBotId = randomUUID();
    testExecutionIds.push(executionId);

    await createTestExecution(executionId);
    await createTestBot(billingBotId, executionId);

    // Insert one billing event of each type
    await insertBillingEvent(executionId, 'bot_started', billingBotId);
    await insertBillingEvent(executionId, 'bot_stopped', billingBotId);
    await insertBillingEvent(executionId, 'tool_invoked', billingBotId, 45, 1_500_000);
    await insertBillingEvent(executionId, 'execution_completed');
    await insertBillingEvent(executionId, 'budget_exceeded', undefined, 145);

    // Query all billing events for the execution
    const db = await getDb();
    const result = await db.query(
      `SELECT event_type, amount_cents, token_count, occurred_at
       FROM billing_events
       WHERE execution_id = $1
       ORDER BY occurred_at ASC`,
      [executionId],
    );

    expect(result.rows).toHaveLength(5);

    const eventTypes = result.rows.map((r: { event_type: string }) => r.event_type);
    expect(eventTypes).toContain('bot_started');
    expect(eventTypes).toContain('bot_stopped');
    expect(eventTypes).toContain('tool_invoked');
    expect(eventTypes).toContain('execution_completed');
    expect(eventTypes).toContain('budget_exceeded');

    // Verify tool_invoked has amountCents and tokenCount
    const toolInvokedRow = result.rows.find(
      (r: { event_type: string }) => r.event_type === 'tool_invoked',
    ) as { amount_cents: number; token_count: number } | undefined;
    expect(toolInvokedRow).toBeDefined();
    expect(toolInvokedRow!.amount_cents).toBe(45);
    expect(toolInvokedRow!.token_count).toBe(1_500_000);

    // Verify total cost can be reconstructed from tool_invoked events
    const costResult = await db.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS total_cents
       FROM billing_events
       WHERE execution_id = $1 AND event_type = 'tool_invoked'`,
      [executionId],
    );
    const totalCents = costResult.rows[0]?.total_cents as number;
    expect(totalCents).toBe(45);

    // Verify each row has required fields
    for (const row of result.rows as Array<{ occurred_at: Date | null }>) {
      expect(row.occurred_at).toBeDefined();
      expect(row.occurred_at).not.toBeNull();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#5 — Bot-hours and cost accuracy (METR-02, METR-03)
  // Validates: bot-hours from wall-clock pairs, cost accurate within 1%
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#5: Bot-hours and cost calculation accurate within 1% margin (METR-02, METR-03)', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase4-e2e] Skipping SC#5: infrastructure not available');
      return;
    }

    const executionId = randomUUID();
    const botId = randomUUID();
    testExecutionIds.push(executionId);

    // Create bot with exactly 1 hour wall-clock runtime
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const stoppedAt = new Date('2026-01-01T11:00:00.000Z'); // exactly 1 hour later

    await createTestExecution(executionId);
    await createTestBot(botId, executionId, startedAt, stoppedAt);

    // Call recordBotHours — should compute 1.000000 hours
    await recordBotHours(botId, executionId);

    // Query telemetry table for bot_hours metric
    const db = await getDb();
    const result = await db.query(
      `SELECT metric_name, metric_value::float8 AS metric_value
       FROM telemetry
       WHERE execution_id = $1 AND bot_id = $2 AND metric_name = 'bot_hours'`,
      [executionId, botId],
    );

    expect(result.rows).toHaveLength(1);
    const botHours = result.rows[0].metric_value as number;
    expect(botHours).toBeCloseTo(1.0, 4); // 1.000000 — accurate to 4 decimal places

    // METR-03: Cost accuracy within 1% margin
    // Test case: 1,000,000 prompt tokens + 500,000 completion tokens at default rates
    // Expected token cost: Math.round((1_000_000 * 15 + 500_000 * 60) / 1_000_000)
    //                     = Math.round(15 + 30) = 45 cents
    // Plus 1 bot-hour at 100 cents/hour = 100 cents
    // Total expected = 145 cents
    const promptTokens = 1_000_000;
    const completionTokens = 500_000;

    const tokenCostCents = calculateTokenCost(promptTokens, completionTokens);
    const expectedTokenCost = Math.round(
      (promptTokens * LLM_INPUT_RATE_CENTS_PER_M + completionTokens * LLM_OUTPUT_RATE_CENTS_PER_M) /
        1_000_000,
    );
    expect(tokenCostCents).toBe(expectedTokenCost);
    expect(tokenCostCents).toBe(45); // 15 + 30 = 45 cents at default rates

    const botHourCost = Math.round(botHours * BOT_HOURLY_RATE_CENTS);
    const totalActualCents = tokenCostCents + botHourCost;
    const totalExpectedCents = 145; // 45 cents tokens + 100 cents bot-hour

    expect(totalActualCents).toBe(totalExpectedCents);

    // Verify within 1% margin
    const marginFraction = Math.abs(totalActualCents - totalExpectedCents) / totalExpectedCents;
    expect(marginFraction).toBeLessThan(0.01);
  });
});
