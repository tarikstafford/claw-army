import { createServer } from 'node:http';
import { createDb, applyPendingMigrations } from '@paperclipai/db';
import { db as akasaDb } from '@claw/db';
import { createApp } from '../../../paperclip/server/src/app.js';
import { loadConfig } from '../../../paperclip/server/src/config.js';
import { createStorageServiceFromConfig } from '../../../paperclip/server/src/storage/index.js';
import { setupLiveEventsWebSocketServer } from '../../../paperclip/server/src/realtime/live-events-ws.js';
import { akasaRouter } from './routes/index.js';
import { startEvolutionPolling } from './routes/evolution-trigger.js';

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error(
    '[akasa-server] DATABASE_URL must be set. Embedded PostgreSQL is not supported in akasa-server dev mode. ' +
      'Start Postgres with: docker compose -f docker-compose.dev.yml up -d',
  );
}

console.log('[akasa-server] Applying Paperclip migrations...');
await applyPendingMigrations(config.databaseUrl);

const db = createDb(config.databaseUrl);

const storageService = createStorageServiceFromConfig(config);

const app = await createApp(db, {
  uiMode: 'none',
  serverPort: config.port,
  storageService,
  deploymentMode: config.deploymentMode,
  deploymentExposure: config.deploymentExposure,
  allowedHostnames: config.allowedHostnames,
  bindHost: config.host,
  authReady: config.deploymentMode === 'local_trusted',
  companyDeletionEnabled: config.companyDeletionEnabled,
  extraApiRouter: akasaRouter,
});

const server = createServer(app as unknown as Parameters<typeof createServer>[0]);

setupLiveEventsWebSocketServer(server, db, {
  deploymentMode: config.deploymentMode,
  resolveSessionFromHeaders: undefined,
});

await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(config.port, config.host, () => {
    server.off('error', reject);
    resolve();
  });
});

console.log(`[akasa-server] Listening on http://${config.host}:${config.port}`);
console.log(`[akasa-server] Health check: http://localhost:${config.port}/api/akasa/health`);

// Start evolution polling — checks heartbeat_runs every 60s for completed Akasa-managed agent runs
startEvolutionPolling(db as never, akasaDb as never);
console.log('[akasa-server] Evolution polling started (60s interval)');
