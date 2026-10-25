import type { NextFunction, Request, Response } from 'express';
import { AppError, ErrorCodes } from '../errors';
import { verifyToken } from './jwt';
import type { SessionService } from '../session/session.service';

export interface AuthContext {
  userId: string;
  sessionId: string;
  deviceId: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}

/**
 * Bearer-token auth + session validation.
 *
 * The device id comes from the signed JWT (`did`), never from a client header.
 * That prevents a stolen token from silently claiming another device id.
 */
export function createRequireAuth(sessions: SessionService, jwtSecret: string) {
  return async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'برای ادامه وارد شوید.');
      }

      const token = header.slice('Bearer '.length).trim();
      let payload;
      try {
        payload = verifyToken(token, jwtSecret);
      } catch {
        throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'توکن ورود نامعتبر یا منقضی است.');
      }

      await sessions.assertSession(payload.sid, payload.sub, payload.did);

      req.auth = {
        userId: payload.sub,
        sessionId: payload.sid,
        deviceId: payload.did,
        role: payload.role ?? 'student',
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
