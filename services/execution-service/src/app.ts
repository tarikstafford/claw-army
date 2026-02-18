import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { executionsRoutes } from './routes/executions';

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.register(executionsRoutes, { prefix: '/executions' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
