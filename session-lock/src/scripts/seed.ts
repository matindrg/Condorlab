import 'dotenv/config';
import { config } from '../config';
import { createRedisClient } from '../redis/client';
import { SessionService } from '../session/session.service';
import { signToken } from '../auth/jwt';
import { DEMO_ATTEMPT_ID, DEMO_EXAM_ID, DEMO_USER_ID } from '../attempts/attempt.repository';

/**
 * Creates two demo login sessions (device A and device B) and prints signed
 * JWTs. Run after Redis is up:
 *
 *   npm run seed
 *
 * The two tokens represent the same student on two devices, which is exactly
 * the scenario this lock is designed to protect.
 */
async function main(): Promise<void> {
  const redis = createRedisClient(config.redisUrl);
  await redis.ping();

  const sessions = new SessionService(redis, undefined, config.maxSessions);
  await sessions.revokeAll(DEMO_USER_ID);

  const deviceA = await sessions.registerLogin(DEMO_USER_ID, 'device-a');
  const deviceB = await sessions.registerLogin(DEMO_USER_ID, 'device-b');

  const tokenA = signToken(
    { sub: DEMO_USER_ID, sid: deviceA.sessionId, did: deviceA.deviceId, role: 'student' },
    config.jwtSecret,
  );
  const tokenB = signToken(
    { sub: DEMO_USER_ID, sid: deviceB.sessionId, did: deviceB.deviceId, role: 'student' },
    config.jwtSecret,
  );

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        userId: DEMO_USER_ID,
        examId: DEMO_EXAM_ID,
        attemptId: DEMO_ATTEMPT_ID,
        deviceA: { token: tokenA, sessionId: deviceA.sessionId, deviceId: deviceA.deviceId },
        deviceB: { token: tokenB, sessionId: deviceB.sessionId, deviceId: deviceB.deviceId },
        authHeaderA: `Authorization: Bearer ${tokenA}`,
        authHeaderB: `Authorization: Bearer ${tokenB}`,
      },
      null,
      2,
    ),
  );

  await redis.quit();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('seed failed', error);
  process.exit(1);
});
