import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { ExamRoomModule } from '../exam-room/exam-room.module';

@Module({
  imports: [PrismaModule, CheckoutModule, ExamRoomModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
