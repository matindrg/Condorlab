import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { parseSessionToken } from '../../common/utils/session.util';
import type { Request } from 'express';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * دریافت فهرست کلیه آزمون‌های دارای لیدربورد رقابتی رسمی
   */
  @Get()
  async getAllLeaderboards() {
    const data = await this.leaderboardService.getAllExamLeaderboards();
    return {
      success: true,
      data,
    };
  }

  /**
   * دریافت جدول لیدربورد رسمی آزمون با قابلیت فیلتر پایه و برجسته‌سازی داوطلب لاگین‌شده
   */
  @Get(':examId')
  async getExamLeaderboard(
    @Param('examId') examId: string,
    @Query('grade') grade?: string,
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ) {
    const rawSession = req?.cookies?.condor_session || req?.headers?.authorization;
    const parsed = parseSessionToken(rawSession);
    const currentUserId = parsed?.userId || (req?.headers?.['x-user-id'] as string);
    const parsedLimit = limit ? parseInt(limit, 10) : 50;

    const data = await this.leaderboardService.getOfficialLeaderboard(examId, {
      gradeFilter: grade,
      limit: parsedLimit,
      currentUserId,
    });

    return {
      success: true,
      data,
    };
  }
}
