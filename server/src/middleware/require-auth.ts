import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { SESSION_COOKIE, verifySession } from '../modules/auth/session.js';

/** The server-side auth boundary. Angular's route guard is only UX; this is what actually protects data. */
export const requireAuth =
  (jwtSecret: string): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const userId = verifySession(req.cookies?.[SESSION_COOKIE] as string | undefined, jwtSecret);
    if (!userId) return next(new AppError('UNAUTHENTICATED', 'Sign in required'));
    req.userId = userId;
    next();
  };

/** Narrows `req.userId` to a string inside handlers mounted behind `requireAuth`. */
export const currentUserId = (req: Request): string => {
  if (!req.userId) throw new AppError('UNAUTHENTICATED', 'Sign in required');
  return req.userId;
};
