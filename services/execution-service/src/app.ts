import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import sse from '@fastify/sse';
import { executionsRoutes } from './routes/executions';
import { sseRoutes, lifecycleSseRoutes } from './routes/sse';
import { metricsRoutes } from './routes/metrics';
import { botsRoutes } from './routes/bots';
import { billingRoutes } from './routes/billing';
import { adminRoutes } from './routes/admin';
import { verdictsRoutes } from './routes/verdicts';
import { armyBuilderRoutes } from './routes/army-builder';
import { objectivesRoutes } from './routes/objectives';
import { ringLeaderRoutes } from './routes/ring-leader';
import { soulsRoutes } from './routes/souls';
import { categoryBenchmarksRoutes } from './routes/category-benchmarks';
import { decisionTracesRoutes } from './routes/decision-traces';
import { negativeSignalsRoutes } from './routes/negative-signals';
import { authRoutes } from './routes/auth';

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // CORS must be registered BEFORE routes — Fastify plugin registration order matters
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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

  // Verdict confirmation gate (Phase 12)
  app.register(verdictsRoutes, { prefix: '/verdicts' });

  // Soul lifecycle SSE (Phase 14 — UIEX-03)
  app.register(lifecycleSseRoutes, { prefix: '/events' });

  // Army Builder analysis (Phase 14 — UIEX-04/05)
  app.register(armyBuilderRoutes, { prefix: '/army-builder' });

  // Objectives CRUD (Phase 16 — OBJ-01 through OBJ-04)
  app.register(objectivesRoutes, { prefix: '/objectives' });

  // Ring Leader API — pre-flight manifest and run lookup (Phase 28 — SPAWN-07)
  app.register(ringLeaderRoutes, { prefix: '/ring-leader' });

  // Soul Library browser (Phase 39 — SOUL-01)
  app.register(soulsRoutes, { prefix: '/souls' });

  // Category Benchmarks page (Phase 39 — SOUL-04)
  app.register(categoryBenchmarksRoutes, { prefix: '/category-benchmarks' });

  // Decision Trace Viewer (Phase 39 — SOUL-02)
  app.register(decisionTracesRoutes, { prefix: '/decision-traces' });

  // Negative Signal Register (Phase 39 — SOUL-03)
  app.register(negativeSignalsRoutes, { prefix: '/negative-signals' });

  // BetterAuth — Google OAuth + session management
  app.register(authRoutes, { prefix: '/auth' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
