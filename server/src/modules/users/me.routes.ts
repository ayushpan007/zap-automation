import { Router } from 'express';
import { notFound } from '../../errors/app-error.js';
import { currentUserId } from '../../middleware/require-auth.js';
import { UserModel } from './user.model.js';

/** GET /api/me — the signed-in user's public profile. Angular calls this to know if a session exists. */
export const meRouter = (): Router => {
  const router = Router();
  router.get('/', async (req, res) => {
    const user = await UserModel.findById(currentUserId(req)).lean();
    if (!user) throw notFound('User');
    res.json({ id: user._id.toString(), login: user.login, name: user.name, avatarUrl: user.avatarUrl });
  });
  return router;
};
