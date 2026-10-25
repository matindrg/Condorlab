import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export * from '@prisma/client';

// اطمینان از بارگذاری متغیر DATABASE_URL
if (!process.env.DATABASE_URL) {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        if (typeof (process as any).loadEnvFile === 'function') {
          (process as any).loadEnvFile(envPath);
        } else {
          const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
          for (const line of lines) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (m && !process.env[m[1]]) {
              let val = (m[2] || '').trim();
              if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
              if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
              process.env[m[1]] = val;
            }
          }
        }
        if (process.env.DATABASE_URL) break;
      } catch {}
    }
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://condor_admin:condor_secret_1405@localhost:5432/condorlab_db?schema=public';
}

if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
