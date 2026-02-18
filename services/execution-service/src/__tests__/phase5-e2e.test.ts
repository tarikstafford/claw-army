/**
 * Phase 5 End-to-End Integration Test
 *
 * Validates all 5 Phase 5 success criteria:
 *   SC#1 — Composite score with 4 component scores stored in telemetry
 *   SC#2 — Bot tier assignment and leaderboard queryability
 *   SC#3 — Execution summary report completeness
 *   SC#4 — Elite bot DNA capture with PII-safe extraction
 *   SC#5 — DNA versioning (append-only, no raw outputs)
 *
 * Prerequisites:
 *   - PostgreSQL must be running on localhost:5432 (database: clawdb)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { runPerformancePipeline } from '../performance/performance-engine';
import { buildExecutionReport } from '../performance/report-builder';
import { identifyAndCaptureDna } from '../performance/dna-capture';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/clawdb';

// ──────────────────────────────────────────────────────────────────────────────
// Infrastructure client
// ──────────────────────────────────────────────────────────────────────────────

let pgClient: import('pg').Client | null = null;
let infrastructureAvailable = false;

async function getDb() {
  if (!pgClient) {
    const { Client } = await import('pg');
    pgClient = new Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
  }
  return pgClient;
}

async function checkInfrastructure(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    return true;
  } catch (err) {
    console.warn(
      '[phase5-e2e] Infrastructure not available — all tests will be skipped.\n' +
        '[phase5-e2e] Ensure PostgreSQL is running on localhost:5432 (database: clawdb)\n' +
        '[phase5-e2e] Error: ' +
        (err as Error).message,
    );
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Test data — shared across all 5 success criterion tests
// ──────────────────────────────────────────────────────────────────────────────

const executionId = randomUUID();
const botAId = randomUUID(); // high performer: 8 completed, 0 failed, low cost, many tool calls
const botBId = randomUUID(); // medium performer: 5 completed, 2 failed, moderate cost
const botCId = randomUUID(); // low performer: 1 completed, 4 failed, high cost, few tool calls

// ──────────────────────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase 5 E2E Integration Tests', () => {
  beforeAll(async () => {
    infrastructureAvailable = await checkInfrastructure();
    if (!infrastructureAvailable) return;

    const db = await getDb();

    // ── Create execution ──────────────────────────────────────────────────────
    await db.query(
      `INSERT INTO executions (id, objective, max_bots, budget_cap_cents, runtime_limit_seconds, allowed_tools, status)
       VALUES ($1, 'Test performance scoring objective', 3, 10000, 3600, ARRAY['llm_call','fetch_url'], 'completed')`,
      [executionId],
    );

    // ── Create 3 bots ─────────────────────────────────────────────────────────
    const now = new Date();
    const startedAt = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    // Bot A: high performer — started 1 hour ago, stopped now
    await db.query(
      `INSERT INTO bots (id, execution_id, status, image_tag, started_at, stopped_at)
       VALUES ($1, $2, 'stopped', 'claw-phase5-e2e:latest', $3, $4)`,
      [botAId, executionId, startedAt, now],
    );

    // Bot B: medium performer
    await db.query(
      `INSERT INTO bots (id, execution_id, status, image_tag, started_at, stopped_at)
       VALUES ($1, $2, 'stopped', 'claw-phase5-e2e:latest', $3, $4)`,
      [botBId, executionId, new Date(now.getTime() - 45 * 60 * 1000), now],
    );

    // Bot C: low performer
    await db.query(
      `INSERT INTO bots (id, execution_id, status, image_tag, started_at, stopped_at)
       VALUES ($1, $2, 'stopped', 'claw-phase5-e2e:latest', $3, $4)`,
      [botCId, executionId, new Date(now.getTime() - 30 * 60 * 1000), now],
    );

    // ── Create task records ───────────────────────────────────────────────────

    // Bot A: 8 completed tasks, 0 failed, attempt_count=1 for all
    for (let i = 0; i < 8; i++) {
      await db.query(
        `INSERT INTO tasks (id, execution_id, description, status, claimed_by_bot_id, attempt_count)
         VALUES ($1, $2, $3, 'completed', $4, 1)`,
        [randomUUID(), executionId, `Bot A task ${i + 1}`, botAId],
      );
    }

    // Bot B: 5 completed, 2 failed, some with retries
    for (let i = 0; i < 5; i++) {
      await db.query(
        `INSERT INTO tasks (id, execution_id, description, status, claimed_by_bot_id, attempt_count)
         VALUES ($1, $2, $3, 'completed', $4, 1)`,
        [randomUUID(), executionId, `Bot B completed task ${i + 1}`, botBId],
      );
    }
    for (let i = 0; i < 2; i++) {
      await db.query(
        `INSERT INTO tasks (id, execution_id, description, status, claimed_by_bot_id, attempt_count)
         VALUES ($1, $2, $3, 'failed', $4, 2)`,
        [randomUUID(), executionId, `Bot B failed task ${i + 1}`, botBId],
      );
    }

    // Bot C: 1 completed, 4 failed, high retry count
    await db.query(
      `INSERT INTO tasks (id, execution_id, description, status, claimed_by_bot_id, attempt_count)
       VALUES ($1, $2, 'Bot C completed task', 'completed', $3, 1)`,
      [randomUUID(), executionId, botCId],
    );
    for (let i = 0; i < 4; i++) {
      await db.query(
        `INSERT INTO tasks (id, execution_id, description, status, claimed_by_bot_id, attempt_count)
         VALUES ($1, $2, $3, 'failed', $4, 3)`,
        [randomUUID(), executionId, `Bot C failed task ${i + 1}`, botCId],
      );
    }

    // ── Create billing_events (tool_invoked) ──────────────────────────────────

    // Bot A: low cost per task — 200 cents total for 8 tasks (~25 cents/task)
    for (let i = 0; i < 8; i++) {
      await db.query(
        `INSERT INTO billing_events (id, execution_id, bot_id, event_type, amount_cents, token_count)
         VALUES ($1, $2, $3, 'tool_invoked', 25, 50000)`,
        [randomUUID(), executionId, botAId],
      );
    }

    // Bot B: moderate cost — 350 cents total for 5 completed tasks (~70 cents/task)
    for (let i = 0; i < 7; i++) {
      await db.query(
        `INSERT INTO billing_events (id, execution_id, bot_id, event_type, amount_cents, token_count)
         VALUES ($1, $2, $3, 'tool_invoked', 50, 80000)`,
        [randomUUID(), executionId, botBId],
      );
    }

    // Bot C: high cost — 500 cents total for 1 completed task (~500 cents/task)
    for (let i = 0; i < 5; i++) {
      await db.query(
        `INSERT INTO billing_events (id, execution_id, bot_id, event_type, amount_cents, token_count)
         VALUES ($1, $2, $3, 'tool_invoked', 100, 120000)`,
        [randomUUID(), executionId, botCId],
      );
    }

    // ── Create telemetry bot_hours records ────────────────────────────────────

    // Bot A: 1.0 bot-hours
    await db.query(
      `INSERT INTO telemetry (id, execution_id, bot_id, metric_name, metric_value)
       VALUES ($1, $2, $3, 'bot_hours', '1.0')`,
      [randomUUID(), executionId, botAId],
    );

    // Bot B: 0.75 bot-hours
    await db.query(
      `INSERT INTO telemetry (id, execution_id, bot_id, metric_name, metric_value)
       VALUES ($1, $2, $3, 'bot_hours', '0.75')`,
      [randomUUID(), executionId, botBId],
    );

    // Bot C: 0.5 bot-hours
    await db.query(
      `INSERT INTO telemetry (id, execution_id, bot_id, metric_name, metric_value)
       VALUES ($1, $2, $3, 'bot_hours', '0.5')`,
      [randomUUID(), executionId, botCId],
    );

    // ── Create tool_invocations ───────────────────────────────────────────────
    // Bot A: many tool calls — 10 llm_call invocations with varied durations
    // requestSummary uses JSONB keys: 'model', 'messages' — values NOT captured in DNA
    for (let i = 0; i < 10; i++) {
      await db.query(
        `INSERT INTO tool_invocations (id, execution_id, bot_id, tool_name, invocation_id, rejected,
           duration_ms, total_tokens, prompt_tokens, completion_tokens, request_summary, invoked_at)
         VALUES ($1, $2, $3, 'llm_call', $4, false, $5, 1500, 1000, 500,
           '{"model": "gpt-4", "messages": "REDACTED"}'::jsonb,
           NOW() - ($6 || ' seconds')::interval)`,
        [randomUUID(), executionId, botAId, randomUUID(), 1000 + i * 100, (10 - i) * 10],
      );
    }
    // Bot A also uses fetch_url
    for (let i = 0; i < 3; i++) {
      await db.query(
        `INSERT INTO tool_invocations (id, execution_id, bot_id, tool_name, invocation_id, rejected,
           duration_ms, total_tokens, prompt_tokens, completion_tokens, request_summary, invoked_at)
         VALUES ($1, $2, $3, 'fetch_url', $4, false, $5, 0, 0, 0,
           '{"url": "REDACTED", "method": "GET"}'::jsonb,
           NOW() - ($6 || ' seconds')::interval)`,
        [randomUUID(), executionId, botAId, randomUUID(), 500 + i * 50, (3 - i) * 5],
      );
    }

    // Bot B: moderate tool calls — 5 llm_call
    for (let i = 0; i < 5; i++) {
      await db.query(
        `INSERT INTO tool_invocations (id, execution_id, bot_id, tool_name, invocation_id, rejected,
           duration_ms, total_tokens, prompt_tokens, completion_tokens, request_summary, invoked_at)
         VALUES ($1, $2, $3, 'llm_call', $4, false, $5, 2000, 1500, 500,
           '{"model": "gpt-4", "messages": "REDACTED"}'::jsonb,
           NOW() - ($6 || ' seconds')::interval)`,
        [randomUUID(), executionId, botBId, randomUUID(), 2000 + i * 200, (5 - i) * 8],
      );
    }

    // Bot C: few tool calls — 2 llm_call
    for (let i = 0; i < 2; i++) {
      await db.query(
        `INSERT INTO tool_invocations (id, execution_id, bot_id, tool_name, invocation_id, rejected,
           duration_ms, total_tokens, prompt_tokens, completion_tokens, request_summary, invoked_at)
         VALUES ($1, $2, $3, 'llm_call', $4, false, $5, 5000, 4000, 1000,
           '{"model": "gpt-4", "messages": "REDACTED"}'::jsonb,
           NOW() - ($6 || ' seconds')::interval)`,
        [randomUUID(), executionId, botCId, randomUUID(), 5000 + i * 500, (2 - i) * 15],
      );
    }
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.query('DELETE FROM dna_store WHERE execution_id = $1', [executionId]);
      await pgClient.query('DELETE FROM telemetry WHERE execution_id = $1', [executionId]);
      await pgClient.query('DELETE FROM tool_invocations WHERE execution_id = $1', [executionId]);
      await pgClient.query('DELETE FROM billing_events WHERE execution_id = $1', [executionId]);
      await pgClient.query('DELETE FROM tasks WHERE execution_id = $1', [executionId]);
      await pgClient.query('DELETE FROM bots WHERE execution_id = $1', [executionId]);
      await pgClient.query('DELETE FROM executions WHERE id = $1', [executionId]);
      await pgClient.end();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#1 — Composite score with 4 independently queryable component scores
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#1: Every bot has 4 component scores in telemetry and a composite score on bots', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase5-e2e] Skipping SC#1: infrastructure not available');
      return;
    }

    // Call the performance pipeline directly — includes scoring + DNA capture
    await runPerformancePipeline(executionId);

    // Verify 4 component scores exist per bot in telemetry
    const componentNames = [
      'success_rate_score',
      'efficiency_score',
      'cost_efficiency_score',
      'stability_score',
    ];
    for (const botId of [botAId, botBId, botCId]) {
      for (const metricName of componentNames) {
        const result = await pgClient!.query(
          'SELECT metric_value FROM telemetry WHERE execution_id = $1 AND bot_id = $2 AND metric_name = $3',
          [executionId, botId, metricName],
        );
        expect(result.rows.length).toBe(1);
        const score = Number(result.rows[0].metric_value);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }

    // Verify composite_score is set on each bot
    for (const botId of [botAId, botBId, botCId]) {
      const result = await pgClient!.query(
        'SELECT composite_score FROM bots WHERE id = $1',
        [botId],
      );
      expect(result.rows[0].composite_score).not.toBeNull();
      const composite = Number(result.rows[0].composite_score);
      expect(composite).toBeGreaterThanOrEqual(0);
      expect(composite).toBeLessThanOrEqual(100);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#2 — Tier assignment and leaderboard sorting
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#2: Every bot has a tier and leaderboard is sorted by composite_score descending', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase5-e2e] Skipping SC#2: infrastructure not available');
      return;
    }

    // Pipeline already ran in SC#1; idempotency guard means scores are stable
    const tiers = await pgClient!.query(
      'SELECT id, composite_score, tier FROM bots WHERE execution_id = $1 ORDER BY composite_score DESC NULLS LAST',
      [executionId],
    );
    expect(tiers.rows.length).toBe(3);

    // All bots have a tier
    for (const row of tiers.rows) {
      expect(['high', 'medium', 'low']).toContain(row.tier);
    }

    // Leaderboard is sorted descending
    const scores = tiers.rows.map((r: { composite_score: string }) => Number(r.composite_score));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]!);
    }

    // Bot A (best performer) should rank highest
    expect(tiers.rows[0].id).toBe(botAId);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#3 — Execution summary report completeness
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#3: Execution report contains all required fields', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase5-e2e] Skipping SC#3: infrastructure not available');
      return;
    }

    const report = await buildExecutionReport(executionId);

    expect(report.executionId).toBe(executionId);
    expect(report.totalBots).toBe(3);
    expect(report.totalBotHours).toBeGreaterThan(0);
    expect(report.totalCostCents).toBeGreaterThan(0);
    expect(report.averageBotScore).toBeGreaterThan(0);
    expect(report.topPerformingBotId).toBe(botAId);
    expect(report.errorDistribution).toHaveProperty('task_failures');
    expect(report.errorDistribution).toHaveProperty('tool_rejections');
    expect(report.costPerTaskCents).toBeGreaterThan(0);
    expect(report.totalTasks).toBeGreaterThan(0);
    expect(report.completedTasks).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#4 — Elite bot DNA capture with PII-safe extraction
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#4: Elite bots have DNA captured with PII-safe structural patterns', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase5-e2e] Skipping SC#4: infrastructure not available');
      return;
    }

    // Pipeline ran in SC#1 which included DNA capture for elite bots
    const dnaRows = await pgClient!.query(
      'SELECT * FROM dna_store WHERE execution_id = $1',
      [executionId],
    );

    // At least one DNA record should exist (for Bot A at minimum)
    expect(
      dnaRows.rows.length,
      'SC#1 pipeline must have run before SC#4 — SC#1 calls runPerformancePipeline which includes DNA capture',
    ).toBeGreaterThanOrEqual(1);

    const dna = dnaRows.rows[0];
    expect(dna.bot_id).toBe(botAId);
    expect(dna.objective_category).toBeTruthy();

    const payload = dna.dna_payload;
    // Verify structural fields exist
    expect(payload).toHaveProperty('systemPromptTemplate');
    expect(payload).toHaveProperty('toolCallSequence');
    expect(Array.isArray(payload.toolCallSequence)).toBe(true);
    expect(payload).toHaveProperty('argumentPatterns');
    expect(payload).toHaveProperty('retryStrategy');
    expect(payload).toHaveProperty('timingProfile');
    expect(payload).toHaveProperty('tokenDistribution');

    // PII safety: toolCallSequence should contain only known tool names
    for (const toolName of payload.toolCallSequence) {
      expect(['llm_call', 'fetch_url', 'write_file']).toContain(toolName);
    }

    // argumentPatterns values should be arrays of strings (key names only, not data)
    for (const [, keys] of Object.entries(payload.argumentPatterns)) {
      expect(Array.isArray(keys)).toBe(true);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SC#5 — DNA versioning: append-only, no raw outputs
  // ──────────────────────────────────────────────────────────────────────────

  it('SC#5: DNA records are versioned (append-only) and contain no raw LLM output', async () => {
    if (!infrastructureAvailable) {
      console.warn('[phase5-e2e] Skipping SC#5: infrastructure not available');
      return;
    }

    // Run DNA capture again directly — should create version 2 for Bot A, not overwrite version 1
    await identifyAndCaptureDna(executionId);

    const dnaRows = await pgClient!.query(
      'SELECT version, dna_payload FROM dna_store WHERE bot_id = $1 ORDER BY version ASC',
      [botAId],
    );

    // Should have 2 versions (from SC#4 pipeline run and this direct call)
    expect(dnaRows.rows.length).toBe(2);
    expect(dnaRows.rows[0].version).toBe(1);
    expect(dnaRows.rows[1].version).toBe(2);

    // Verify no raw LLM output in DNA payload
    const payload = dnaRows.rows[0].dna_payload;
    const payloadStr = JSON.stringify(payload);
    // We inserted 'REDACTED' as a value in request_summary — verify it's not in the DNA
    // (DNA should contain only keys from requestSummary, never values)
    expect(payloadStr).not.toContain('REDACTED');
  });
});
