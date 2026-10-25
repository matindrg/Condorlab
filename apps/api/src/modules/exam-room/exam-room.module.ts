import { Module } from '@nestjs/common';
import { ExamRoomController } from './exam-room.controller';
import { ExamRoomService } from './exam-room.service';
import { ExamLockService } from './exam-lock.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ExamRoomController],
  providers: [ExamRoomService, ExamLockService],
  exports: [ExamRoomService, ExamLockService],
})
export class ExamRoomModule {}
