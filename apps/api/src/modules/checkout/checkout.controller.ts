import { Controller, Get, Post, Body, Query, Req, BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { ApplyCouponSchema, CompleteProfileSchema } from '@condorlab/shared';
import type { Request } from 'express';
import { parseSessionToken } from '../../common/utils/session.util';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  private extractUserId(req: Request): string {
    const rawSession = req.cookies?.condor_session || req.headers.authorization;
    const parsed = parseSessionToken(rawSession);
    if (parsed) {
      return parsed.userId;
    }
    // شناسه سشن موقت کلاینت
    return (req.headers['x-client-session-id'] as string) || 'demo-student-session';
  }

  @Get('preview')
  async getPreview(@Query('examId') examId: string, @Req() req: Request) {
    if (!examId) {
      throw new BadRequestException('شناسه یا اسلاگ آزمون الزامی است.');
    }
    const userId = this.extractUserId(req);
    return {
      success: true,
      data: await this.checkoutService.getCheckoutPreview(userId, examId),
    };
  }

  @Post('coupon')
  async applyCoupon(@Body() body: any, @Req() req: Request) {
    const parsed = ApplyCouponSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'کد تخفیف نامعتبر است.');
    }

    const userId = this.extractUserId(req);
    const result = await this.checkoutService.validateAndApplyCoupon(
      userId,
      parsed.data.examId,
      parsed.data.code,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('complete-profile')
  async completeProfile(@Body() body: any, @Req() req: Request) {
    const parsed = CompleteProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'مشخصات وارد شده معتبر نمی‌باشد.');
    }

    const userId = this.extractUserId(req);
    const updated = await this.checkoutService.completeProfile(userId, parsed.data);

    return {
      success: true,
      data: updated,
      message: 'مشخصات تحصیلی با موفقیت ذخیره گردید.',
    };
  }

  @Post('process')
  async processEnrollment(
    @Body() body: { examId: string; couponCode?: string },
    @Req() req: Request,
  ) {
    if (!body.examId) {
      throw new BadRequestException('شناسه آزمون مشخص نشده است.');
    }

    const userId = this.extractUserId(req);
    const result = await this.checkoutService.processEnrollment(
      userId,
      body.examId,
      body.couponCode,
    );

    return {
      success: true,
      data: result,
    };
  }
}
