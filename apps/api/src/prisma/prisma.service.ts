import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@condorlab/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public client: PrismaClient = this;

  async onModuleInit() {
    let retries = 3;
    while (retries > 0) {
      try {
        await this.$connect();
        // اجرای پرس‌وجوی گرم‌سازی پول ارتباطی دیتابیس (Pool Warm-up) جهت جلوگیری از افتادن اولین درخواست‌ها
        await this.$queryRawUnsafe('SELECT 1');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.warn('⚠️ Prisma could not connect to PostgreSQL immediately (waiting for database service):', (error as Error).message);
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
