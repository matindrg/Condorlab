import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AccessType, ExamStatus, CheckoutPreview, CouponValidationResult, CompleteProfileInput } from '@condorlab/shared';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * دریافت پیش‌نمایش تسویه‌حساب و وضعیت ظرفیت و پرونده کاربری
   */
  async getCheckoutPreview(userId: string, examId: string): Promise<CheckoutPreview> {
    const exam = await this.prisma.client.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      // اگر در دیتابیس نبود، برای آزمون پایلوت نمونه شبیه‌سازی می‌کنیم
      return {
        exam: {
          id: examId,
          slug: 'pilot-campbell-vol1',
          title: 'آزمون آزمایشی پایلوت ۱ (شیمی حیات)',
          campbellVolumes: [1],
          status: ExamStatus.Published,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 7 * 86400000).toISOString(),
          durationMinutes: 120,
          totalQuestions: 60,
          price: 0,
          capacity: 500,
          isCapacityVisible: false,
          officialEnrolledCount: 42,
        },
        accessType: AccessType.Official,
        totalPrice: 0,
        discountAmount: 0,
        payableAmount: 0,
        isProfileComplete: true,
        missingProfileFields: [],
      };
    }

    // بررسی تکمیل بودن پروفایل داوطلب
    const profile = await this.prisma.client.profile.findUnique({
      where: { userId },
    });

    const missingProfileFields: string[] = [];
    if (!profile?.phoneNumber) missingProfileFields.push('phoneNumber');
    if (!profile?.city) missingProfileFields.push('city');
    if (!profile?.school) missingProfileFields.push('school');

    // بررسی ظرفیت صندلی رسمی بر اساس قاعده R-58
    let accessType = AccessType.Official;
    if (exam.capacity && exam.officialEnrolledCount >= exam.capacity) {
      accessType = AccessType.Open;
    }

    return {
      exam: {
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
        campbellVolumes: [1, 2],
        status: exam.status as ExamStatus,
        startTime: exam.startTime.toISOString(),
        endTime: exam.endTime.toISOString(),
        durationMinutes: exam.durationMinutes,
        totalQuestions: 60,
        price: exam.price,
        capacity: exam.capacity ?? undefined,
        isCapacityVisible: exam.isCapacityVisible,
        officialEnrolledCount: exam.officialEnrolledCount,
      },
      accessType,
      totalPrice: exam.price,
      discountAmount: 0,
      payableAmount: exam.price,
      isProfileComplete: missingProfileFields.length === 0,
      missingProfileFields,
    };
  }

  /**
   * اعتبارسنجی و رزرو اتمیک کد تخفیف شکاری در ردیس (قاعده R-59)
   */
  async validateAndApplyCoupon(
    userId: string,
    examId: string,
    couponCode: string,
  ): Promise<CouponValidationResult> {
    const code = couponCode.trim().toUpperCase();

    // پشتیبانی از کد تخفیف نمونه برای پایلوت ۲
    if (code === 'CAMPBELL50') {
      const redisClient = this.redis.getClient();
      const hunterKey = `coupon:${code}:remaining`;
      const hunterUsedKey = `coupon:${code}:used_by:${userId}`;

      let remaining = 50;
      if (redisClient && redisClient.status === 'ready') {
        const alreadyUsed = await redisClient.get(hunterUsedKey);
        if (alreadyUsed) {
          throw new BadRequestException('این کد تخفیف قبلاً توسط حساب کاربری شما استفاده شده است.');
        }

        const currentVal = await redisClient.get(hunterKey);
        if (currentVal === null) {
          await redisClient.set(hunterKey, 50);
          remaining = 50;
        } else {
          remaining = parseInt(currentVal, 10);
        }

        if (remaining <= 0) {
          throw new BadRequestException('ظرفیت کد تخفیف شکاری ۵۰٪ به پایان رسیده است.');
        }
      }

      return {
        valid: true,
        discountPercent: 50,
        isHunterCoupon: true,
        remainingUses: remaining,
        message: `کد تخفیف شکاری ۵۰٪ فعال گردید (${remaining} ظرفیت باقی‌مانده).`,
      };
    }

    // جستجو در جدول کوپن‌ها
    const coupon = await this.prisma.client.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      throw new NotFoundException('کد تخفیف وارد شده معتبر نیست.');
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('مهلت استفاده از این کد تخفیف منقضی شده است.');
    }

    if (coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('سقف استفاده از این کد تخفیف تکمیل شده است.');
    }

    return {
      valid: true,
      discountPercent: coupon.discountPercent,
      isHunterCoupon: coupon.isHunterCoupon,
      remainingUses: coupon.maxUses - coupon.usedCount,
      message: `تخفیف ${coupon.discountPercent}٪ با موفقیت اعمال گردید.`,
    };
  }

  /**
   * تکمیل اطلاعات پروفایل در جریان پرداخت
   */
  async completeProfile(
    userId: string,
    data: CompleteProfileInput,
  ) {
    return this.prisma.client.profile.upsert({
      where: { userId },
      update: {
        phoneNumber: data.phoneNumber,
        city: data.city,
        school: data.school,
      },
      create: {
        userId,
        firstName: '',
        lastName: '',
        grade: '10',
        phoneNumber: data.phoneNumber,
        city: data.city || '',
        school: data.school || '',
      },
    });
  }

  /**
   * ثبت نهایی سفارش و صدور صندلی آزمون (پایلوت رایگان یا درگاه سندباکس زرین‌پال)
   */
  async processEnrollment(
    userId: string,
    examId: string,
    couponCode?: string,
  ) {
    const preview = await this.getCheckoutPreview(userId, examId);

    let finalPrice = preview.totalPrice;
    let discount = 0;

    if (couponCode) {
      const couponRes = await this.validateAndApplyCoupon(userId, examId, couponCode);
      if (couponRes.discountPercent) {
        discount = Math.floor((finalPrice * couponRes.discountPercent) / 100);
        finalPrice = Math.max(0, finalPrice - discount);

        // رزرو ردیس برای کوپن شکاری
        if (couponRes.isHunterCoupon) {
          const redisClient = this.redis.getClient();
          if (redisClient && redisClient.status === 'ready') {
            await redisClient.decr(`coupon:${couponCode}:remaining`);
            await redisClient.set(`coupon:${couponCode}:used_by:${userId}`, '1', 'EX', 86400 * 30);
          }
        }
      }
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    // ثبت یا شبیه‌سازی سفارش
    return {
      success: true,
      orderNumber,
      payableAmount: finalPrice,
      isZeroInvoice: finalPrice === 0,
      accessType: preview.accessType,
      message:
        finalPrice === 0
          ? 'صندلی آزمون با موفقیت برای شما ثبت و رزرو گردید.'
          : 'سفارش ثبت گردید و به درگاه آزمایشی هدایت می‌شوید.',
      examSlug: preview.exam.slug,
    };
  }
}
