import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

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
    if (!this.client || this.client.status !== 'ready') return;

    const key = `user:${userId}:sessions`;
    await this.client.rpush(key, sessionId);
    await this.client.expire(key, 30 * 24 * 3600); // ۳۰ روز اعتبار سشن

    // اگر تعداد سشن‌ها از ۲ بیشتر شد، قدیمی‌ترین (FIFO) را اخراج کن
    const totalSessions = await this.client.llen(key);
    if (totalSessions > maxSessions) {
      await this.client.lpop(key);
    }
  }

  /**
   * بررسی اینکه آیا سشن موردنظر هنوز در لیست سشن‌های معتبر کاربر قرار دارد یا خیر
   */
  async isSessionValid(userId: string, sessionId: string): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') return true; // فال‌بک در زمان قطع ردیس

    const key = `user:${userId}:sessions`;
    const sessions = await this.client.lrange(key, 0, -1);
    return sessions.includes(sessionId);
  }

  /**
   * حذف یک سشن خاص در زمان لاگ‌اوت
   */
  async removeSession(userId: string, sessionId: string): Promise<void> {
    if (!this.client || this.client.status !== 'ready') return;
    const key = `user:${userId}:sessions`;
    await this.client.lrem(key, 0, sessionId);
  }
}
