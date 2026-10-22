import Redis from 'ioredis';

/**
 * Single Redis connection per process.
 *
 * In a multi-process deployment each process owns its own connection; Redis
 * itself is the shared coordination point. All lock mutations are Lua scripts
 * so two Node processes can never interleave a check-and-set.
 */
export function createRedisClient(url: string): Redis {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 100, 3_000);
    },
  });

  redis.on('error', (error) => {
    // Keep the process alive; readiness is checked by /health.
    // In production this should go to your structured logger/alerting.
    // eslint-disable-next-line no-console
    console.error('[redis] connection error', error.message);
  });

  return redis;
}
