import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import sse from '@fastify/sse';
import { executionsRoutes } from './routes/executions';
import { sseRoutes } from './routes/sse';
import { metricsRoutes } from './routes/metrics';
import { botsRoutes } from './routes/bots';
import { billingRoutes } from './routes/billing';
import { adminRoutes } from './routes/admin';

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // CORS must be registered BEFORE routes — Fastify plugin registration order matters
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // SSE plugin — enables { sse: true } route option and reply.sse API
  await app.register(sse);

  // Existing routes
  app.register(executionsRoutes, { prefix: '/executions' });

  // New route plugins (Phase 6)
  app.register(sseRoutes, { prefix: '/executions' });
  app.register(metricsRoutes, { prefix: '/executions' });
  app.register(botsRoutes, { prefix: '/bots' });
  app.register(billingRoutes, { prefix: '/billing' });

  // Admin routes (Phase 10 — decision trace cleanup)
  app.register(adminRoutes, { prefix: '/admin' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
