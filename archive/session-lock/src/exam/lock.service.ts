import type Redis from 'ioredis';
import type { ExamLockScripts } from '../redis/scripts';
import {
  ANSWERS_TTL_SECONDS,
  HEARTBEAT_TTL_SECONDS,
  LOCK_TTL_SECONDS,
  MAX_ANSWERS_PER_SYNC,
  MAX_ANSWER_BYTES,
  MAX_SYNC_BYTES,
  TAKEOVER_COUNT_TTL_SECONDS,
} from '../constants';
import { AppError, ErrorCodes } from '../errors';

export interface LockContext {
  attemptId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
}

export interface AnswerInput {
  questionId: string;
  value: unknown;
}

export interface HeartbeatInput {
  clientSeq?: number;
  answers?: AnswerInput[];
}

export type AcquireResult =
  | { status: 'acquired' | 'already_locked'; version: number; expiresAt: string }
  | { status: 'locked_by_other'; version: number; lockedAt?: string; expiresAt: string }
  | { status: 'limit_reached'; takeoverCount: number };

export type HeartbeatResult =
  | {
      status: 'ok';
      version: number;
      ackedSeq: number;
      takeoverCount: number;
      remainingTakeovers: number;
      expiresAt: string;
    }
  | {
      status: 'lock_lost';
      version: number;
      remainingTakeovers: number;
      canTakeover: boolean;
    }
  | {
      status: 'lock_missing';
      remainingTakeovers: number;
      canTakeover: boolean;
    };

export type TakeoverResult =
  | {
      status: 'taken_over' | 'acquired' | 'already_owner';
      version: number;
      takeoverCount: number;
      remainingTakeovers: number;
      previousDeviceId?: string;
      expiresAt: string;
    }
  | {
      status: 'limit_reached';
      version: number;
      takeoverCount: number;
      remainingTakeovers: 0;
    }
  | { status: 'wrong_user' };

export interface LockState {
  locked: boolean;
  isOwner: boolean;
  version: number;
  lockedAt?: string;
  expiresAt?: string;
  takeoverCount: number;
  remainingTakeovers: number;
}

/**
 * Redis-backed active exam lock.
 *
 * Keys:
 *   exam_lock:{attemptId}      hash, TTL 180s
 *   heartbeat:{attemptId}      hash, TTL 180s
 *   exam_takeover_count:{id}   string, TTL 24h
 *   exam_answers:{attemptId}    hash, TTL 24h (demo; SQL in production)
 *   exam_answer_meta:{id}      hash, TTL 24h
 */
export class ExamLockService {
  constructor(
    private readonly redis: Redis,
    private readonly scripts: ExamLockScripts,
    private readonly takeoverLimit: number,
    private readonly lockTtl = LOCK_TTL_SECONDS,
    private readonly heartbeatTtl = HEARTBEAT_TTL_SECONDS,
    private readonly answersTtl = ANSWERS_TTL_SECONDS,
    private readonly takeoverCountTtl = TAKEOVER_COUNT_TTL_SECONDS,
  ) {}

  private lockKey(attemptId: string): string {
    return `exam_lock:{${attemptId}}`;
  }

  private heartbeatKey(attemptId: string): string {
    return `heartbeat:{${attemptId}}`;
  }

  private takeoverCountKey(attemptId: string): string {
    return `exam_takeover_count:{${attemptId}}`;
  }

  private answersKey(attemptId: string): string {
    return `exam_answers:{${attemptId}}`;
  }

  private answerMetaKey(attemptId: string): string {
    return `exam_answer_meta:{${attemptId}}`;
  }

  private expiresAt(): string {
    return new Date(Date.now() + this.lockTtl * 1000).toISOString();
  }

  private async coverage(attemptId: string): Promise<{
    takeoverCount: number;
    remainingTakeovers: number;
    canTakeover: boolean;
  }> {
    const raw = await this.redis.get(this.takeoverCountKey(attemptId));
    const takeoverCount = Number(raw ?? 0);
    const remainingTakeovers = Math.max(0, this.takeoverLimit - takeoverCount);
    return { takeoverCount, remainingTakeovers, canTakeover: remainingTakeovers > 0 };
  }

  async acquire(ctx: LockContext): Promise<AcquireResult> {
    const [code, version, lastHeartbeatAt] = await this.scripts.examAcquire(
      this.lockKey(ctx.attemptId),
      this.heartbeatKey(ctx.attemptId),
      this.takeoverCountKey(ctx.attemptId),
      ctx.deviceId,
      ctx.sessionId,
      ctx.userId,
      String(Date.now()),
      this.lockTtl,
      this.takeoverLimit,
    );

    if (code === -1) {
      return { status: 'limit_reached', takeoverCount: version };
    }
    if (code === 1) {
      return { status: 'acquired', version, expiresAt: this.expiresAt() };
    }
    if (code === 2) {
      return { status: 'already_locked', version, expiresAt: this.expiresAt() };
    }
    return {
      status: 'locked_by_other',
      version,
      lockedAt: lastHeartbeatAt || undefined,
      expiresAt: this.expiresAt(),
    };
  }

  async heartbeat(ctx: LockContext, input: HeartbeatInput = {}): Promise<HeartbeatResult> {
    const answers = input.answers ?? [];
    const clientSeq = input.clientSeq ?? 0;

    if (answers.length > MAX_ANSWERS_PER_SYNC) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'تعداد پاسخ‌های ارسالی بیش از حد مجاز است.');
    }
    if (answers.length > 0 && clientSeq <= 0) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'clientSeq برای ارسال پاسخ الزامی است.');
    }

    const pairs: string[] = [];
    let totalBytes = 0;
    for (const answer of answers) {
      let json: string | undefined;
      try {
        json = JSON.stringify(answer.value);
      } catch {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'مقدار پاسخ قابل تبدیل به JSON نیست.');
      }
      const bytes = json === undefined ? Number.POSITIVE_INFINITY : Buffer.byteLength(json, 'utf8');
      if (bytes > MAX_ANSWER_BYTES) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'مقدار پاسخ نامعتبر یا بیش از حد بزرگ است.');
      }
      totalBytes += bytes;
      pairs.push(answer.questionId, json as string);
    }
    if (totalBytes > MAX_SYNC_BYTES) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'حجم پاسخ‌های ارسالی بیش از حد مجاز است.');
    }

    const [code, version, ackedSeq] = await this.scripts.examHeartbeat(
      this.lockKey(ctx.attemptId),
      this.heartbeatKey(ctx.attemptId),
      this.answersKey(ctx.attemptId),
      this.answerMetaKey(ctx.attemptId),
      ctx.deviceId,
      ctx.sessionId,
      ctx.userId,
      String(Date.now()),
      this.lockTtl,
      clientSeq,
      this.answersTtl,
      ...pairs,
    );

    if (code === -1) {
      const coverage = await this.coverage(ctx.attemptId);
      return {
        status: 'lock_missing',
        remainingTakeovers: coverage.remainingTakeovers,
        canTakeover: coverage.canTakeover,
      };
    }
    if (code === 0) {
      const coverage = await this.coverage(ctx.attemptId);
      return {
        status: 'lock_lost',
        version,
        remainingTakeovers: coverage.remainingTakeovers,
        canTakeover: coverage.canTakeover,
      };
    }

    const coverage = await this.coverage(ctx.attemptId);
    return {
      status: 'ok',
      version,
      ackedSeq,
      ...coverage,
      expiresAt: this.expiresAt(),
    };
  }

  async takeover(ctx: LockContext): Promise<TakeoverResult> {
    const [code, version, count, previousDeviceId] = await this.scripts.examTakeover(
      this.lockKey(ctx.attemptId),
      this.heartbeatKey(ctx.attemptId),
      this.takeoverCountKey(ctx.attemptId),
      ctx.deviceId,
      ctx.sessionId,
      ctx.userId,
      String(Date.now()),
      this.lockTtl,
      this.takeoverLimit,
      this.takeoverCountTtl,
    );

    if (code === -2) return { status: 'wrong_user' };

    if (code === 0) {
      return {
        status: 'limit_reached',
        version,
        takeoverCount: count,
        remainingTakeovers: 0,
      };
    }

    const remainingTakeovers = Math.max(0, this.takeoverLimit - count);
    if (code === 2) {
      return {
        status: 'acquired',
        version,
        takeoverCount: count,
        remainingTakeovers,
        expiresAt: this.expiresAt(),
      };
    }
    if (code === 3) {
      return {
        status: 'already_owner',
        version,
        takeoverCount: count,
        remainingTakeovers,
        expiresAt: this.expiresAt(),
      };
    }

    return {
      status: 'taken_over',
      version,
      takeoverCount: count,
      remainingTakeovers,
      previousDeviceId: previousDeviceId || undefined,
      expiresAt: this.expiresAt(),
    };
  }

  /**
   * Used before any state-changing operation that is not a heartbeat
   * (e.g. final submit). Does not extend the TTL.
   */
  async assertOwner(ctx: LockContext): Promise<number> {
    const [code, version] = await this.scripts.examAssertOwner(
      this.lockKey(ctx.attemptId),
      ctx.deviceId,
      ctx.sessionId,
      ctx.userId,
    );
    if (code === -1) {
      throw new AppError(403, ErrorCodes.EXAM_LOCK_MISSING, 'قفل آزمون منقضی شده است.');
    }
    if (code === 0) {
      throw new AppError(403, ErrorCodes.EXAM_LOCK_LOST, 'آزمون در دستگاه دیگری ادامه یافته است.');
    }
    return version;
  }

  async getState(ctx: LockContext): Promise<LockState> {
    const [lock, ttl, coverage] = await Promise.all([
      this.redis.hgetall(this.lockKey(ctx.attemptId)),
      this.redis.ttl(this.lockKey(ctx.attemptId)),
      this.coverage(ctx.attemptId),
    ]);

    if (!lock.deviceId) {
      return {
        locked: false,
        isOwner: false,
        version: 0,
        takeoverCount: coverage.takeoverCount,
        remainingTakeovers: coverage.remainingTakeovers,
      };
    }

    return {
      locked: true,
      isOwner: lock.deviceId === ctx.deviceId && lock.sessionId === ctx.sessionId,
      version: Number(lock.version ?? 0),
      lockedAt: lock.lastHeartbeatAt || undefined,
      expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : undefined,
      takeoverCount: coverage.takeoverCount,
      remainingTakeovers: coverage.remainingTakeovers,
    };
  }

  async release(attemptId: string): Promise<void> {
    await this.redis.del(this.lockKey(attemptId), this.heartbeatKey(attemptId));
  }

  async remainingTakeovers(attemptId: string): Promise<number> {
    return (await this.coverage(attemptId)).remainingTakeovers;
  }
}
