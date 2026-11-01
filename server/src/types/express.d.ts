// Adds the authenticated user id that `requireAuth` attaches to the request.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
