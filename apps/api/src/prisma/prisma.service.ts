import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@condorlab/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public client: PrismaClient = this;

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.warn('⚠️ Prisma could not connect to PostgreSQL immediately (waiting for database service):', (error as Error).message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
