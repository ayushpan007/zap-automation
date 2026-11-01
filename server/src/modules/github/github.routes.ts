import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { currentUserId } from '../../middleware/require-auth.js';
import { getUserToken } from '../auth/auth.service.js';

/** GET /api/github/repos — repos the user administers (only those can receive webhooks). */
export const githubRouter = (deps: AppDeps): Router => {
  const router = Router();
  router.get('/repos', async (req, res) => {
    const token = await getUserToken(deps.config, currentUserId(req));
    res.json({ repos: await deps.github.listAdminRepos(token) });
  });
  return router;
};
