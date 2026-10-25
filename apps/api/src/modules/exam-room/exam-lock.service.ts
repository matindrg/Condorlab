import { Injectable, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { registerExamLockCommands } from './scripts';

export interface LockContext {
  attemptId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
}

export interface StoredAnswer {
  questionNumber: number;
  selectedOption: number | null;
  isFlagged?: boolean;
  answeredAt?: number;
}

export const LOCK_TTL_SECONDS = 180; // ۳ دقیقه — پوشش‌دهنده ۲ دقیقه قطعی اینترنت
export const TAKEOVER_LIMIT = 2; // سقف ۲ بار جابه‌جایی دستگاه (Anti-Bounce)
export const ANSWERS_TTL_SECONDS = 86400; // ۲۴ ساعت
export const HEARTBEAT_INTERVAL_MS = 30000; // ۳۰ ثانیه

@Injectable()
export class ExamLockService {
  // فال‌بک حافظه‌ای برای زمان توسعه محلی یا آفلاین بودن موقت ردیس
  private static inMemoryLocks = new Map<string, {
    deviceId: string;
    sessionId: string;
    userId: string;
    version: number;
    lastHeartbeatAt: number;
    expiresAt: number;
  }>();

  private static inMemoryTakeovers = new Map<string, number>();
  private static inMemoryAnswers = new Map<string, Map<number, StoredAnswer>>();
  private static inMemoryLastSeq = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

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

  /**
   * دریافت یا تثبیت قفل اولیه ورود به آزمون
   */
  async acquire(ctx: LockContext): Promise<{
    status: 'acquired' | 'already_locked';
    version: number;
    expiresAt: string;
    serverTime: string;
    heartbeatIntervalMs: number;
  }> {
    const client = this.redis.getClient();
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_TTL_SECONDS * 1000).toISOString();

    if (client && client.status === 'ready') {
      registerExamLockCommands(client);
      try {
        const [code, version, lastHeartbeatAt] = (await (client as any).examAcquire(
          this.lockKey(ctx.attemptId),
          this.heartbeatKey(ctx.attemptId),
          this.takeoverCountKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
          String(now),
          LOCK_TTL_SECONDS,
          TAKEOVER_LIMIT,
        )) as [number, number, string?];

        if (code === 1 || code === 2) {
          return {
            status: code === 1 ? 'acquired' : 'already_locked',
            version: Number(version || 1),
            expiresAt,
            serverTime: new Date(now).toISOString(),
            heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
          };
        }

        if (code === 0) {
          const rawCount = await client.get(this.takeoverCountKey(ctx.attemptId));
          const count = Number(rawCount || 0);
          const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - count);

          throw new ConflictException({
            statusCode: 409,
            code: 'EXAM_LOCKED',
            message: 'آزمون هم‌اکنون روی دستگاه دیگری باز است.',
            details: {
              version: Number(version || 1),
              lockedAt: lastHeartbeatAt ? new Date(Number(lastHeartbeatAt)).toISOString() : undefined,
              expiresAt,
              canTakeover: remainingTakeovers > 0,
              remainingTakeovers,
            },
          });
        }

        if (code === -1) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'TAKEOVER_LIMIT_REACHED',
            message: 'سقف مجاز جابه‌جایی دستگاه (۲ بار) برای این آزمون مصرف شده است.',
            details: { remainingTakeovers: 0 },
          });
        }
      } catch (err) {
        if (err instanceof ConflictException || err instanceof ForbiddenException) throw err;
      }
    }

    // منطق فال‌بک در حافظه
    const existing = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    const takeovers = ExamLockService.inMemoryTakeovers.get(ctx.attemptId) || 0;

    if (existing && existing.expiresAt > now) {
      if (existing.deviceId === ctx.deviceId && existing.sessionId === ctx.sessionId) {
        existing.lastHeartbeatAt = now;
        existing.expiresAt = now + LOCK_TTL_SECONDS * 1000;
        return {
          status: 'already_locked',
          version: existing.version,
          expiresAt: new Date(existing.expiresAt).toISOString(),
          serverTime: new Date(now).toISOString(),
          heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
        };
      }

      const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - takeovers);
      throw new ConflictException({
        statusCode: 409,
        code: 'EXAM_LOCKED',
        message: 'آزمون هم‌اکنون روی دستگاه دیگری باز است.',
        details: {
          version: existing.version,
          lockedAt: new Date(existing.lastHeartbeatAt).toISOString(),
          expiresAt: new Date(existing.expiresAt).toISOString(),
          canTakeover: remainingTakeovers > 0,
          remainingTakeovers,
        },
      });
    }

    if (takeovers >= TAKEOVER_LIMIT) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'TAKEOVER_LIMIT_REACHED',
        message: 'سقف مجاز جابه‌جایی دستگاه (۲ بار) برای این آزمون مصرف شده است.',
        details: { remainingTakeovers: 0 },
      });
    }

    ExamLockService.inMemoryLocks.set(ctx.attemptId, {
      deviceId: ctx.deviceId,
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      version: 1,
      lastHeartbeatAt: now,
      expiresAt: now + LOCK_TTL_SECONDS * 1000,
    });

    return {
      status: 'acquired',
      version: 1,
      expiresAt,
      serverTime: new Date(now).toISOString(),
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    };
  }

  /**
   * هارت‌بیت دوره‌ای (۳۰ ثانیه‌ای) و ثبت دسته‌ای پاسخ‌های ارسال‌شده
   */
  async heartbeat(
    ctx: LockContext,
    clientSeq = 0,
    answers: StoredAnswer[] = [],
  ): Promise<{
    status: 'ok';
    version: number;
    ackedSeq: number;
    remainingTakeovers: number;
    expiresAt: string;
    serverTime: string;
    heartbeatIntervalMs: number;
  }> {
    const client = this.redis.getClient();
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_TTL_SECONDS * 1000).toISOString();

    // تبدیل پاسخ‌ها به آرایه جفت‌های کلید/مقدار برای اسکریپت ردیس
    const pairs: string[] = [];
    answers.forEach((ans) => {
      pairs.push(String(ans.questionNumber), JSON.stringify(ans));
    });

    if (client && client.status === 'ready') {
      registerExamLockCommands(client);
      try {
        const [code, version, lastSeq] = (await (client as any).examHeartbeat(
          this.lockKey(ctx.attemptId),
          this.heartbeatKey(ctx.attemptId),
          this.answersKey(ctx.attemptId),
          this.answerMetaKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
          String(now),
          LOCK_TTL_SECONDS,
          clientSeq,
          ANSWERS_TTL_SECONDS,
          ...pairs,
        )) as [number, number, number];

        const rawCount = await client.get(this.takeoverCountKey(ctx.attemptId));
        const count = Number(rawCount || 0);
        const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - count);

        if (code === 1) {
          return {
            status: 'ok',
            version: Number(version || 1),
            ackedSeq: Number(lastSeq || clientSeq),
            remainingTakeovers,
            expiresAt,
            serverTime: new Date(now).toISOString(),
            heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
          };
        }

        if (code === 0) {
          // قفل به دستگاه دیگری واگذار شده است
          throw new ForbiddenException({
            statusCode: 403,
            code: 'EXAM_LOCK_LOST',
            message: 'آزمون در دستگاه دیگری فعال شده است و دسترسی این دستگاه معلق شد.',
            details: {
              canTakeover: remainingTakeovers > 0,
              remainingTakeovers,
            },
          });
        }

        if (code === -1) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'EXAM_LOCK_MISSING',
            message: 'قفل آزمون به دلیل عدم ارسال ضربان منقضی شده است.',
            details: {
              canTakeover: remainingTakeovers > 0,
              remainingTakeovers,
            },
          });
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
      }
    }

    // منطق فال‌بک در حافظه
    const lock = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    const takeovers = ExamLockService.inMemoryTakeovers.get(ctx.attemptId) || 0;
    const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - takeovers);

    if (!lock || lock.expiresAt <= now) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EXAM_LOCK_MISSING',
        message: 'قفل آزمون به دلیل عدم ارسال ضربان منقضی شده است.',
        details: { canTakeover: remainingTakeovers > 0, remainingTakeovers },
      });
    }

    if (lock.deviceId !== ctx.deviceId || lock.sessionId !== ctx.sessionId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EXAM_LOCK_LOST',
        message: 'آزمون در دستگاه دیگری فعال شده است و دسترسی این دستگاه معلق شد.',
        details: { canTakeover: remainingTakeovers > 0, remainingTakeovers },
      });
    }

    lock.lastHeartbeatAt = now;
    lock.expiresAt = now + LOCK_TTL_SECONDS * 1000;

    // ذخیره پاسخ‌ها در حافظه موقت
    let ansMap = ExamLockService.inMemoryAnswers.get(ctx.attemptId);
    if (!ansMap) {
      ansMap = new Map();
      ExamLockService.inMemoryAnswers.set(ctx.attemptId, ansMap);
    }
    answers.forEach((ans) => {
      ansMap!.set(ans.questionNumber, ans);
    });
    ExamLockService.inMemoryLastSeq.set(ctx.attemptId, clientSeq);

    return {
      status: 'ok',
      version: lock.version,
      ackedSeq: clientSeq,
      remainingTakeovers,
      expiresAt: new Date(lock.expiresAt).toISOString(),
      serverTime: new Date(now).toISOString(),
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    };
  }

  /**
   * تصاحب قفل توسط دستگاه جدید (Takeover) با کسر سهمیه
   */
  async takeover(ctx: LockContext): Promise<{
    status: 'taken_over' | 'acquired' | 'already_owner';
    version: number;
    takeoverCount: number;
    remainingTakeovers: number;
    previousDeviceId?: string;
    expiresAt: string;
  }> {
    const client = this.redis.getClient();
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_TTL_SECONDS * 1000).toISOString();

    if (client && client.status === 'ready') {
      registerExamLockCommands(client);
      try {
        const [code, version, count, previousDeviceId] = (await (client as any).examTakeover(
          this.lockKey(ctx.attemptId),
          this.heartbeatKey(ctx.attemptId),
          this.takeoverCountKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
          String(now),
          LOCK_TTL_SECONDS,
          TAKEOVER_LIMIT,
          ANSWERS_TTL_SECONDS,
        )) as [number, number, number, string?, number?];

        if (code === 1 || code === 2 || code === 3) {
          const tCount = Number(count || 0);
          return {
            status: code === 1 ? 'taken_over' : code === 2 ? 'acquired' : 'already_owner',
            version: Number(version || 1),
            takeoverCount: tCount,
            remainingTakeovers: Math.max(0, TAKEOVER_LIMIT - tCount),
            previousDeviceId: previousDeviceId || undefined,
            expiresAt,
          };
        }

        if (code === 0) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'TAKEOVER_LIMIT_REACHED',
            message: 'سقف مجاز ۲ بار جابه‌جایی دستگاه تکمیل شده است.',
            details: { remainingTakeovers: 0 },
          });
        }

        if (code === -2) {
          throw new UnauthorizedException('شما مجاز به تصاحب آزمون کاربر دیگری نیستید.');
        }
      } catch (err) {
        if (err instanceof ForbiddenException || err instanceof UnauthorizedException) throw err;
      }
    }

    // فال‌بک در حافظه
    let count = ExamLockService.inMemoryTakeovers.get(ctx.attemptId) || 0;
    const lock = ExamLockService.inMemoryLocks.get(ctx.attemptId);

    if (lock && lock.userId !== ctx.userId) {
      throw new UnauthorizedException('شما مجاز به تصاحب آزمون کاربر دیگری نیستید.');
    }

    if (count >= TAKEOVER_LIMIT) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'TAKEOVER_LIMIT_REACHED',
        message: 'سقف مجاز ۲ بار جابه‌جایی دستگاه تکمیل شده است.',
        details: { remainingTakeovers: 0 },
      });
    }

    count += 1;
    ExamLockService.inMemoryTakeovers.set(ctx.attemptId, count);

    const newVersion = (lock?.version || 0) + 1;
    ExamLockService.inMemoryLocks.set(ctx.attemptId, {
      deviceId: ctx.deviceId,
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      version: newVersion,
      lastHeartbeatAt: now,
      expiresAt: now + LOCK_TTL_SECONDS * 1000,
    });

    return {
      status: 'taken_over',
      version: newVersion,
      takeoverCount: count,
      remainingTakeovers: Math.max(0, TAKEOVER_LIMIT - count),
      previousDeviceId: lock?.deviceId,
      expiresAt,
    };
  }

  /**
   * بررسی مالکیت فعال قبل از اقدامات حساس مانند ثبت نهایی
   */
  async assertOwner(ctx: LockContext): Promise<void> {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      registerExamLockCommands(client);
      try {
        const [code] = (await (client as any).examAssertOwner(
          this.lockKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
        )) as [number, number];

        if (code === 1) return;
        if (code === 0) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'EXAM_LOCK_LOST',
            message: 'شما مالک فعال این نشست نیستید.',
          });
        }
        if (code === -1) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'EXAM_LOCK_MISSING',
            message: 'قفل نشست منقضی شده است.',
          });
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
      }
    }

    const lock = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    if (!lock || lock.deviceId !== ctx.deviceId || lock.sessionId !== ctx.sessionId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EXAM_LOCK_LOST',
        message: 'شما مالک فعال این نشست نیستید.',
      });
    }
  }

  /**
   * آزادسازی قفل پس از ارسال قطعی آزمون
   */
  async release(ctx: LockContext): Promise<void> {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      try {
        await client.del(this.lockKey(ctx.attemptId));
        await client.del(this.heartbeatKey(ctx.attemptId));
      } catch {
        // ignore
      }
    }
    ExamLockService.inMemoryLocks.delete(ctx.attemptId);
  }

  /**
   * دریافت پاسخ‌های موقت ذخیره‌شده در ردیس برای لود مجدد
   */
  async getStoredAnswers(attemptId: string): Promise<Record<number, StoredAnswer>> {
    const client = this.redis.getClient();
    const result: Record<number, StoredAnswer> = {};

    if (client && client.status === 'ready') {
      try {
        const rawHash = await client.hgetall(this.answersKey(attemptId));
        if (rawHash) {
          Object.entries(rawHash).forEach(([qNum, rawVal]) => {
            try {
              result[Number(qNum)] = JSON.parse(rawVal);
            } catch {
              // ignore
            }
          });
          return result;
        }
      } catch {
        // ignore
      }
    }

    const memoryMap = ExamLockService.inMemoryAnswers.get(attemptId);
    if (memoryMap) {
      memoryMap.forEach((val, key) => {
        result[key] = val;
      });
    }

    return result;
  }
}
