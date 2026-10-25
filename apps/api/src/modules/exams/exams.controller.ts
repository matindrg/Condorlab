import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExamsService } from './exams.service';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  async getExams(@Query('volume') volume?: string, @Query('search') search?: string) {
    const volNum = volume ? parseInt(volume, 10) : undefined;
    const exams = await this.examsService.findAll(volNum, search);
    return {
      success: true,
      count: exams.length,
      data: exams,
    };
  }

  @Get(':slug')
  async getExamBySlug(@Param('slug') slug: string) {
    const exam = await this.examsService.findBySlug(slug);
    return {
      success: true,
      data: exam,
    };
  }
}
