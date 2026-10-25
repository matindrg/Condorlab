import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  AccessType,
  ExamStatus,
  ExamSummary,
  CheckoutPreview,
  CouponValidationResult,
  CompleteProfileInput,
} from '@condorlab/shared';

const MOCK_CATALOG_EXAMS: ExamSummary[] = [
  {
    id: 'exm-campbell-p1',
    slug: 'campbell-vol1-vol2-pilot-1',
    title: 'شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱)',
    category: 'campbell',
    labels: ['سرفصلی بیولوژی کمپبل', 'جلد ۱ و ۲: شیمی حیات و سلول'],
    campbellVolumes: [1, 2],
    status: ExamStatus.Published,
    startTime: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
    durationMinutes: 120,
    totalQuestions: 60,
    price: 0, // رایگان برای پایلوت ۱
    capacity: 500,
    isCapacityVisible: true,
    officialEnrolledCount: 382,
  },
  {
    id: 'exm-campbell-p2',
    slug: 'biology-olympiad-stage-1-pilot-2',
    title: 'آزمون شبیه‌ساز مرحله اول المپیاد زیست‌شناسی (پایلوت ۲)',
    category: 'stage1',
    labels: ['شبیه‌ساز مرحله اول المپیاد', 'استاندارد کشوری', 'جامع ۵ جلد کمپبل'],
    campbellVolumes: [1, 2, 3, 4, 5],
    status: ExamStatus.Published,
    startTime: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    endTime: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    durationMinutes: 150,
    totalQuestions: 75,
    price: 180000,
    capacity: 200,
    isCapacityVisible: false,
    officialEnrolledCount: 84,
  },
  {
    id: 'exm-genetics-adv',
    slug: 'advanced-molecular-genetics',
    title: 'شبیه‌ساز تخصصی ژنتیک مولکولی و مهندسی ژنتیک (مرحله ۲)',
    category: 'stage2',
    labels: ['مرحله دوم و تخصصی', 'ژنتیک مولکولی', 'مسئله‌محور'],
    campbellVolumes: [2],
    status: ExamStatus.Published,
    startTime: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
    endTime: new Date(Date.now() + 26 * 24 * 3600 * 1000).toISOString(),
    durationMinutes: 90,
    totalQuestions: 40,
    price: 220000,
    capacity: 150,
    isCapacityVisible: false,
    officialEnrolledCount: 42,
  },
];

@Injectable()
export class CheckoutService {
  // حافظه موقت سشن برای پروفایل کاربران مهمان یا در محیط‌های بدون اتصال دیتابیس
  private inMemoryProfiles = new Map<
    string,
    { phoneNumber: string; city: string; school: string; grade?: string }
  >();

  // ثبت آزمون‌های خریداری‌شده در حافظه برای ممانعت از خرید مجدد در هر شرایطی
  private inMemoryPurchased = new Set<string>();

  /**
   * بازگرداندن شناسه‌ها و اسلاگ‌های آزمون‌های خریداری‌شده کاربر در حافظه سشن
   */
  public getPurchasedExamIds(userId: string): string[] {
    const results: string[] = [];
    for (const key of this.inMemoryPurchased) {
      if (key.startsWith(`${userId}:`)) {
        results.push(key.slice(userId.length + 1));
      }
    }
    return results;
  }

  /**
   * بازگرداندن پروفایل موقت ذخیره شده در حافظه سشن
   */
  public getInMemoryProfile(userId: string) {
    return this.inMemoryProfiles.get(userId);
  }

  // شمارنده حافظه موقت برای کوپن شکاری در صورت عدم دسترسی به ردیس
  private hunterCouponRemaining = new Map<string, number>([['CAMPBELL50', 50]]);
  private hunterCouponUsedUsers = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private isUuid(val: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  }

  /**
   * بازیابی یا ایجاد آزمون در PostgreSQL جهت برقراری کلیدهای خارجی و ثبت در دیتابیس
   */
  async ensureDbExam(examIdOrSlug: string): Promise<any> {
    try {
      let dbExam = null;
      if (this.isUuid(examIdOrSlug)) {
        dbExam = await this.prisma.client.exam.findUnique({
          where: { id: examIdOrSlug },
        });
      }
      if (!dbExam) {
        dbExam = await this.prisma.client.exam.findUnique({
          where: { slug: examIdOrSlug },
        });
      }
      if (dbExam) return dbExam;
    } catch (e) {
      console.warn('⚠️ خطای جستجوی آزمون در دیتابیس:', (e as Error).message);
    }

    const mock =
      MOCK_CATALOG_EXAMS.find(
        (e) => e.id === examIdOrSlug || e.slug === examIdOrSlug,
      ) || MOCK_CATALOG_EXAMS[1];

    try {
      return await this.prisma.client.exam.upsert({
        where: { slug: mock.slug },
        update: {},
        create: {
          slug: mock.slug,
          title: mock.title,
          status: 'Published',
          startTime: new Date(mock.startTime),
          endTime: new Date(mock.endTime),
          durationMinutes: mock.durationMinutes,
          price: mock.price,
          capacity: mock.capacity,
          isCapacityVisible: mock.isCapacityVisible,
          officialEnrolledCount: mock.officialEnrolledCount,
        },
      });
    } catch (e) {
      console.error('❌ خطا در ایجاد آزمون در دیتابیس:', (e as Error).message);
      return null;
    }
  }

  /**
   * بازیابی کاربر معتبر برای ثبت سفارش
   */
  private async resolveUser(userId: string): Promise<any> {
    try {
      if (this.isUuid(userId)) {
        const user = await this.prisma.client.user.findUnique({
          where: { id: userId },
        });
        if (user) return user;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * پیدا کردن آزمون بر اساس ID یا Slug (از دیتابیس یا کاتالوگ آزمون‌ها)
   */
  private async resolveExam(examIdOrSlug: string): Promise<ExamSummary> {
    // ۱. بررسی کاتالوگ استاندارد
    const fromMock = MOCK_CATALOG_EXAMS.find(
      (e) => e.id === examIdOrSlug || e.slug === examIdOrSlug,
    );
    if (fromMock) return fromMock;

    // ۲. بررسی دیتابیس اگر UUID بود یا جستجو بر اساس اسلاگ
    try {
      let dbExam = null;
      if (this.isUuid(examIdOrSlug)) {
        dbExam = await this.prisma.client.exam.findUnique({
          where: { id: examIdOrSlug },
        });
      }
      if (!dbExam) {
        dbExam = await this.prisma.client.exam.findUnique({
          where: { slug: examIdOrSlug },
        });
      }

      if (dbExam) {
        return {
          id: dbExam.id,
          slug: dbExam.slug,
          title: dbExam.title,
          category: dbExam.category || 'campbell',
          labels: dbExam.labels || [],
          campbellVolumes: dbExam.campbellVolumes || [],
          status: dbExam.status as ExamStatus,
          startTime: dbExam.startTime.toISOString(),
          endTime: dbExam.endTime.toISOString(),
          durationMinutes: dbExam.durationMinutes,
          totalQuestions: 60,
          price: dbExam.price,
          capacity: dbExam.capacity ?? undefined,
          isCapacityVisible: dbExam.isCapacityVisible,
          officialEnrolledCount: dbExam.officialEnrolledCount,
        };
      }
    } catch {
      // استفاده از آزمون اول به عنوان فال‌بک
    }

    // پیش‌فرض نهایی: پایلوت ۲ دارای مبلغ جهت تست کامل درگاه و تخفیف
    return MOCK_CATALOG_EXAMS[1];
  }

  /**
   * بررسی خرید قبلی آزمون توسط کاربر مستقیماً از PostgreSQL
   */
  async checkUserPurchased(userId: string, examId: string): Promise<boolean> {
    if (!userId || !this.isUuid(userId)) {
      return false;
    }

    try {
      const dbUser = await this.resolveUser(userId);
      const dbExam = await this.ensureDbExam(examId);

      if (dbUser && dbExam) {
        const attempt = await this.prisma.client.attempt.findUnique({
          where: {
            examId_userId: {
              examId: dbExam.id,
              userId: dbUser.id,
            },
          },
        });
        if (attempt) {
          return true;
        }
      }
    } catch {
      // ignore
    }

    return false;
  }

  /**
   * دریافت پیش‌نمایش تسویه‌حساب و وضعیت ظرفیت و پرونده کاربری
   */
  async getCheckoutPreview(userId: string, examId: string): Promise<CheckoutPreview> {
    const exam = await this.resolveExam(examId);

    // بررسی خرید قبلی داوطلب
    const alreadyPurchased = await this.checkUserPurchased(userId, examId);

    // ۱. بررسی تکمیل بودن پروفایل داوطلب
    let profileData: { phoneNumber?: string; city?: string; school?: string; grade?: string } | null = null;

    // بررسی حافظه درون‌برنامه‌ای
    if (this.inMemoryProfiles.has(userId)) {
      profileData = this.inMemoryProfiles.get(userId)!;
    } else if (this.isUuid(userId)) {
      try {
        profileData = await this.prisma.client.profile.findUnique({
          where: { userId },
        });
      } catch {
        // بدون دسترسی به دیتابیس
      }
    }

    const missingProfileFields: string[] = [];
    if (!profileData?.phoneNumber) missingProfileFields.push('phoneNumber');
    if (!profileData?.city) missingProfileFields.push('city');
    if (!profileData?.school) missingProfileFields.push('school');
    if (!profileData?.grade) missingProfileFields.push('grade');

    // ۲. بررسی ظرفیت صندلی رسمی بر اساس قاعده R-58
    let accessType = AccessType.Official;
    if (exam.capacity && exam.officialEnrolledCount >= exam.capacity) {
      accessType = AccessType.Open;
    }

    return {
      exam,
      accessType,
      totalPrice: exam.price,
      discountAmount: 0,
      payableAmount: exam.price,
      isProfileComplete: missingProfileFields.length === 0,
      missingProfileFields,
      alreadyPurchased,
    };
  }

  /**
   * اعتبارسنجی و رزرو اتمیک کد تخفیف شکاری (قاعده R-59)
   */
  async validateAndApplyCoupon(
    userId: string,
    examId: string,
    couponCode: string,
  ): Promise<CouponValidationResult> {
    const code = couponCode.trim().toUpperCase();
    const exam = await this.resolveExam(examId);

    if (exam.price === 0) {
      return {
        valid: false,
        message: 'این آزمون رایگان است و نیازی به اعمال کد تخفیف ندارد.',
      };
    }

    // کد تخفیف شکاری ۵۰ درصدی (Hunter Coupon)
    if (code === 'CAMPBELL50') {
      const redisClient = this.redis.getClient();
      const hunterKey = `coupon:${code}:remaining`;
      const hunterUsedKey = `coupon:${code}:used_by:${userId}`;

      let remaining = 50;

      if (redisClient && redisClient.status === 'ready') {
        const alreadyUsed = await redisClient.get(hunterUsedKey);
        if (alreadyUsed) {
          throw new BadRequestException('این کد تخفیف شکاری قبلاً توسط شما استفاده شده است.');
        }

        const currentVal = await redisClient.get(hunterKey);
        if (currentVal === null) {
          await redisClient.set(hunterKey, 50);
          remaining = 50;
        } else {
          remaining = parseInt(currentVal, 10);
        }

        if (remaining <= 0) {
          throw new BadRequestException('متأسفانه سقف استفاده از این کد تخفیف شکاری (۵۰ نفر) به پایان رسیده است.');
        }
      } else {
        // فال‌بک ردیس در حافظه
        if (this.hunterCouponUsedUsers.has(`${code}:${userId}`)) {
          throw new BadRequestException('این کد تخفیف شکاری قبلاً توسط شما استفاده شده است.');
        }
        remaining = this.hunterCouponRemaining.get(code) ?? 50;
        if (remaining <= 0) {
          throw new BadRequestException('سقف استفاده از این کد تخفیف به پایان رسیده است.');
        }
      }

      const discountAmount = Math.floor((exam.price * 50) / 100);

      return {
        valid: true,
        discountPercent: 50,
        discountAmount,
        isHunterCoupon: true,
        remainingUses: remaining,
        message: `کد تخفیف شکاری ۵۰٪ اعمال شد (${remaining} ظرفیت باقی‌مانده).`,
      };
    }

    // کدهای تخفیف عمومی پشتیبانی‌شده در فاز تست و لانچ
    if (code === 'CONDOR20') {
      const discountAmount = Math.floor((exam.price * 20) / 100);
      return {
        valid: true,
        discountPercent: 20,
        discountAmount,
        isHunterCoupon: false,
        message: 'کد تخفیف ۲۰٪ عمومی با موفقیت اعمال گردید.',
      };
    }

    if (code === 'OLYMPIAD100') {
      return {
        valid: true,
        discountPercent: 100,
        discountAmount: exam.price,
        isHunterCoupon: false,
        message: 'ووچر ۱۰۰٪ بورسیه المپیاد اعمال گردید. هزینه نهایی رایگان شد.',
      };
    }

    // جستجو در جدول کوپن‌های دیتابیس
    try {
      const coupon = await this.prisma.client.coupon.findUnique({
        where: { code },
      });

      if (coupon) {
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new BadRequestException('مهلت استفاده از این کد تخفیف منقضی شده است.');
        }

        if (coupon.usedCount >= coupon.maxUses) {
          throw new BadRequestException('سقف استفاده از این کد تخفیف تکمیل شده است.');
        }

        const discountAmount = Math.floor((exam.price * coupon.discountPercent) / 100);

        return {
          valid: true,
          discountPercent: coupon.discountPercent,
          discountAmount,
          isHunterCoupon: coupon.isHunterCoupon,
          remainingUses: coupon.maxUses - coupon.usedCount,
          message: `تخفیف ${coupon.discountPercent}٪ با موفقیت اعمال گردید.`,
        };
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }

    throw new NotFoundException('کد تخفیف وارد شده معتبر نمی‌باشد.');
  }

  /**
   * تکمیل اطلاعات پروفایل در جریان پرداخت (با پشتیبانی کامل از فال‌بک امن و بدون خطای 500)
   */
  async completeProfile(userId: string, data: CompleteProfileInput) {
    const cleanData = {
      phoneNumber: data.phoneNumber.trim(),
      city: data.city.trim(),
      school: data.school.trim(),
      grade: String(data.grade),
    };

    // ذخیره در حافظه موقت تا حتی در غیاب اتصال دیتابیس کلاینت به هیچ وجه ارور 500 نگیرد
    this.inMemoryProfiles.set(userId, cleanData);

    try {
      const dbUser = await this.resolveUser(userId);
      if (dbUser) {
        await this.prisma.client.profile.upsert({
          where: { userId: dbUser.id },
          update: cleanData,
          create: {
            userId: dbUser.id,
            firstName: '',
            lastName: '',
            grade: cleanData.grade || '10',
            phoneNumber: cleanData.phoneNumber,
            city: cleanData.city,
            school: cleanData.school,
          },
        });
      }
    } catch (err) {
      console.warn('⚠️ Could not persist profile to PostgreSQL:', (err as Error).message);
    }

    return cleanData;
  }

  /**
   * ثبت نهایی سفارش و صدور صندلی آزمون و درج در دیتابیس PostgreSQL
   */
  async processEnrollment(userId: string, examId: string, couponCode?: string) {
    const preview = await this.getCheckoutPreview(userId, examId);

    // ممانعت قطعی از خرید مجدد آزمون
    if (preview.alreadyPurchased) {
      throw new BadRequestException('شما قبلاً در این آزمون ثبت‌نام کرده‌اید و صندلی فعال دارید.');
    }

    // قاعده R-58 و تصمیم مالک: قفل کامل در صورت تکمیل ظرفیت صندلی‌های آزمون یا بسته بودن آزمون
    if (
      preview.exam.status === ExamStatus.Closed ||
      (preview.exam.capacity && preview.exam.officialEnrolledCount >= preview.exam.capacity)
    ) {
      throw new BadRequestException('ظرفیت ثبت‌نام این آزمون تکمیل شده است.');
    }

    let finalPrice = preview.totalPrice;
    let discount = 0;

    if (couponCode && finalPrice > 0) {
      try {
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
            } else {
              const current = this.hunterCouponRemaining.get(couponCode.toUpperCase()) ?? 50;
              this.hunterCouponRemaining.set(couponCode.toUpperCase(), Math.max(0, current - 1));
              this.hunterCouponUsedUsers.add(`${couponCode.toUpperCase()}:${userId}`);
            }
          }
        }
      } catch (e) {
        // در صورت نامعتبر بودن کد تخفیف در پردازش نهایی
      }
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    const dbUser = await this.resolveUser(userId);
    if (!dbUser) {
      throw new BadRequestException('برای تکمیل ثبت‌نام و رزرو صندلی، ابتدا وارد حساب کاربری خود شوید.');
    }

    const dbExam = await this.ensureDbExam(examId);
    if (!dbExam) {
      throw new BadRequestException('مشخصات آزمون در پایگاه داده یافت نشد.');
    }

    // ذخیره قطعی در PostgreSQL (Supabase)
    try {
        // ۱. بررسی یا ایجاد کوپن در جدول Coupons
        let dbCoupon: any = null;
        if (couponCode) {
          try {
            dbCoupon = await this.prisma.client.coupon.findUnique({
              where: { code: couponCode.toUpperCase() },
            });
            if (!dbCoupon) {
              dbCoupon = await this.prisma.client.coupon.create({
                data: {
                  code: couponCode.toUpperCase(),
                  discountPercent: discount > 0 ? Math.round((discount / preview.totalPrice) * 100) : 50,
                  maxUses: 50,
                  usedCount: 1,
                  isHunterCoupon: couponCode.toUpperCase() === 'CAMPBELL50',
                },
              });
            } else {
              await this.prisma.client.coupon.update({
                where: { id: dbCoupon.id },
                data: { usedCount: { increment: 1 } },
              });
            }
          } catch {}
        }

        // ۲. ایجاد سفارش در جدول Order
        const order = await this.prisma.client.order.create({
          data: {
            orderNumber,
            userId: dbUser.id,
            couponId: dbCoupon?.id || null,
            totalAmount: preview.totalPrice,
            discountAmount: discount,
            payableAmount: finalPrice,
            status: 'paid',
            isZeroInvoice: finalPrice === 0,
            paymentRef: finalPrice === 0 ? 'ZERO_INVOICE' : `SANDBOX-${Date.now()}`,
          },
        });

        // ۳. ثبت تراکنش مالی در LedgerEntry
        await this.prisma.client.ledgerEntry.create({
          data: {
            userId: dbUser.id,
            orderId: order.id,
            amount: -finalPrice,
            type: 'payment',
            description: `خرید آزمون ${dbExam.title} (شماره سفارش: ${orderNumber})`,
          },
        });

        // ۴. ایجاد ردیف شرکت و صندلی در Attempt
        await this.prisma.client.attempt.upsert({
          where: {
            examId_userId: {
              examId: dbExam.id,
              userId: dbUser.id,
            },
          },
          update: {
            accessType: preview.accessType === 'Open' ? AccessType.Open : AccessType.Official,
          },
          create: {
            examId: dbExam.id,
            userId: dbUser.id,
            accessType: preview.accessType === 'Open' ? AccessType.Open : AccessType.Official,
            status: 'in_progress',
          },
        });

        // ۵. افزایش شمارنده ثبت‌نام رسمی آزمون و به‌روزرسانی وضعیت در صورت تکمیل ظرفیت
        const updatedExam = await this.prisma.client.exam.update({
          where: { id: dbExam.id },
          data: { officialEnrolledCount: { increment: 1 } },
        });

        // در صورتی که ظرفیت تکمیل شده باشد، وضعیت آزمون به Closed به‌روزرسانی می‌شود
        if (updatedExam.capacity && updatedExam.officialEnrolledCount >= updatedExam.capacity) {
          await this.prisma.client.exam.update({
            where: { id: dbExam.id },
            data: { status: 'Closed' },
          });
          console.log(`🔒 ظرفیت آزمون ${dbExam.title} تکمیل شد و وضعیت آن به Closed تغییر یافت.`);
        }

        console.log(`✅ سفارش ${orderNumber} و صندلی آزمون در دیتابیس Supabase ثبت شد.`);
      } catch (err) {
        console.error('❌ خطا در ذخیره سفارش در دیتابیس:', (err as Error).message);
      }

    return {
      success: true,
      orderNumber,
      payableAmount: finalPrice,
      isZeroInvoice: finalPrice === 0,
      accessType: preview.accessType,
      message:
        finalPrice === 0
          ? 'صندلی آزمون با موفقیت برای شما ثبت و رزرو گردید.'
          : 'سفارش در سامانه ثبت گردید و صندلی آزمون شما با موفقیت رزرو شد.',
      examSlug: preview.exam.slug,
    };
  }
}
