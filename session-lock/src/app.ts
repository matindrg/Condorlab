import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import { requestId } from './middleware/request-id';
import { createErrorHandler, notFound } from './middleware/error-handler';
import { createRequireAuth } from './auth/auth.middleware';
import { createExamRouter } from './exam/exam.routes';
import type { ExamController } from './exam/exam.controller';
import type { SessionService } from './session/session.service';
import type { AppConfig } from './config';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  redis: Redis;
  sessions: SessionService;
  examController: ExamController;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: deps.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(requestId);
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req) => (req as express.Request).requestId,
      redact: ['req.headers.authorization'],
    }),
  );

  app.get('/health', async (_req, res) => {
    try {
      await deps.redis.ping();
      res.status(200).json({ status: 'ok', redis: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', redis: 'down' });
    }
  });

  const requireAuth = createRequireAuth(deps.sessions, deps.config.jwtSecret);
  app.use(
    '/api/exam',
    createExamRouter({
      controller: deps.examController,
      requireAuth,
      redis: deps.redis,
    }),
  );

  app.use(notFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
