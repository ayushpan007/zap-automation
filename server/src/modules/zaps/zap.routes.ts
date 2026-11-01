import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { validateBody } from '../../middleware/validate.js';
import { zapController } from './zap.controller.js';
import { createZapSchema, updateZapSchema } from './zap.schema.js';

/** Mounted at /api/zaps behind requireAuth. */
export const zapRouter = (deps: AppDeps): Router => {
  const c = zapController(deps);
  const router = Router();
  router.get('/', c.list);
  router.post('/', validateBody(createZapSchema), c.create);
  router.get('/:id', c.get);
  router.patch('/:id', validateBody(updateZapSchema), c.update);
  router.delete('/:id', c.remove);
  router.get('/:id/runs', c.runs);
  return router;
};
