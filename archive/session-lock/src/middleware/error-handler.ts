import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { AppError, ErrorCodes } from '../errors';

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, ErrorCodes.NOT_FOUND, 'مسیر درخواستی پیدا نشد.'));
}

export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (res.headersSent) {
      next(error);
      return;
    }

    // Malformed JSON body from express.json()
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'بدنه‌ی درخواست JSON معتبر نیست.',
        },
        requestId: req.requestId,
      });
      return;
    }

    if (error instanceof AppError) {
      logger.warn(
        {
          requestId: req.requestId,
          code: error.code,
          status: error.status,
          path: req.path,
          method: req.method,
        },
        'request rejected',
      );
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        requestId: req.requestId,
      });
      return;
    }

    logger.error({ requestId: req.requestId, err: error }, 'unhandled error');
    res.status(500).json({
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'خطای داخلی سرور. لطفاً بعداً تلاش کنید.',
      },
      requestId: req.requestId,
    });
  };
}
