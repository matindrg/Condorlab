import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
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
  selectedStatements?: Record<number, boolean | null> | null;
  numericValue?: number | null;
  isFlagged?: boolean;
  answeredAt?: number;
}

export interface LockState {
  locked: boolean;
  isOwner: boolean;
  version: number;
  lockedAt?: string;
  expiresAt?: string;
  takeoverCount: number;
  remainingTakeovers: number;
  canTakeover: boolean;
  serverTime: string;
}

export interface TelemetryEvent {
  eventType: 'TAB_BLUR' | 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'CONTEXT_MENU' | 'COPY_ATTEMPT';
  startedAt: number;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export const LOCK_TTL_SECONDS = 180; // ۳ دقیقه — پوشش‌دهنده ۲ دقیقه قطعی اینترنت طبق PRD
export const TAKEOVER_LIMIT = 2; // سقف ۲ بار جابه‌جایی دستگاه (Anti-Bounce)
export const ANSWERS_TTL_SECONDS = 86400; // ۲۴ ساعت
export const TAKEOVER_COUNT_TTL_SECONDS = 86400; // ۲۴ ساعت
export const HEARTBEAT_INTERVAL_MS = 30000; // ۳۰ ثانیه

export const MAX_ANSWERS_PER_SYNC = 200;
export const MAX_ANSWER_BYTES = 16 * 1024; // 16 KB
export const MAX_SYNC_BYTES = 256 * 1024; // 256 KB

@Injectable()
export class ExamLockService {
  // فال‌بک حافظه‌ای برای زمان توسعه محلی یا آفلاین بودن موقت ردیس
  private static inMemoryLocks = new Map<
    string,
    {
      deviceId: string;
      sessionId: string;
      userId: string;
      version: number;
      lastHeartbeatAt: number;
      expiresAt: number;
    }
  >();

  private static inMemoryTakeovers = new Map<string, number>();
  private static inMemoryAnswers = new Map<string, Map<number, StoredAnswer>>();
  private static inMemoryLastSeq = new Map<string, number>();
  private static inMemoryTelemetry = new Map<string, TelemetryEvent[]>();

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

  private telemetryKey(attemptId: string): string {
    return `exam_telemetry:{${attemptId}}`;
  }

  /**
   * همگام‌سازی تعداد سوییچ از دیتابیس پایدار
   */
  syncTakeoverCount(attemptId: string, count: number) {
    if (count > 0) {
      const current = ExamLockService.inMemoryTakeovers.get(attemptId) || 0;
      if (count > current) {
        ExamLockService.inMemoryTakeovers.set(attemptId, count);
      }
    }
  }

  /**
   * دریافت یا تثبیت قفل اولیه ورود به آزمون
   */
  async acquire(ctx: LockContext): Promise<{
    status: 'acquired' | 'already_locked';
    version: number;
    takeoverCount: number;
    remainingTakeovers: number;
    expiresAt: string;
    serverTime: string;
    heartbeatIntervalMs: number;
  }> {
    const client = this.redis.getClient();
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_TTL_SECONDS * 1000).toISOString();

    if (client && client.status === 'ready') {
      const scripts = registerExamLockCommands(client);
      try {
        const [code, version, lastHeartbeatAt] = await scripts.examAcquire(
          this.lockKey(ctx.attemptId),
          this.heartbeatKey(ctx.attemptId),
          this.takeoverCountKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
          String(now),
          LOCK_TTL_SECONDS,
          TAKEOVER_LIMIT,
        );

        if (code === 1 || code === 2) {
          const rawCount = await client.get(this.takeoverCountKey(ctx.attemptId));
          const count = Number(rawCount || 0);
          const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - count);
          return {
            status: code === 1 ? 'acquired' : 'already_locked',
            version: Number(version || 1),
            takeoverCount: count,
            remainingTakeovers,
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
    const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - takeovers);

    if (existing && existing.expiresAt > now) {
      const isSameClient =
        existing.deviceId === ctx.deviceId ||
        (existing.userId === ctx.userId && existing.sessionId === ctx.sessionId);

      if (isSameClient) {
        existing.deviceId = ctx.deviceId;
        existing.sessionId = ctx.sessionId;
        existing.lastHeartbeatAt = now;
        existing.expiresAt = now + LOCK_TTL_SECONDS * 1000;
        return {
          status: 'already_locked',
          version: existing.version,
          takeoverCount: takeovers,
          remainingTakeovers,
          expiresAt: new Date(existing.expiresAt).toISOString(),
          serverTime: new Date(now).toISOString(),
          heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
        };
      }

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
      takeoverCount: takeovers,
      remainingTakeovers,
      expiresAt,
      serverTime: new Date(now).toISOString(),
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    };
  }

  /**
   * هارت‌بیت دوره‌ای (۳۰ ثانیه‌ای) و همگام‌سازی دسته‌ای پاسخ‌ها
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
    // اعتبارسنجی حجم و اندازه پاسخ‌ها
    if (answers && answers.length > MAX_ANSWERS_PER_SYNC) {
      throw new BadRequestException('تعداد پاسخ‌های ارسالی در یک بسته بیش از حد مجاز است.');
    }
    if (answers && answers.length > 0 && clientSeq <= 0) {
      throw new BadRequestException('ارسال clientSeq برای همگام‌سازی پاسخ‌ها الزامی است.');
    }

    const client = this.redis.getClient();
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_TTL_SECONDS * 1000).toISOString();

    const pairs: string[] = [];
    let totalPayloadBytes = 0;
    if (answers) {
      for (const ans of answers) {
        let serialized: string;
        try {
          serialized = JSON.stringify(ans);
        } catch {
          throw new BadRequestException('پاسخ ارسالی قالب معتبری ندارد.');
        }
        const bytes = Buffer.byteLength(serialized, 'utf8');
        if (bytes > MAX_ANSWER_BYTES) {
          throw new BadRequestException('اندازه یک پاسخ بیش از حد مجاز است.');
        }
        totalPayloadBytes += bytes;
        pairs.push(String(ans.questionNumber), serialized);
      }
    }

    if (totalPayloadBytes > MAX_SYNC_BYTES) {
      throw new BadRequestException('حجم کل پاسخ‌های ارسالی در این بسته بیش از حد مجاز است.');
    }

    if (client && client.status === 'ready') {
      const scripts = registerExamLockCommands(client);
      try {
        const [code, version, lastSeq] = await scripts.examHeartbeat(
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
        );

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
        if (err instanceof ForbiddenException || err instanceof BadRequestException) throw err;
      }
    }

    // منطق فال‌بک در حافظه
    let lock = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    const takeovers = ExamLockService.inMemoryTakeovers.get(ctx.attemptId) || 0;
    const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - takeovers);

    if (!lock || lock.expiresAt <= now) {
      const isSameOwner =
        !lock ||
        lock.deviceId === ctx.deviceId ||
        (lock.userId === ctx.userId && lock.sessionId === ctx.sessionId);

      if (isSameOwner) {
        // تمدید و همگام‌سازی خودکار قفل برای همان کاربر پس از قطعی موقت شبکه یا انقضای موقت
        const currentVersion = lock?.version || 1;
        lock = {
          deviceId: ctx.deviceId,
          sessionId: ctx.sessionId,
          userId: ctx.userId,
          version: currentVersion,
          lastHeartbeatAt: now,
          expiresAt: now + LOCK_TTL_SECONDS * 1000,
        };
        ExamLockService.inMemoryLocks.set(ctx.attemptId, lock);
      } else {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'EXAM_LOCK_MISSING',
          message: 'قفل آزمون به دلیل عدم ارسال ضربان منقضی شده است.',
          details: { canTakeover: remainingTakeovers > 0, remainingTakeovers },
        });
      }
    }

    if (lock.deviceId !== ctx.deviceId) {
      if (lock.userId === ctx.userId && lock.sessionId === ctx.sessionId) {
        // همان سشن در حال ارسال با شناسه است
        lock.deviceId = ctx.deviceId;
      } else {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'EXAM_LOCK_LOST',
          message: 'آزمون در دستگاه دیگری فعال شده است و دسترسی این دستگاه معلق شد.',
          details: { canTakeover: remainingTakeovers > 0, remainingTakeovers },
        });
      }
    }

    lock.lastHeartbeatAt = now;
    lock.expiresAt = now + LOCK_TTL_SECONDS * 1000;

    // ثبت پاسخ‌ها در حافظه موقت با رعایت Idempotency توالی
    const prevSeq = ExamLockService.inMemoryLastSeq.get(ctx.attemptId) || 0;
    let ackedSeq = prevSeq;

    if (clientSeq > prevSeq && answers && answers.length > 0) {
      let ansMap = ExamLockService.inMemoryAnswers.get(ctx.attemptId);
      if (!ansMap) {
        ansMap = new Map();
        ExamLockService.inMemoryAnswers.set(ctx.attemptId, ansMap);
      }
      answers.forEach((ans) => {
        ansMap!.set(ans.questionNumber, ans);
      });
      ExamLockService.inMemoryLastSeq.set(ctx.attemptId, clientSeq);
      ackedSeq = clientSeq;
    }

    return {
      status: 'ok',
      version: lock.version,
      ackedSeq,
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
      const scripts = registerExamLockCommands(client);
      try {
        const [code, version, count, previousDeviceId] = await scripts.examTakeover(
          this.lockKey(ctx.attemptId),
          this.heartbeatKey(ctx.attemptId),
          this.takeoverCountKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
          String(now),
          LOCK_TTL_SECONDS,
          TAKEOVER_LIMIT,
          TAKEOVER_COUNT_TTL_SECONDS,
        );

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
    const existing = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    const currentTakeovers = ExamLockService.inMemoryTakeovers.get(ctx.attemptId) || 0;

    if (existing && existing.userId !== ctx.userId) {
      throw new UnauthorizedException('شما مجاز به تصاحب آزمون کاربر دیگری نیستید.');
    }

    // ۱. اگر قفل منقضی شده یا وجود ندارد: دریافت اولیه است و سهمیه مصرف نمی‌شود
    if (!existing || existing.expiresAt <= now) {
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
        takeoverCount: currentTakeovers,
        remainingTakeovers: Math.max(0, TAKEOVER_LIMIT - currentTakeovers),
        expiresAt,
      };
    }

    // ۲. اگر همان دستگاه است: بدون تغییر و بدون کسر سهمیه
    if (existing.deviceId === ctx.deviceId) {
      existing.lastHeartbeatAt = now;
      existing.expiresAt = now + LOCK_TTL_SECONDS * 1000;
      existing.sessionId = ctx.sessionId;
      return {
        status: 'already_owner',
        version: existing.version,
        takeoverCount: currentTakeovers,
        remainingTakeovers: Math.max(0, TAKEOVER_LIMIT - currentTakeovers),
        previousDeviceId: existing.deviceId,
        expiresAt,
      };
    }

    // ۳. جابه‌جایی دستگاه واقعی: بررسی سقف
    if (currentTakeovers >= TAKEOVER_LIMIT) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'TAKEOVER_LIMIT_REACHED',
        message: 'سقف مجاز ۲ بار جابه‌جایی دستگاه تکمیل شده است.',
        details: { remainingTakeovers: 0, takeoverCount: currentTakeovers },
      });
    }

    const newCount = currentTakeovers + 1;
    ExamLockService.inMemoryTakeovers.set(ctx.attemptId, newCount);
    const newVersion = existing.version + 1;
    const prevDevice = existing.deviceId;

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
      takeoverCount: newCount,
      remainingTakeovers: Math.max(0, TAKEOVER_LIMIT - newCount),
      previousDeviceId: prevDevice,
      expiresAt,
    };
  }

  /**
   * دریافت وضعیت زنده قفل بدون تغییر (Read-Only State)
   */
  async getState(ctx: LockContext): Promise<LockState> {
    const client = this.redis.getClient();
    const now = Date.now();

    if (client && client.status === 'ready') {
      try {
        const [lockData, ttl, countRaw] = await Promise.all([
          client.hgetall(this.lockKey(ctx.attemptId)),
          client.ttl(this.lockKey(ctx.attemptId)),
          client.get(this.takeoverCountKey(ctx.attemptId)),
        ]);

        const count = Number(countRaw || 0);
        const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - count);

        if (!lockData || !lockData.deviceId) {
          return {
            locked: false,
            isOwner: false,
            version: 0,
            takeoverCount: count,
            remainingTakeovers,
            canTakeover: remainingTakeovers > 0,
            serverTime: new Date(now).toISOString(),
          };
        }

        const isOwner =
          lockData.deviceId === ctx.deviceId ||
          (lockData.userId === ctx.userId && lockData.sessionId === ctx.sessionId);
        return {
          locked: true,
          isOwner,
          version: Number(lockData.version || 1),
          lockedAt: lockData.lastHeartbeatAt ? new Date(Number(lockData.lastHeartbeatAt)).toISOString() : undefined,
          expiresAt: ttl > 0 ? new Date(now + ttl * 1000).toISOString() : undefined,
          takeoverCount: count,
          remainingTakeovers,
          canTakeover: remainingTakeovers > 0,
          serverTime: new Date(now).toISOString(),
        };
      } catch {
        // فال‌بک به حافظه
      }
    }

    const lock = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    const count = ExamLockService.inMemoryTakeovers.get(ctx.attemptId) || 0;
    const remainingTakeovers = Math.max(0, TAKEOVER_LIMIT - count);

    if (!lock || lock.expiresAt <= now) {
      return {
        locked: false,
        isOwner: false,
        version: 0,
        takeoverCount: count,
        remainingTakeovers,
        canTakeover: remainingTakeovers > 0,
        serverTime: new Date(now).toISOString(),
      };
    }

    const isOwner =
      lock.deviceId === ctx.deviceId ||
      (lock.userId === ctx.userId && lock.sessionId === ctx.sessionId);
    return {
      locked: true,
      isOwner,
      version: lock.version,
      lockedAt: new Date(lock.lastHeartbeatAt).toISOString(),
      expiresAt: new Date(lock.expiresAt).toISOString(),
      takeoverCount: count,
      remainingTakeovers,
      canTakeover: remainingTakeovers > 0,
      serverTime: new Date(now).toISOString(),
    };
  }

  /**
   * بررسی مالکیت فعال قبل از اقدامات حساس مانند ثبت نهایی
   */
  async assertOwner(ctx: LockContext): Promise<number> {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      const scripts = registerExamLockCommands(client);
      try {
        const [code, version] = await scripts.examAssertOwner(
          this.lockKey(ctx.attemptId),
          ctx.deviceId,
          ctx.sessionId,
          ctx.userId,
        );

        if (code === 1) return Number(version || 1);
        if (code === 0) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'EXAM_LOCK_LOST',
            message: 'شما مالک فعال این نشست نیستید و آزمون روی دستگاه دیگری قفل شده است.',
          });
        }
        if (code === -1) {
          // قفل نشست منقضی شده اما دستگاه دیگری مالکیت را نگرفته است؛ ارسال پاسخ‌برگ برای صاحب آزمون بلامانع است
          return 1;
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
      }
    }

    const lock = ExamLockService.inMemoryLocks.get(ctx.attemptId);
    if (lock && lock.expiresAt > Date.now()) {
      const isOwner =
        lock.deviceId === ctx.deviceId ||
        (lock.userId === ctx.userId && (lock.sessionId === ctx.sessionId || lock.deviceId === ctx.deviceId));

      if (!isOwner) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'EXAM_LOCK_LOST',
          message: 'شما مالک فعال این نشست نیستید و آزمون روی دستگاه دیگری قفل شده است.',
        });
      }

      return lock.version;
    }

    // اگر قفل منقضی شده یا حذف شده باشد، ولی دستگاه متخاصم دیگری وجود نداشته باشد، به صاحب آزمون اجازه اتمام داده می‌شود
    return 1;
  }

  // ثبت سابقه آخرین دستگاه متصل برای نمایش در داشبورد حتی پس از انقضا یا اتمام آزمون
  private static lastKnownLockOwners = new Map<
    string,
    { lockedDeviceId: string; lockedAt?: string; lastHeartbeatAt?: string }
  >();

  /**
   * دریافت مشخصات دستگاه فعال دارای قفل برای نمایش در داشبورد
   */
  async getLockOwnerInfo(attemptId: string): Promise<{
    isLocked: boolean;
    lockedDeviceId?: string;
    lockedAt?: string;
    lastHeartbeatAt?: string;
  }> {
    const now = Date.now();
    const client = this.redis.getClient();

    if (client && client.status === 'ready') {
      try {
        const lockData = await client.hgetall(this.lockKey(attemptId));
        if (lockData && lockData.deviceId) {
          ExamLockService.lastKnownLockOwners.set(attemptId, {
            lockedDeviceId: lockData.deviceId,
            lockedAt: lockData.acquiredAt ? new Date(Number(lockData.acquiredAt)).toISOString() : undefined,
            lastHeartbeatAt: lockData.lastHeartbeatAt ? new Date(Number(lockData.lastHeartbeatAt)).toISOString() : undefined,
          });
          return {
            isLocked: true,
            lockedDeviceId: lockData.deviceId,
            lockedAt: lockData.acquiredAt ? new Date(Number(lockData.acquiredAt)).toISOString() : undefined,
            lastHeartbeatAt: lockData.lastHeartbeatAt ? new Date(Number(lockData.lastHeartbeatAt)).toISOString() : undefined,
          };
        }
      } catch {
        // fallback
      }
    }

    const lock = ExamLockService.inMemoryLocks.get(attemptId);
    if (lock && lock.expiresAt > now) {
      ExamLockService.lastKnownLockOwners.set(attemptId, {
        lockedDeviceId: lock.deviceId,
        lockedAt: new Date(lock.lastHeartbeatAt).toISOString(),
        lastHeartbeatAt: new Date(lock.lastHeartbeatAt).toISOString(),
      });
      return {
        isLocked: true,
        lockedDeviceId: lock.deviceId,
        lockedAt: new Date(lock.lastHeartbeatAt).toISOString(),
        lastHeartbeatAt: new Date(lock.lastHeartbeatAt).toISOString(),
      };
    }

    // نمایش آخرین دستگاه متصل شناخته‌شده برای پایش بهتر کاربر
    const lastKnown = ExamLockService.lastKnownLockOwners.get(attemptId);
    if (lastKnown) {
      return {
        isLocked: false,
        lockedDeviceId: lastKnown.lockedDeviceId,
        lockedAt: lastKnown.lockedAt,
        lastHeartbeatAt: lastKnown.lastHeartbeatAt,
      };
    }

    return { isLocked: false };
  }

  /**
   * آزادسازی قفل پس از ارسال قطعی آزمون یا توسط پشتیبان
   */
  async release(ctxOrAttemptId: LockContext | string): Promise<void> {
    const attemptId = typeof ctxOrAttemptId === 'string' ? ctxOrAttemptId : ctxOrAttemptId.attemptId;
    const client = this.redis.getClient();

    if (client && client.status === 'ready') {
      try {
        const lockData = await client.hgetall(this.lockKey(attemptId));
        if (lockData?.deviceId) {
          ExamLockService.lastKnownLockOwners.set(attemptId, {
            lockedDeviceId: lockData.deviceId,
            lockedAt: lockData.acquiredAt ? new Date(Number(lockData.acquiredAt)).toISOString() : undefined,
            lastHeartbeatAt: lockData.lastHeartbeatAt ? new Date(Number(lockData.lastHeartbeatAt)).toISOString() : undefined,
          });
        }
        await client.del(this.lockKey(attemptId));
        await client.del(this.heartbeatKey(attemptId));
      } catch {
        // ignore
      }
    }
    const memLock = ExamLockService.inMemoryLocks.get(attemptId);
    if (memLock) {
      ExamLockService.lastKnownLockOwners.set(attemptId, {
        lockedDeviceId: memLock.deviceId,
        lockedAt: new Date(memLock.lastHeartbeatAt).toISOString(),
        lastHeartbeatAt: new Date(memLock.lastHeartbeatAt).toISOString(),
      });
    }
    ExamLockService.inMemoryLocks.delete(attemptId);
  }

  /**
   * دریافت پاسخ‌های موقت ذخیره‌شده در ردیس برای بازیابی سریع
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

  /**
   * محاسبه سهمیه باقیمانده جابه‌جایی
   */
  async remainingTakeovers(attemptId: string): Promise<number> {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      try {
        const rawCount = await client.get(this.takeoverCountKey(attemptId));
        return Math.max(0, TAKEOVER_LIMIT - Number(rawCount || 0));
      } catch {
        // ignore
      }
    }

    const count = ExamLockService.inMemoryTakeovers.get(attemptId) || 0;
    return Math.max(0, TAKEOVER_LIMIT - count);
  }

  /**
   * ثبت نامحسوس رخداد تله‌متری فرانت‌اند (ضد تقلب)
   */
  async recordTelemetry(attemptId: string, event: TelemetryEvent): Promise<void> {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      try {
        await client.rpush(this.telemetryKey(attemptId), JSON.stringify(event));
        await client.expire(this.telemetryKey(attemptId), ANSWERS_TTL_SECONDS);
        return;
      } catch {
        // ignore
      }
    }

    let list = ExamLockService.inMemoryTelemetry.get(attemptId);
    if (!list) {
      list = [];
      ExamLockService.inMemoryTelemetry.set(attemptId, list);
    }
    list.push(event);
  }

  /**
   * دریافت لاگ‌های تله‌متری برای مانیتورینگ داوری
   */
  async getTelemetryEvents(attemptId: string): Promise<TelemetryEvent[]> {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      try {
        const rawList = await client.lrange(this.telemetryKey(attemptId), 0, -1);
        return rawList.map((str) => {
          try {
            return JSON.parse(str);
          } catch {
            return null;
          }
        }).filter(Boolean);
      } catch {
        // ignore
      }
    }

    return ExamLockService.inMemoryTelemetry.get(attemptId) || [];
  }
}
