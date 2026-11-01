import { Router } from 'express';
import { CATALOG } from './catalog.data.js';

export const catalogRouter = (): Router => {
  const router = Router();
  // GET /api/apps — static, so no service layer: there is nothing to orchestrate.
  router.get('/', (_req, res) => {
    res.json({ apps: CATALOG });
  });
  return router;
};
