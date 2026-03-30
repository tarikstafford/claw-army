import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, applyPendingMigrations } from '@paperclipai/db';
import { db as akasaDb } from '@claw/db';
import { createApp } from '../../../paperclip/server/src/app.js';
import { loadConfig } from '../../../paperclip/server/src/config.js';
import { createStorageServiceFromConfig } from '../../../paperclip/server/src/storage/index.js';
import { setupLiveEventsWebSocketServer } from '../../../paperclip/server/src/realtime/live-events-ws.js';
import { akasaRouter } from './routes/index.js';
import { startEvolutionPolling } from './routes/evolution-trigger.js';

async function ensureToolNexusPlugin(port: number): Promise<void> {
  const pluginPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../packages/plugins/akasa-tool-nexus'
  );

  // Skip if dist not built (dev without pre-build)
  const distWorker = path.join(pluginPath, 'dist', 'worker.js');
  try {
    const { accessSync } = await import('node:fs');
    accessSync(distWorker);
  } catch {
    console.warn('[akasa-server] Tool Nexus plugin dist not found — skipping install. Run: pnpm --filter @claw/plugin-tool-nexus build');
    return;
  }

  try {
    // Check if already loaded
    const listRes = await fetch(`http://localhost:${port}/api/plugins`);
    if (listRes.ok) {
      const plugins = (await listRes.json()) as Array<{ pluginKey: string; status: string }>;
      const existing = plugins.find(p => p.pluginKey === 'akasa.tool-nexus');
      if (existing?.status === 'ready') {
        console.log('[akasa-server] Tool Nexus plugin already ready');
        return;
      }
    }

    // Install via Paperclip's own install route
    const installRes = await fetch(`http://localhost:${port}/api/plugins/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName: pluginPath, isLocalPath: true }),
    });

    if (!installRes.ok) {
      const body = (await installRes.json()) as { error?: string };
      if (body.error?.includes('already installed')) {
        console.log('[akasa-server] Tool Nexus plugin already in registry');
        return;
      }
      console.error('[akasa-server] Tool Nexus plugin install failed:', body.error);
      return;
    }

    console.log('[akasa-server] Tool Nexus plugin installed and ready');
  } catch (err) {
    console.error('[akasa-server] Tool Nexus startup install error:', (err as Error).message);
    // Non-fatal — server continues without tool nexus
  }
}

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error(
    '[akasa-server] DATABASE_URL must be set. Embedded PostgreSQL is not supported in akasa-server dev mode. ' +
      'Start Postgres with: docker compose -f docker-compose.dev.yml up -d',
  );
}

if (!process.env['WEBHOOK_URL_SECRET']) {
  throw new Error(
    '[akasa-server] WEBHOOK_URL_SECRET must be set. ' +
    'Generate with: openssl rand -hex 32',
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

// Install Tool Nexus plugin into Paperclip runtime (idempotent)
void ensureToolNexusPlugin(config.port).catch(err =>
  console.error('[akasa-server] Tool Nexus install failed:', (err as Error).message)
);

// Start evolution polling — checks heartbeat_runs every 60s for completed Akasa-managed agent runs
startEvolutionPolling(db as never, akasaDb as never);
console.log('[akasa-server] Evolution polling started (60s interval)');
