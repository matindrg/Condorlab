import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { Request } from 'express';
import { parseSessionToken } from '../../common/utils/session.util';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private extractUserId(req: Request): string {
    const rawSession = req.cookies?.condor_session || req.headers.authorization;
    const parsed = parseSessionToken(rawSession);
    if (parsed) {
      return parsed.userId;
    }
    return (req.headers['x-client-session-id'] as string) || 'demo-student-session';
  }

  @Get('overview')
  async getOverview(@Req() req: Request) {
    const userId = this.extractUserId(req);
    const data = await this.dashboardService.getDashboardOverview(userId);
    return {
      success: true,
      data,
    };
  }

  @Get()
  async getDashboardRoot(@Req() req: Request) {
    return this.getOverview(req);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() body: any, @Req() req: Request) {
    const userId = this.extractUserId(req);
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('اطلاعات ارسالی نامعتبر است.');
    }
    const updated = await this.dashboardService.updateProfile(userId, body);
    return {
      success: true,
      data: updated,
      message: 'مشخصات شما با موفقیت به‌روزرسانی شد.',
    };
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async patchProfile(@Body() body: any, @Req() req: Request) {
    return this.updateProfile(body, req);
  }
}
