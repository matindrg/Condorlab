import pino from 'pino';
import { config } from './config';
import { createRedisClient } from './redis/client';
import { registerExamLockScripts } from './redis/scripts';
import { SessionService } from './session/session.service';
import { createDemoAttemptRepository } from './attempts/attempt.repository';
import { AttemptService } from './attempts/attempt.service';
import { ExamLockService } from './exam/lock.service';
import { ExamController } from './exam/exam.controller';
import { createApp } from './app';

const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization'],
});

async function main(): Promise<void> {
  const redis = createRedisClient(config.redisUrl);
  await redis.ping();

  const scripts = registerExamLockScripts(redis);
  const sessions = new SessionService(redis, undefined, config.maxSessions);
  const attemptRepository = createDemoAttemptRepository();
  const attempts = new AttemptService(attemptRepository);
  const lock = new ExamLockService(redis, scripts, config.takeoverLimit);
  const examController = new ExamController(attempts, lock);

  const app = createApp({
    config,
    logger,
    redis,
    sessions,
    examController,
  });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'exam-lock server listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await redis.quit();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled rejection');
  });
}

main().catch((error) => {
  logger.error({ err: error }, 'failed to start');
  process.exit(1);
});
