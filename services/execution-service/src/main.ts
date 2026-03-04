import 'dotenv/config';

// ── Startup env var validation ───────────────────────────────────────────────
const REQUIRED_ENV = [
  'DATABASE_URL',
  'REDIS_URL',
  'AUTH_SECRET',
] as const;

const REQUIRED_PRODUCTION_ENV = [
  'GCP_PROJECT_ID',
  'GCP_ZONE',
  'GCP_NETWORK',
  'GCP_SUBNET',
  'BOT_JWT_SECRET',
  'LLM_API_KEY_SECRET_NAME',
  'GCP_BOT_SERVICE_ACCOUNT',
] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[main] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  const missingProd = REQUIRED_PRODUCTION_ENV.filter((key) => !process.env[key]);
  if (missingProd.length > 0) {
    console.error(`[main] Missing required production environment variables: ${missingProd.join(', ')}`);
    process.exit(1);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

import { buildApp } from './app';
import { startGuardrailWatchdog, stopGuardrailWatchdog } from './events/guardrail-watchdog';
import { startBillingEngine } from './events/billing-engine';
import { startOpenClawDispatcher } from './queue/openclaw-dispatcher';
import { startCouncilWorker } from './queue/council-worker';
import { startGodLayerWorker } from './queue/god-layer-worker';
import { startSpawnTimeoutChecker, stopSpawnTimeoutChecker } from './orchestrator/bot-orchestrator';

const app = await buildApp();
const port = Number(process.env['PORT'] ?? 3001);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Start the Guardrail Watchdog alongside the Fastify server.
// Polls for rate violations and loop behavior on a configurable interval.
const watchdogTimer = startGuardrailWatchdog();

// Start the Billing Engine — subscribes to billing-events and bot-lifecycle topics.
// Persists billing events, enforces atomic budget caps, and calculates bot-hours.
const billingEngine = startBillingEngine();

// Start the OpenClaw dispatcher — pulls tasks from BullMQ and dispatches them
// to available bot VMs via OpenClaw WebSocket sessions API.
// Replaces the per-container bot-worker BullMQ worker process.
const dispatcherWorker = startOpenClawDispatcher();

// Start the spawn timeout checker — polls for bots stuck in 'spawning' status
// and transitions them to 'failed' after SPAWN_TIMEOUT_MS (default 10 min).
const spawnTimer = startSpawnTimeoutChecker();

// Start the Council worker — evaluates bot performance asynchronously
// after each execution completes. Runs 3 LLM judges per bot, produces verdicts.
const councilWorker = startCouncilWorker();

// Start the God Layer worker — processes confirmed verdicts, executes class transitions,
// writes versioned DNA library entries, and manages the negative signal register.
const godLayerWorker = startGodLayerWorker();

// Graceful shutdown — clean up the watchdog timer, billing engine, dispatcher, and spawn checker
function shutdown() {
  stopGuardrailWatchdog(watchdogTimer);
  stopSpawnTimeoutChecker(spawnTimer);
  billingEngine.shutdown().catch((err) => {
    console.error('[main] Error during billing engine shutdown:', err);
  });
  dispatcherWorker.close().catch((err: Error) => {
    console.error('[main] Error closing dispatcher worker:', err);
  });
  councilWorker.close().catch((err: Error) => {
    console.error('[main] Error closing council worker:', err);
  });
  godLayerWorker.close().catch((err: Error) => {
    console.error('[main] Error closing god-layer worker:', err);
  });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
