import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ExamsService } from './exams.service';
import type { Request } from 'express';
import { parseSessionToken } from '../../common/utils/session.util';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  private extractUserId(req: Request): string | undefined {
    const rawSession = req.cookies?.condor_session || req.headers.authorization;
    const parsed = parseSessionToken(rawSession);
    if (parsed) {
      return parsed.userId;
    }
    return (req.headers['x-client-session-id'] as string) || undefined;
  }

  @Get()
  async getExams(
    @Query('category') category?: string,
    @Query('volume') volume?: string,
    @Query('search') search?: string,
    @Req() req?: Request,
  ) {
    const volNum = volume ? parseInt(volume, 10) : undefined;
    const userId = req ? this.extractUserId(req) : undefined;
    const exams = await this.examsService.findAll(category, volNum, search, userId);
    return {
      success: true,
      count: exams.length,
      data: exams,
    };
  }

  @Get('my-enrollments')
  async getMyEnrollments(@Req() req: Request) {
    const userId = this.extractUserId(req);
    const enrollments = await this.examsService.getUserEnrolledExamIds(userId);
    return {
      success: true,
      enrolledExamIds: enrollments,
    };
  }

  @Get(':slug')
  async getExamBySlug(@Param('slug') slug: string, @Req() req?: Request) {
    const userId = req ? this.extractUserId(req) : undefined;
    const exam = await this.examsService.findBySlug(slug, userId);
    return {
      success: true,
      data: exam,
    };
  }
}
