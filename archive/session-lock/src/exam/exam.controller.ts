import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError, ErrorCodes } from '../errors';
import { HEARTBEAT_INTERVAL_MS } from '../constants';
import type { AttemptService } from '../attempts/attempt.service';
import type { ExamLockService } from './lock.service';

const attemptIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'attemptId نامعتبر است');

const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

const answerSchema = z.object({
  questionId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  value: answerValueSchema,
});

const heartbeatSchema = z
  .object({
    clientSeq: z.number().int().nonnegative().optional(),
    answers: z.array(answerSchema).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.answers && value.answers.length > 0 && value.clientSeq === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientSeq'],
        message: 'clientSeq برای ارسال پاسخ الزامی است.',
      });
    }
  });

const takeoverSchema = z.object({
  confirm: z.literal(true),
});

function parseAttemptId(raw: unknown): string {
  const result = attemptIdSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'شناسه‌ی تلاش نامعتبر است.');
  }
  return result.data;
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'داده‌های ورودی نامعتبر است.', result.error.flatten());
  }
  return result.data;
}

function context(req: Request) {
  if (!req.auth) {
    // Defensive: requireAuth must run before the controller.
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'احراز هویت نشده است.');
  }
  return {
    attemptId: parseAttemptId(req.params.attemptId),
    userId: req.auth.userId,
    sessionId: req.auth.sessionId,
    deviceId: req.auth.deviceId,
  };
}

export class ExamController {
  constructor(
    private readonly attempts: AttemptService,
    private readonly lock: ExamLockService,
  ) {}

  start = async (req: Request, res: Response): Promise<void> => {
    const ctx = context(req);
    await this.attempts.getActiveForUser(ctx.attemptId, ctx.userId);

    const result = await this.lock.acquire(ctx);
    if (result.status === 'limit_reached') {
      throw new AppError(403, ErrorCodes.TAKEOVER_LIMIT_REACHED, 'سقف جابه‌جایی دستگاه در این آزمون پر شده است.', {
        takeoverCount: result.takeoverCount,
        remainingTakeovers: 0,
        canTakeover: false,
      });
    }
    if (result.status === 'locked_by_other') {
      const remainingTakeovers = await this.lock.remainingTakeovers(ctx.attemptId);
      throw new AppError(409, ErrorCodes.EXAM_LOCKED, 'آزمون روی دستگاه دیگری باز است.', {
        version: result.version,
        lockedAt: result.lockedAt,
        expiresAt: result.expiresAt,
        canTakeover: remainingTakeovers > 0,
        remainingTakeovers,
      });
    }

    res.status(200).json({
      data: {
        ...result,
        serverTime: new Date().toISOString(),
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      },
    });
  };

  heartbeat = async (req: Request, res: Response): Promise<void> => {
    const ctx = context(req);
    const body = parseBody(heartbeatSchema, req.body);

    await this.attempts.getActiveForUser(ctx.attemptId, ctx.userId);
    const result = await this.lock.heartbeat(ctx, body);

    if (result.status !== 'ok') {
      const code = result.status === 'lock_lost' ? ErrorCodes.EXAM_LOCK_LOST : ErrorCodes.EXAM_LOCK_MISSING;
      const message =
        result.status === 'lock_lost'
          ? 'آزمون در دستگاه دیگری ادامه یافته است؛ این دستگاه دیگر مالک آزمون نیست.'
          : 'قفل آزمون منقضی شده است.';
      throw new AppError(403, code, message, {
        ...result,
        reason: result.status,
        serverTime: new Date().toISOString(),
      });
    }

    res.status(200).json({
      data: {
        ...result,
        serverTime: new Date().toISOString(),
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      },
    });
  };

  takeover = async (req: Request, res: Response): Promise<void> => {
    const ctx = context(req);
    parseBody(takeoverSchema, req.body);
    await this.attempts.getActiveForUser(ctx.attemptId, ctx.userId);

    const result = await this.lock.takeover(ctx);

    if (result.status === 'limit_reached') {
      throw new AppError(403, ErrorCodes.TAKEOVER_LIMIT_REACHED, 'سقف جابه‌جایی دستگاه در این آزمون پر شده است.', {
        ...result,
      });
    }
    if (result.status === 'wrong_user') {
      throw new AppError(403, ErrorCodes.EXAM_LOCK_OWNERSHIP_MISMATCH, 'مالکیت قفل آزمون معتبر نیست.');
    }

    res.status(200).json({
      data: {
        ...result,
        serverTime: new Date().toISOString(),
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      },
    });
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const ctx = context(req);
    const body = parseBody(heartbeatSchema, req.body ?? {});

    const { alreadySubmitted } = await this.attempts.getForSubmit(ctx.attemptId, ctx.userId);
    if (alreadySubmitted) {
      res.status(200).json({ data: { status: 'already_submitted' } });
      return;
    }

    const heartbeat = await this.lock.heartbeat(ctx, body);
    if (heartbeat.status !== 'ok') {
      const code = heartbeat.status === 'lock_lost' ? ErrorCodes.EXAM_LOCK_LOST : ErrorCodes.EXAM_LOCK_MISSING;
      throw new AppError(403, code, 'ارسال نهایی انجام نشد؛ قفل آزمون در اختیار این دستگاه نیست.', {
        ...heartbeat,
        reason: heartbeat.status,
        serverTime: new Date().toISOString(),
      });
    }

    await this.attempts.markSubmitted(ctx.attemptId);
    await this.lock.release(ctx.attemptId);

    res.status(200).json({
      data: {
        status: 'submitted',
        version: heartbeat.version,
        ackedSeq: heartbeat.ackedSeq,
        serverTime: new Date().toISOString(),
      },
    });
  };

  state = async (req: Request, res: Response): Promise<void> => {
    const ctx = context(req);
    await this.attempts.getActiveForUser(ctx.attemptId, ctx.userId);
    const state = await this.lock.getState(ctx);
    res.status(200).json({
      data: {
        ...state,
        serverTime: new Date().toISOString(),
        heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      },
    });
  };
}
