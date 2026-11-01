import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { AppDeps } from './app-deps.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requireAuth } from './middleware/require-auth.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { githubRouter } from './modules/github/github.routes.js';
import { meRouter } from './modules/users/me.routes.js';
import { webhookRouter } from './modules/webhooks/webhook.routes.js';
import { zapRouter } from './modules/zaps/zap.routes.js';

/**
 * Builds the Express app without starting it or connecting to Mongo, so tests can drive it with supertest.
 * Every route is registered here, in one place:
 *
 *   /auth/github, /auth/github/callback, /auth/logout   OAuth + session   (public)
 *   /webhooks/github                                    GitHub deliveries (HMAC-authenticated)
 *   /api/me, /api/apps, /api/github/repos, /api/zaps…   JSON API          (session required)
 */
export const createApp = (deps: AppDeps): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind the Angular dev proxy / ngrok; needed for correct client IPs in rate limiting
  app.use(helmet());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Before express.json(): the webhook route needs the raw body to verify its signature.
  app.use('/webhooks', webhookRouter(deps));

  app.use(express.json({ limit: '100kb' }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: 'draft-8', legacyHeaders: false });
  app.use('/auth', authLimiter, authRouter(deps));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  api.use(requireAuth(deps.config.jwtSecret));
  api.use('/me', meRouter());
  api.use('/apps', catalogRouter());
  api.use('/github', githubRouter(deps));
  api.use('/zaps', zapRouter(deps));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
