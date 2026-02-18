import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { authPlugin } from './middleware/auth';
import { toolInvokeRoutes } from './routes/tool-invoke';

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register JWT auth plugin (also decorates fastify.authenticate)
  await app.register(authPlugin);

  // Register tool invoke routes
  await app.register(toolInvokeRoutes);

  // Health check (no auth required)
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
