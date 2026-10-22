import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { createRateLimit } from '../middleware/rate-limit';
import type { RequestHandler } from 'express';
import type Redis from 'ioredis';
import type { ExamController } from './exam.controller';

export function createExamRouter(options: {
  controller: ExamController;
  requireAuth: RequestHandler;
  redis: Redis;
}): Router {
  const router = Router();
  const { controller, requireAuth, redis } = options;

  router.use(requireAuth);

  router.post(
    '/:attemptId/start',
    createRateLimit(redis, 'exam_start', 20, 60),
    asyncHandler(controller.start),
  );
  router.post(
    '/:attemptId/heartbeat',
    createRateLimit(redis, 'exam_heartbeat', 120, 60),
    asyncHandler(controller.heartbeat),
  );
  router.post(
    '/:attemptId/takeover',
    createRateLimit(redis, 'exam_takeover', 10, 60),
    asyncHandler(controller.takeover),
  );
  router.post(
    '/:attemptId/submit',
    createRateLimit(redis, 'exam_submit', 10, 60),
    asyncHandler(controller.submit),
  );
  router.get(
    '/:attemptId/lock',
    createRateLimit(redis, 'exam_lock_state', 120, 60),
    asyncHandler(controller.state),
  );

  return router;
}
