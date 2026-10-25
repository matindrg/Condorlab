import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { AppError, ErrorCodes } from '../errors';
import { SESSION_TTL_SECONDS, MAX_SESSIONS } from '../constants';

const REGISTER_SESSION_LUA = `
-- KEYS[1] user_sessions:{userId} (sorted set, score = expiry ms)
-- KEYS[2] session:{userId}:{sessionId}
-- ARGV[1] nowMs, [2] expiryMs, [3] sessionId, [4] ttlSeconds,
-- ARGV[5] userId, [6] maxSessions, [7] deviceId
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[6]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('HSET', KEYS[2],
  'userId', ARGV[5],
  'deviceId', ARGV[7],
  'createdAt', ARGV[1],
  'lastSeen', ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 1
`;

export interface SessionRecord {
  sessionId: string;
  userId: string;
  deviceId: string;
}

/**
 * Login-session cap (max 2 devices) and session validation.
 *
 * The exam lock references sessionId; if a session is revoked, auth middleware
 * rejects the request before the lock service is reached.
 */
export class SessionService {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = SESSION_TTL_SECONDS,
    private readonly maxSessions = MAX_SESSIONS,
  ) {}

  async registerLogin(userId: string, deviceId: string): Promise<SessionRecord> {
    const sessionId = `sess_${randomUUID()}`;
    const now = Date.now();
    const expiry = now + this.ttlSeconds * 1000;

    const result = await this.redis.eval(
      REGISTER_SESSION_LUA,
      2,
      `user_sessions:{${userId}}`,
      `session:{${userId}}:${sessionId}`,
      String(now),
      String(expiry),
      sessionId,
      String(this.ttlSeconds),
      userId,
      String(this.maxSessions),
      deviceId,
    );

    if (Number(result) !== 1) {
      throw new AppError(
        409,
        ErrorCodes.SESSION_LIMIT_REACHED,
        'حداکثر تعداد نشست‌های فعال پر شده است. یکی از دستگاه‌ها را خارج کنید.',
        { maxSessions: this.maxSessions },
      );
    }

    return { sessionId, userId, deviceId };
  }

  async assertSession(sessionId: string, userId: string, deviceId: string): Promise<void> {
    const session = await this.redis.hgetall(`session:{${userId}}:${sessionId}`);
    if (!session.userId || !session.deviceId) {
      throw new AppError(401, ErrorCodes.SESSION_INVALID, 'نشست منقضی یا نامعتبر است.');
    }
    if (session.userId !== userId || session.deviceId !== deviceId) {
      throw new AppError(401, ErrorCodes.SESSION_INVALID, 'نشست با دستگاه یا کاربر مطابقت ندارد.');
    }

    const now = Date.now();
    await this.redis
      .multi()
      .expire(`session:{${userId}}:${sessionId}`, this.ttlSeconds)
      .zadd(`user_sessions:{${userId}}`, now + this.ttlSeconds * 1000, sessionId)
      .expire(`user_sessions:{${userId}}`, this.ttlSeconds)
      .hset(`session:{${userId}}:${sessionId}`, 'lastSeen', String(now))
      .exec();
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.redis
      .multi()
      .del(`session:{${userId}}:${sessionId}`)
      .zrem(`user_sessions:{${userId}}`, sessionId)
      .exec();
  }

  async revokeAll(userId: string): Promise<void> {
    const sessionIds = await this.redis.zrange(`user_sessions:{${userId}}`, 0, -1);
    const pipeline = this.redis.multi();
    for (const sessionId of sessionIds) {
      pipeline.del(`session:{${userId}}:${sessionId}`);
    }
    pipeline.del(`user_sessions:{${userId}}`);
    await pipeline.exec();
  }
}
