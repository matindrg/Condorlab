import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@condorlab/database';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public client = prisma;

  async onModuleInit() {
    try {
      await this.client.$connect();
    } catch (error) {
      console.warn('⚠️ Prisma could not connect to PostgreSQL immediately (waiting for database service):', (error as Error).message);
    }
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
