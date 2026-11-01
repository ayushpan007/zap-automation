import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppDeps } from '../../app-deps.js';
import { validateBody } from '../../middleware/validate.js';
import { currentUserId } from '../../middleware/require-auth.js';
import { draftZap } from './copilot.service.js';

export const copilotRequestSchema = z.object({
  text: z.string().trim().min(3, 'Describe the Zap you want').max(500, 'Keep the description under 500 characters'),
});

/**
 * Mounted at /api/copilot behind requireAuth.
 *   POST /api/copilot/draft  { text }  →  200 { name, body, repo, explanation }  (nothing is saved)
 * Each call costs money, so it has its own tighter rate limit on top of the API-wide one.
 */
export const copilotRouter = (deps: AppDeps): Router => {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
  router.post('/draft', limiter, validateBody(copilotRequestSchema), async (req: Request, res: Response) => {
    const { text } = req.body as z.infer<typeof copilotRequestSchema>;
    res.json(await draftZap(deps, currentUserId(req), text));
  });
  return router;
};
