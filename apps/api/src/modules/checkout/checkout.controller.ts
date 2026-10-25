import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApplyCouponSchema, CompleteProfileSchema } from '@condorlab/shared';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('preview')
  async getPreview(
    @Query('examId') examId: string,
    @CurrentUser('id') userId?: string,
  ) {
    if (!examId) {
      throw new BadRequestException('شناسه آزمون الزامی است.');
    }
    const currentUserId = userId || 'mock-student-id';
    return {
      success: true,
      data: await this.checkoutService.getCheckoutPreview(currentUserId, examId),
    };
  }

  @Post('coupon')
  async applyCoupon(
    @Body() body: any,
    @CurrentUser('id') userId?: string,
  ) {
    const parsed = ApplyCouponSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0].message);
    }

    const currentUserId = userId || 'mock-student-id';
    const result = await this.checkoutService.validateAndApplyCoupon(
      currentUserId,
      parsed.data.examId,
      parsed.data.code,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('complete-profile')
  async completeProfile(
    @Body() body: any,
    @CurrentUser('id') userId?: string,
  ) {
    const parsed = CompleteProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0].message);
    }

    const currentUserId = userId || 'mock-student-id';
    const updated = await this.checkoutService.completeProfile(currentUserId, parsed.data);

    return {
      success: true,
      data: updated,
      message: 'مشخصات با موفقیت ذخیره گردید.',
    };
  }

  @Post('process')
  async processEnrollment(
    @Body() body: { examId: string; couponCode?: string },
    @CurrentUser('id') userId?: string,
  ) {
    if (!body.examId) {
      throw new BadRequestException('شناسه آزمون مشخص نشده است.');
    }

    const currentUserId = userId || 'mock-student-id';
    const result = await this.checkoutService.processEnrollment(
      currentUserId,
      body.examId,
      body.couponCode,
    );

    return {
      success: true,
      data: result,
    };
  }
}
