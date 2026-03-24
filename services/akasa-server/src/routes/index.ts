import { Router } from 'express';
import { soulsRouter } from './souls.js';
import { councilRouter } from './council.js';
import { evolutionTriggerRouter } from './evolution-trigger.js';

const akasaRouter = Router();

// Health check endpoint -- proves Akasa routes are mounted and reachable
akasaRouter.get('/akasa/health', (_req, res) => {
  res.json({ status: 'ok', service: 'akasa', timestamp: new Date().toISOString() });
});

// Soul CRUD + generation + mutation + injection
akasaRouter.use('/akasa/souls', soulsRouter());

// Council verdict CRUD routes
akasaRouter.use('/akasa/verdicts', councilRouter());

// Evolution trigger routes (manual trigger + polling setup)
akasaRouter.use('/akasa/evolution', evolutionTriggerRouter());

export { akasaRouter };
