import { createServer } from 'node:http';
import express from 'express';
import { db } from '@claw/db';
import { akasaRouter } from './routes/index.js';
import { startEvolutionPolling } from './routes/evolution-trigger.js';

const PORT = parseInt(process.env['PORT'] ?? '3100', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

if (!process.env['DATABASE_URL']) {
  throw new Error(
    '[akasa-server] DATABASE_URL must be set. ' +
      'Start Postgres with: docker compose -f docker-compose.dev.yml up -d',
  );
}

const app = express();

app.use(express.json());

// Mount Akasa routes under /api
app.use('/api', akasaRouter);

const server = createServer(app);

await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, HOST, () => {
    server.off('error', reject);
    resolve();
  });
});

console.log(`[akasa-server] Listening on http://${HOST}:${PORT}`);
console.log(`[akasa-server] Health check: http://localhost:${PORT}/api/akasa/health`);

// Start evolution polling — checks heartbeat_runs every 60s for completed Akasa-managed agent runs
startEvolutionPolling(db as never);
console.log('[akasa-server] Evolution polling started (60s interval)');
