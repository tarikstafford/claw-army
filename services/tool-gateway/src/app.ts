import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { authPlugin } from './middleware/auth';
import { toolInvokeRoutes } from './routes/tool-invoke';
import { attachProxyHandlers } from './routes/proxy';

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register JWT auth plugin (also decorates fastify.authenticate)
  await app.register(authPlugin);

  // Register tool invoke routes (kept for backward compatibility)
  await app.register(toolInvokeRoutes);

  // Attach HTTP forward proxy + CONNECT tunnel handlers.
  // - CONNECT is handled at the raw Node.js server level (bypasses Fastify routing)
  // - HTTP forward proxy is handled via setNotFoundHandler
  attachProxyHandlers(app);

  // Health check (no auth required)
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
