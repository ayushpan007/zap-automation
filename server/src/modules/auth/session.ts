import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../../config/env.js';

export const SESSION_COOKIE = 'zap_session';
export const OAUTH_STATE_COOKIE = 'zap_oauth_state';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const signSession = (userId: string, secret: string): string =>
  jwt.sign({}, secret, { subject: userId, expiresIn: SESSION_TTL_SECONDS, algorithm: 'HS256' });

/** Returns the user id, or null for a missing, expired, or tampered token. */
export const verifySession = (token: string | undefined, secret: string): string | null => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    // Invalid tokens are an expected case (expiry, logout elsewhere), not an error: treat as signed out.
    return null;
  }
};

/** httpOnly: JS (and therefore XSS) cannot read it. SameSite=Lax: not sent on cross-site POSTs (CSRF). */
export const cookieOptions = (config: AppConfig, maxAgeSeconds: number): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.env === 'production',
  path: '/',
  maxAge: maxAgeSeconds * 1000,
});

export const sessionCookieOptions = (config: AppConfig) => cookieOptions(config, SESSION_TTL_SECONDS);
