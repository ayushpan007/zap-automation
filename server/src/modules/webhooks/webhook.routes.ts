import express, { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { webhookController } from './webhook.controller.js';

export const webhookRouter = (deps: AppDeps): Router => {
  const router = Router();
  // Raw bytes, not parsed JSON: the signature is computed over the exact body GitHub sent.
  router.post('/github', express.raw({ type: 'application/json', limit: '2mb' }), webhookController(deps).receive);
  return router;
};
