import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private static inMemorySessions = new Map<string, string[]>();
  private static inMemoryRevokedSessions = new Set<string>();

  onModuleInit() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryStrategy: () => null, // در محیط بدون ردیس کرش نکند
      });

      this.client.connect().catch((err) => {
        console.warn('⚠️ Redis not yet available (running in memory fallback mode):', err.message);
      });
    } catch (e) {
      console.warn('⚠️ Redis initialization bypassed:', (e as Error).message);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  /**
   * افزودن سشن جدید به کاربر و اخراج سشن‌های قدیمی در صورت عبور از سقف ۲ دستگاه (FIFO)
   * بر اساس سند CONDORLAB_AUTH_SPEC_FA.md
   */
  async registerSession(userId: string, sessionId: string, maxSessions = 2): Promise<void> {
    RedisService.inMemoryRevokedSessions.delete(sessionId);
    const existing = RedisService.inMemorySessions.get(userId) || [];
    const updated = [...existing, sessionId];
    if (updated.length > maxSessions) {
      const removed = updated.shift();
      if (removed) RedisService.inMemoryRevokedSessions.add(removed);
    }
    RedisService.inMemorySessions.set(userId, updated);

    if (!this.client || this.client.status !== 'ready') return;

    try {
      const key = `user:${userId}:sessions`;
      await this.client.rpush(key, sessionId);
      await this.client.expire(key, 30 * 24 * 3600); // ۳۰ روز اعتبار سشن

      // اگر تعداد سشن‌ها از ۲ بیشتر شد، قدیمی‌ترین (FIFO) را اخراج کن
      const totalSessions = await this.client.llen(key);
      if (totalSessions > maxSessions) {
        await this.client.lpop(key);
      }
    } catch {
      // fallback to in-memory
    }
  }

  /**
   * بررسی اینکه آیا سشن موردنظر هنوز در لیست سشن‌های معتبر کاربر قرار دارد یا خیر
   */
  async isSessionValid(userId: string, sessionId: string): Promise<boolean> {
    if (RedisService.inMemoryRevokedSessions.has(sessionId)) {
      return false;
    }

    if (this.client && this.client.status === 'ready') {
      try {
        const key = `user:${userId}:sessions`;
        const sessions = await this.client.lrange(key, 0, -1);
        if (sessions.length > 0) {
          return sessions.includes(sessionId);
        }
      } catch {
        // fallback to in-memory
      }
    }

    const memSessions = RedisService.inMemorySessions.get(userId);
    if (memSessions && memSessions.length > 0) {
      return memSessions.includes(sessionId);
    }

    return true;
  }

  /**
   * حذف یک سشن خاص در زمان لاگ‌اوت
   */
  async removeSession(userId: string, sessionId: string): Promise<void> {
    RedisService.inMemoryRevokedSessions.add(sessionId);
    const memSessions = RedisService.inMemorySessions.get(userId);
    if (memSessions) {
      RedisService.inMemorySessions.set(
        userId,
        memSessions.filter((s) => s !== sessionId),
      );
    }

    if (!this.client || this.client.status !== 'ready') return;

    try {
      const key = `user:${userId}:sessions`;
      await this.client.lrem(key, 0, sessionId);
    } catch {
      // fallback
    }
  }
}
