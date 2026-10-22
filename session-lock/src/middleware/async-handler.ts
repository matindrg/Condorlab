import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 does not catch rejected promises; this wrapper forwards them. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
