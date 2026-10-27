import { Controller, Get, Post, Param } from '@nestjs/common';
import { GradingService } from './grading.service';

@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  /**
   * دریافت کارنامه تحلیلی کامل تلاش آزمون با جزئیات نمره‌دهی مصوب PRD
   */
  @Get('attempt/:attemptId')
  async getAttemptReport(@Param('attemptId') attemptId: string) {
    const report = await this.gradingService.gradeAttempt(attemptId);
    return {
      success: true,
      data: report,
    };
  }

  /**
   * تصحیح همگانی تمام تلاش‌های آزمون و محاسبه رتبه‌های رسمی
   */
  @Post('exam/:examId/grade-all')
  async gradeAllAttempts(@Param('examId') examId: string) {
    const result = await this.gradingService.gradeAllAttempts(examId);
    return {
      success: true,
      data: result,
    };
  }
}
