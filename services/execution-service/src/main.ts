import 'dotenv/config';
import { buildApp } from './app';
import { startGuardrailWatchdog, stopGuardrailWatchdog } from './events/guardrail-watchdog';
import { startBillingEngine } from './events/billing-engine';

const app = buildApp();
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

// Graceful shutdown — clean up the watchdog timer and billing engine on process exit
function shutdown() {
  stopGuardrailWatchdog(watchdogTimer);
  billingEngine.shutdown().catch((err) => {
    console.error('[main] Error during billing engine shutdown:', err);
  });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
