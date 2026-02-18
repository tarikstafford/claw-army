import 'dotenv/config';
import { buildApp } from './app';
import { startGuardrailWatchdog, stopGuardrailWatchdog } from './events/guardrail-watchdog';

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

// Graceful shutdown — clean up the watchdog timer on process exit
function shutdown() {
  stopGuardrailWatchdog(watchdogTimer);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
