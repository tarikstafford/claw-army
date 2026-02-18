#!/usr/bin/env tsx
/**
 * connectivity-check.ts
 *
 * Tests reachability of all claw-army infrastructure components:
 *   - PostgreSQL (Cloud SQL in prod, Docker in local dev)
 *   - Redis (Memorystore in prod — VPC only, Docker in local dev)
 *   - Pub/Sub (GCP or Pub/Sub emulator in local dev)
 *
 * Usage:
 *   # Local dev (auto-sets env vars for docker-compose.dev.yml defaults):
 *   pnpm check --local
 *
 *   # Custom env vars:
 *   DATABASE_URL=postgresql://... REDIS_URL=redis://... pnpm check
 *
 *   # GCP (requires GOOGLE_APPLICATION_CREDENTIALS + GCP_PROJECT_ID):
 *   GCP_PROJECT_ID=my-project pnpm check
 *
 * Exit codes:
 *   0 — all non-skipped checks passed
 *   1 — at least one check failed
 */

import pg from 'pg';
import Redis from 'ioredis';
import { PubSub } from '@google-cloud/pubsub';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  durationMs: number;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const supportsColor = process.stdout.isTTY && process.env.NO_COLOR == null;

const c = {
  green: (s: string) => (supportsColor ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string) => (supportsColor ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (supportsColor ? `\x1b[33m${s}\x1b[0m` : s),
  bold: (s: string) => (supportsColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (supportsColor ? `\x1b[2m${s}\x1b[0m` : s),
};

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const localMode = args.includes('--local');

if (localMode) {
  // Auto-configure for docker-compose.dev.yml defaults
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/clawdb';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.PUBSUB_EMULATOR_HOST ??= 'localhost:8085';
  process.env.GCP_PROJECT_ID ??= 'claw-army-dev';
  console.log(c.dim('--local mode: using docker-compose.dev.yml defaults\n'));
}

// ─── Checks ───────────────────────────────────────────────────────────────────

const results: CheckResult[] = [];

async function checkPostgres(): Promise<void> {
  const start = Date.now();
  const url = process.env.DATABASE_URL;

  if (!url) {
    results.push({
      name: 'PostgreSQL',
      status: 'SKIP',
      message: 'DATABASE_URL not set (set it or use --local flag)',
      durationMs: 0,
    });
    return;
  }

  try {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const res = await client.query<{ current_database: string; version: string }>(
      'SELECT current_database(), version()',
    );
    await client.end();

    const row = res.rows[0];
    const shortVersion = row.version.split(' ').slice(0, 2).join(' ');

    results.push({
      name: 'PostgreSQL',
      status: 'PASS',
      message: `db=${row.current_database} | ${shortVersion}`,
      durationMs: Date.now() - start,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    results.push({
      name: 'PostgreSQL',
      status: 'FAIL',
      message,
      durationMs: Date.now() - start,
    });
  }
}

async function checkRedis(): Promise<void> {
  const start = Date.now();
  const url = process.env.REDIS_URL;

  if (!url) {
    results.push({
      name: 'Redis',
      status: 'SKIP',
      message: 'REDIS_URL not set (set it or use --local flag)',
      durationMs: 0,
    });
    return;
  }

  let redis: Redis | null = null;

  try {
    redis = new Redis(url, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });

    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out after 5s')), 5000),
      ),
    ]);

    results.push({
      name: 'Redis',
      status: pong === 'PONG' ? 'PASS' : 'FAIL',
      message:
        pong === 'PONG' ? `PONG received from ${url}` : `Unexpected response: ${String(pong)}`,
      durationMs: Date.now() - start,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    results.push({
      name: 'Redis',
      status: 'FAIL',
      message,
      durationMs: Date.now() - start,
    });
  } finally {
    redis?.disconnect();
  }
}

async function checkPubSub(): Promise<void> {
  const start = Date.now();
  const emulatorHost = process.env.PUBSUB_EMULATOR_HOST;
  const projectId = process.env.GCP_PROJECT_ID ?? 'claw-army-dev';

  try {
    const pubsub = new PubSub({ projectId });
    const [topics] = await pubsub.getTopics();

    if (emulatorHost) {
      results.push({
        name: 'Pub/Sub (emulator)',
        status: 'PASS',
        message: `Emulator at ${emulatorHost} reachable — ${topics.length} topic(s) found`,
        durationMs: Date.now() - start,
      });
    } else {
      results.push({
        name: 'Pub/Sub (GCP)',
        status: 'PASS',
        message: `Project ${projectId} — ${topics.length} topic(s) found`,
        durationMs: Date.now() - start,
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const name = emulatorHost ? 'Pub/Sub (emulator)' : 'Pub/Sub (GCP)';
    results.push({
      name,
      status: 'FAIL',
      message,
      durationMs: Date.now() - start,
    });
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport(): void {
  const pad = (s: string, n: number) => s.padEnd(n);
  const LINE_WIDTH = 72;

  console.log('\n' + c.bold('Infrastructure Connectivity Check'));
  console.log('─'.repeat(LINE_WIDTH));

  // Header row
  console.log(
    c.bold(pad('Service', 24)) +
      c.bold(pad('Status', 8)) +
      c.bold(pad('Message', 30)) +
      c.bold('ms'),
  );
  console.log('─'.repeat(LINE_WIDTH));

  for (const r of results) {
    const statusLabel =
      r.status === 'PASS'
        ? c.green('PASS')
        : r.status === 'FAIL'
          ? c.red('FAIL')
          : c.yellow('SKIP');

    const truncMsg =
      r.message.length > 38 ? r.message.slice(0, 35) + '...' : r.message;

    const durationStr = r.status === 'SKIP' ? c.dim('—') : c.dim(`${r.durationMs}ms`);

    console.log(pad(r.name, 24) + pad(statusLabel, 14) + pad(truncMsg, 38) + durationStr);
  }

  console.log('─'.repeat(LINE_WIDTH));

  const failures = results.filter((r) => r.status === 'FAIL');
  const passes = results.filter((r) => r.status === 'PASS');
  const skips = results.filter((r) => r.status === 'SKIP');

  const summary = [
    passes.length > 0 ? c.green(`${passes.length} passed`) : null,
    failures.length > 0 ? c.red(`${failures.length} failed`) : null,
    skips.length > 0 ? c.yellow(`${skips.length} skipped`) : null,
  ]
    .filter(Boolean)
    .join(', ');

  console.log('\n' + summary + '\n');

  if (skips.length > 0 && !localMode) {
    console.log(c.dim('Tip: run with --local flag to auto-configure for docker-compose.dev.yml\n'));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(c.bold('Running connectivity checks...\n'));

  // Run all checks independently — one failure does not prevent others
  await Promise.allSettled([checkPostgres(), checkRedis(), checkPubSub()]);

  printReport();

  const anyFailed = results.some((r) => r.status === 'FAIL');
  process.exit(anyFailed ? 1 : 0);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
