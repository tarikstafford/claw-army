import 'dotenv/config';

// ── Startup env var validation ───────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL'] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[tool-gateway] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (!process.env.PROXY_DOMAIN_ALLOWLIST && process.env.NODE_ENV === 'production') {
  console.warn('[tool-gateway] PROXY_DOMAIN_ALLOWLIST is not set — all domains will be allowed. This is unsafe for production.');
}
// ─────────────────────────────────────────────────────────────────────────────

import { buildApp } from './app';

const app = await buildApp();
const port = Number(process.env['PORT'] ?? 3002);

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[tool-gateway] Listening on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
