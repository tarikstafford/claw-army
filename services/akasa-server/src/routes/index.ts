import { akashicRouter } from './akashic.js';
import { Router } from 'express';
import { soulsRouter } from './souls.js';
import { councilRouter } from './council.js';
import { evolutionTriggerRouter } from './evolution-trigger.js';
import { evolutionDashboardRouter } from './evolution-dashboard.js';
import { godLayerRouter } from './god-layer.js';
import { toolConnectionsRouter } from './tool-connections.js';
import { webhooksRouter } from './webhooks.js';
import { oauthFlowRouter } from './oauth-flow.js';
import { webhookRoutingRulesRouter } from './webhook-routing-rules.js';
import { webhookLogsRouter } from './webhook-logs.js';
import { internalRouter } from './internal.js';
import { githubRouter } from './github.js';
import { commandsRouter } from './commands.js';
import { settingsRouter } from './settings.js';

const akasaRouter = Router();

// Health check endpoint -- proves Akasa routes are mounted and reachable
akasaRouter.get('/akasa/health', (_req, res) => {
  res.json({ status: 'ok', service: 'akasa', timestamp: new Date().toISOString() });
});

// Akashic Library marketplace routes
akasaRouter.use('/akasa/akashic', akashicRouter());

// Council verdict CRUD routes (GET / and GET /:id)
akasaRouter.use('/akasa/verdicts', councilRouter());

// God Layer confirm/reject verdict routes (PATCH /:id/confirm and PATCH /:id/reject)
akasaRouter.use('/akasa/verdicts', godLayerRouter());

// Evolution trigger routes (manual trigger + polling setup)
akasaRouter.use('/akasa/evolution', evolutionTriggerRouter());

// Evolution dashboard GET routes (fleet, agents, timeline, lineage, ledger, benchmarks, pending)
akasaRouter.use('/akasa/evolution', evolutionDashboardRouter());

// Tool connection CRUD routes + test + logs
akasaRouter.use('/akasa/tool-connections', toolConnectionsRouter());

// OAuth authorization code flow: start + callback
akasaRouter.use('/akasa/tool-connections', oauthFlowRouter());

// GitHub API routes (authenticated via GitHub OAuth connection)
akasaRouter.use('/akasa', githubRouter());

// Webhook receiver routes: unique URL tokens + signature verification
akasaRouter.use('/akasa/webhooks', webhooksRouter());

// Webhook routing rules CRUD (GET / POST / DELETE /:id)
akasaRouter.use('/akasa/webhook-routing-rules', webhookRoutingRulesRouter());

// Aggregated webhook logs (GET /logs?userId=...)
akasaRouter.use('/akasa/webhooks', webhookLogsRouter());

// Internal endpoints for cross-service lookups (plugin worker → akasa-server)
// WARNING: No auth — relies on local_trusted mode (localhost-only access)
akasaRouter.use('/akasa/internal', internalRouter());

// Quick command executor (status, pause, resume, assign)
akasaRouter.use('/akasa/commands', commandsRouter());

// User settings: profile, preferences, API keys
akasaRouter.use('/akasa/settings', settingsRouter());

export { akasaRouter };
