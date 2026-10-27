import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExamsModule } from './modules/exams/exams.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExamRoomModule } from './modules/exam-room/exam-room.module';
import { GradingModule } from './modules/grading/grading.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    ExamsModule,
    CheckoutModule,
    DashboardModule,
    ExamRoomModule,
    GradingModule,
    LeaderboardModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
