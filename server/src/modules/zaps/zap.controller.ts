import type { Request, Response } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { currentUserId } from '../../middleware/require-auth.js';
import { objectIdParam, type CreateZapInput, type UpdateZapInput } from './zap.schema.js';
import * as zaps from './zap.service.js';

/** Controllers only translate HTTP <-> service calls. Business rules live in the service and pure helpers. */
export const zapController = (deps: AppDeps) => ({
  list: async (req: Request, res: Response) => {
    res.json({ zaps: await zaps.listZaps(currentUserId(req)) });
  },
  get: async (req: Request, res: Response) => {
    res.json(await zaps.getZap(currentUserId(req), objectIdParam.parse(req.params.id)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await zaps.createZap(deps, currentUserId(req), req.body as CreateZapInput));
  },
  update: async (req: Request, res: Response) => {
    res.json(await zaps.updateZap(deps, currentUserId(req), objectIdParam.parse(req.params.id), req.body as UpdateZapInput));
  },
  remove: async (req: Request, res: Response) => {
    await zaps.deleteZap(deps, currentUserId(req), objectIdParam.parse(req.params.id));
    res.status(204).end();
  },
  runs: async (req: Request, res: Response) => {
    res.json({ runs: await zaps.listRuns(currentUserId(req), objectIdParam.parse(req.params.id)) });
  },
});
