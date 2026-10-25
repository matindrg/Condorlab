import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExamsModule } from './modules/exams/exams.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, ExamsModule, CheckoutModule, DashboardModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
