import type { NextFunction, Request, Response } from 'express';
import type Redis from 'ioredis';
import { AppError, ErrorCodes } from '../errors';

/**
 * Distributed fixed-window rate limit. Fails open on Redis errors so a cache
 * outage does not take the exam down; the lock Lua scripts still enforce the
 * security-critical invariants.
 */
export function createRateLimit(
  redis: Redis,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  return async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identity = req.auth?.userId ?? req.ip ?? 'anonymous';
      const key = `rate:${scope}:${identity}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      if (count > limit) {
        res.setHeader('Retry-After', String(windowSeconds));
        throw new AppError(429, ErrorCodes.RATE_LIMITED, 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.');
      }
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      // eslint-disable-next-line no-console
      console.error('[rate-limit] redis failure, failing open', error);
      next();
    }
  };
}
