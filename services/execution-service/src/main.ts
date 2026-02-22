import 'dotenv/config';
import { buildApp } from './app';
import { startGuardrailWatchdog, stopGuardrailWatchdog } from './events/guardrail-watchdog';
import { startBillingEngine } from './events/billing-engine';
import { startOpenClawDispatcher } from './queue/openclaw-dispatcher';
import { startCouncilWorker } from './queue/council-worker';

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

// Start the Council worker — evaluates bot performance asynchronously
// after each execution completes. Runs 3 LLM judges per bot, produces verdicts.
const councilWorker = startCouncilWorker();

// Graceful shutdown — clean up the watchdog timer, billing engine, and dispatcher
function shutdown() {
  stopGuardrailWatchdog(watchdogTimer);
  billingEngine.shutdown().catch((err) => {
    console.error('[main] Error during billing engine shutdown:', err);
  });
  dispatcherWorker.close().catch((err: Error) => {
    console.error('[main] Error closing dispatcher worker:', err);
  });
  councilWorker.close().catch((err: Error) => {
    console.error('[main] Error closing council worker:', err);
  });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
