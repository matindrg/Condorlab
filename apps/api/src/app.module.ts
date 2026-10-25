import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExamsModule } from './modules/exams/exams.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, ExamsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
