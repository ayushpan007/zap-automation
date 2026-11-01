import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { authController } from './auth.controller.js';

export const authRouter = (deps: AppDeps): Router => {
  const c = authController(deps);
  const router = Router();
  router.get('/github', c.start);
  router.get('/github/callback', c.callback);
  router.post('/logout', c.logout);
  return router;
};
