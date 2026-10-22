import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-at-least-32-chars'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  MAX_SESSIONS: z.coerce.number().int().min(1).max(10).default(2),
  TAKEOVER_LIMIT: z.coerce.number().int().min(0).max(10).default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: never boot with an invalid security configuration.
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('dev-only-secret')) {
  throw new Error('JWT_SECRET must be set to a real secret in production');
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  redisUrl: env.REDIS_URL,
  jwtSecret: env.JWT_SECRET,
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  maxSessions: env.MAX_SESSIONS,
  takeoverLimit: env.TAKEOVER_LIMIT,
  isProduction: env.NODE_ENV === 'production',
} as const;

export type AppConfig = typeof config;
