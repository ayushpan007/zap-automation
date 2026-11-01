import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { buildAuthorizeUrl, completeLogin } from './auth.service.js';
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, cookieOptions, sessionCookieOptions, signSession } from './session.js';

// Compare byte lengths, not string lengths: timingSafeEqual throws on unequal buffers, and a
// non-ASCII `state` has more bytes than characters.
const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const authController = (deps: AppDeps) => ({
  // GET /auth/github
  start: (_req: Request, res: Response) => {
    const state = randomBytes(24).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions(deps.config, 10 * 60));
    res.redirect(buildAuthorizeUrl(deps.config.github.clientId, deps.config.clientUrl, state));
  },

  // GET /auth/github/callback?code&state — browser lands here after "Authorize" on GitHub.
  callback: async (req: Request, res: Response) => {
    const { code, state } = req.query;
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    const fail = (reason: string) => res.redirect(`${deps.config.clientUrl}/login?error=${reason}`);

    if (typeof code !== 'string' || typeof state !== 'string' || !expectedState || !safeEqual(state, expectedState)) {
      return fail('invalid_state');
    }
    try {
      const userId = await completeLogin(deps, code);
      res.cookie(SESSION_COOKIE, signSession(userId, deps.config.jwtSecret), sessionCookieOptions(deps.config));
      return res.redirect(`${deps.config.clientUrl}/zaps`);
    } catch (err) {
      console.error('[auth] GitHub login failed', err);
      return fail('github_failed');
    }
  },

  // POST /auth/logout
  logout: (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  },
});
