import { Router } from 'express';
import { soulsRouter } from './souls.js';

const akasaRouter = Router();

// Health check endpoint -- proves Akasa routes are mounted and reachable
akasaRouter.get('/akasa/health', (_req, res) => {
  res.json({ status: 'ok', service: 'akasa', timestamp: new Date().toISOString() });
});

// Soul CRUD + generation + mutation + injection
akasaRouter.use('/akasa/souls', soulsRouter());

export { akasaRouter };
