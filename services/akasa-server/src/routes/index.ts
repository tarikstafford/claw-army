import { Router } from 'express';

const akasaRouter = Router();

// Health check endpoint -- proves Akasa routes are mounted and reachable
akasaRouter.get('/akasa/health', (_req, res) => {
  res.json({ status: 'ok', service: 'akasa', timestamp: new Date().toISOString() });
});

export { akasaRouter };
