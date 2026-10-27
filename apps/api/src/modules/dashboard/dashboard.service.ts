import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutService } from '../checkout/checkout.service';
import { AuthService } from '../auth/auth.service';
import { ExamLockService } from '../exam-room/exam-lock.service';
import { ExamStatus, ExamSummary } from '@condorlab/shared';

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
    price: 0,
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
  {
    id: 'exm-resilience-1m',
    slug: 'offline-resilience-1min-test',
    title: 'آزمون شبیه‌ساز تست پایداری شبکه و بازیابی (۱ دقیقه‌ای)',
    category: 'campbell',
    labels: ['تست بازیابی شبکه', 'پایلوت آزمایشی', '۱ دقیقه‌ای'],
    campbellVolumes: [1],
    status: ExamStatus.Published,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    durationMinutes: 1,
    totalQuestions: 5,
    price: 0,
    capacity: 1000,
    isCapacityVisible: true,
    officialEnrolledCount: 12,
  },
];

export interface PurchasedProductItem {
  id: string;
  title: string;
  slug: string;
  type: string;
  orderNumber: string;
  price: number;
  payableAmount: number;
  status: string;
  accessType: string;
  purchasedAt: string;
  durationMinutes: number;
  totalQuestions: number;
  campbellVolumes?: number[];
  startTime?: string;
  endTime?: string;
  remainingSeconds?: number;
  isLiveActive?: boolean;
  startedAt?: string;
  submittedAt?: string;
  isSessionLocked?: boolean;
  lockedDeviceId?: string;
  lockedAt?: string;
  lastHeartbeatAt?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
    private readonly examLock: ExamLockService,
  ) {}

  private isUuid(val: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  }

  /**
   * دریافت نمای کلی داشبورد شامل مشخصات ثبت شده کاربر و لیست محصولات خریداری‌شده
   */
  async getDashboardOverview(userId: string) {
    let dbUser: any = null;

    try {
      if (this.isUuid(userId)) {
        dbUser = await this.prisma.client.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            identities: true,
          },
        });
      }
    } catch (e) {
      console.warn('⚠️ خطای دریافت کاربر از دیتابیس:', (e as Error).message);
    }

    // اگر در دیتابیس نبود، بررسی کاربران درون‌حافظه
    if (!dbUser && AuthService.inMemoryUsers.has(userId)) {
      dbUser = AuthService.inMemoryUsers.get(userId);
    }

    if (!dbUser) {
      return {
        user: null,
        purchasedProducts: [],
        totalPurchases: 0,
      };
    }

    // نرمال‌سازی ایمیل کاربر
    let email = dbUser.email || '';
    if (!email && dbUser.identities && Array.isArray(dbUser.identities)) {
      const emailIdent = dbUser.identities.find(
        (id: any) => id.provider === 'EMAIL_PASSWORD' || id.identifier?.includes('@'),
      );
      if (emailIdent) email = emailIdent.identifier;
    }

    // استخراج محصولات و آزمون‌های خریداری‌شده صرفاً از دیتابیس PostgreSQL
    const purchasedProducts: PurchasedProductItem[] = [];

    try {
      if (dbUser.id && this.isUuid(dbUser.id)) {
        const [attempts, orders, ledgerEntries] = await Promise.all([
          this.prisma.client.attempt.findMany({
            where: { userId: dbUser.id },
            include: { exam: true },
            orderBy: { startedAt: 'desc' },
          }),
          this.prisma.client.order.findMany({
            where: { userId: dbUser.id },
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.client.ledgerEntry.findMany({
            where: { userId: dbUser.id },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        const processedExamIds = new Set<string>();

        for (const att of attempts) {
          const exam = att.exam;
          if (!exam) continue;
          processedExamIds.add(exam.id);
          processedExamIds.add(exam.slug);

          // تطبیق با ماک کاتالوگ برای متادیتاهای تکمیلی (در صورت نبود در جدول آزمون)
          const mockMatch = MOCK_CATALOG_EXAMS.find(
            (m) => m.slug === exam.slug || m.id === exam.id,
          );

          // دریافت وضعیت قفل دستگاه فعال برای این نشست آزمون
          const lockInfo = await this.examLock.getLockOwnerInfo(att.id);

          // یافتن تراکنش مالی و سفارش دقیق مرتبط با این آزمون
          const matchingLedger = ledgerEntries.find(
            (l) => l.description.includes(exam.title) || l.description.includes(exam.slug),
          );
          const matchingOrder = matchingLedger
            ? orders.find((o) => o.id === matchingLedger.orderId)
            : orders.find((o) => o.createdAt <= att.startedAt) || orders[0];

          const durationMinutes = exam.durationMinutes || 120;
          let remainingSeconds = durationMinutes * 60;
          let finalStatus = att.status || 'not_started';
          let isLiveActive = false;

          if (att.status === 'not_started') {
            finalStatus = 'not_started';
            isLiveActive = false;
            remainingSeconds = durationMinutes * 60;
          } else if (att.status === 'in_progress') {
            const startedAtMs = att.startedAt ? new Date(att.startedAt).getTime() : Date.now();
            const expiryMs = startedAtMs + durationMinutes * 60 * 1000;
            remainingSeconds = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
            if (remainingSeconds <= 0) {
              finalStatus = 'submitted';
              isLiveActive = false;
              // ثبت خودکار انقضا در دیتابیس
              this.prisma.client.attempt
                .update({
                  where: { id: att.id },
                  data: { status: 'submitted', submittedAt: new Date(expiryMs) },
                })
                .catch(() => {});
            } else {
              finalStatus = 'in_progress';
              isLiveActive = true;
            }
          } else if (att.status === 'submitted') {
            remainingSeconds = 0;
            isLiveActive = false;
            if (att.scorePercentage !== null && att.scorePercentage !== undefined) {
              finalStatus = 'graded';
            } else {
              finalStatus = 'submitted';
            }
          }

          purchasedProducts.push({
            id: att.id,
            title: exam.title,
            slug: exam.slug,
            type: exam.category === 'stage2' ? 'شبیه‌ساز تخصصی مرحله ۲' : 'آزمون شبیه‌ساز',
            orderNumber: matchingOrder?.orderNumber || `ORD-${att.id.slice(0, 8).toUpperCase()}`,
            price: exam.price,
            payableAmount: matchingOrder?.payableAmount ?? exam.price,
            status: finalStatus,
            accessType: att.accessType === 'Open' ? 'آزاد' : 'رسمی (با رتبه)',
            purchasedAt: att.startedAt?.toISOString() || new Date().toISOString(),
            durationMinutes,
            totalQuestions: mockMatch?.totalQuestions || 60,
            campbellVolumes:
              exam.campbellVolumes && exam.campbellVolumes.length > 0
                ? exam.campbellVolumes
                : (mockMatch?.campbellVolumes || [1, 2]),
            startTime: exam.startTime?.toISOString() || mockMatch?.startTime,
            endTime: exam.endTime?.toISOString() || mockMatch?.endTime,
            remainingSeconds,
            isLiveActive,
            startedAt: att.startedAt?.toISOString(),
            submittedAt: att.submittedAt?.toISOString(),
            isSessionLocked: lockInfo.isLocked,
            lockedDeviceId: lockInfo.lockedDeviceId,
            lockedAt: lockInfo.lockedAt,
            lastHeartbeatAt: lockInfo.lastHeartbeatAt,
          });
        }

        // نمایش سفارش‌های موفقی که هنوز ردیف Attempt برای آنها در دیتابیس واکشی نشده است (فقط با تطابق دقیق بدون ماک تصادفی)
        for (const order of orders) {
          if (order.status !== 'paid') continue;
          const matchingLedger = ledgerEntries.find((l) => l.orderId === order.id);
          const matchedMock = MOCK_CATALOG_EXAMS.find(
            (m) =>
              matchingLedger &&
              (matchingLedger.description.includes(m.title) ||
                matchingLedger.description.includes(m.slug)),
          );

          if (matchedMock && !processedExamIds.has(matchedMock.id) && !processedExamIds.has(matchedMock.slug)) {
            processedExamIds.add(matchedMock.id);
            processedExamIds.add(matchedMock.slug);

            purchasedProducts.push({
              id: `ord_${order.id}`,
              title: matchedMock.title,
              slug: matchedMock.slug,
              type: matchedMock.category === 'stage2' ? 'شبیه‌ساز تخصصی مرحله ۲' : 'آزمون شبیه‌ساز',
              orderNumber: order.orderNumber,
              price: matchedMock.price,
              payableAmount: order.payableAmount,
              status: 'not_started',
              accessType: 'رسمی (با رتبه)',
              purchasedAt: order.createdAt.toISOString(),
              durationMinutes: matchedMock.durationMinutes,
              totalQuestions: matchedMock.totalQuestions,
              campbellVolumes: matchedMock.campbellVolumes,
              startTime: matchedMock.startTime,
              endTime: matchedMock.endTime,
              remainingSeconds: matchedMock.durationMinutes * 60,
              isLiveActive: false,
              isSessionLocked: false,
            });
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ خطای دریافت آزمون‌ها از جدول Attempts:', (e as Error).message);
    }

    return {
      user: {
        id: dbUser.id,
        email,
        role: dbUser.role || 'Student',
        status: dbUser.status || 'Active',
        createdAt: dbUser.createdAt,
        profile: {
          firstName: dbUser.profile?.firstName || '',
          lastName: dbUser.profile?.lastName || '',
          fullName: `${dbUser.profile?.firstName || ''} ${dbUser.profile?.lastName || ''}`.trim() || 'داوطلب المپیاد',
          phoneNumber: dbUser.profile?.phoneNumber || '',
          grade: dbUser.profile?.grade || '',
          school: dbUser.profile?.school || '',
          city: dbUser.profile?.city || '',
          telegramUsername: dbUser.profile?.telegramUsername || '',
        },
      },
      purchasedProducts,
      totalPurchases: purchasedProducts.length,
    };
  }

  /**
   * ویرایش مشخصات ثبت شده دانش‌آموز از پنل داشبورد
   */
  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    grade?: string;
    school?: string;
    city?: string;
  }) {
    const cleanData: any = {};
    if (data.firstName !== undefined) cleanData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) cleanData.lastName = data.lastName.trim();
    if (data.phoneNumber !== undefined) cleanData.phoneNumber = data.phoneNumber.trim();
    if (data.grade !== undefined) cleanData.grade = String(data.grade).trim();
    if (data.school !== undefined) cleanData.school = data.school.trim();
    if (data.city !== undefined) cleanData.city = data.city.trim();

    try {
      let dbUser: any = null;
      if (this.isUuid(userId)) {
        dbUser = await this.prisma.client.user.findUnique({ where: { id: userId } });
      }
      if (!dbUser) {
        dbUser = await this.prisma.client.user.findFirst({ orderBy: { createdAt: 'desc' } });
      }

      if (dbUser) {
        const updated = await this.prisma.client.profile.upsert({
          where: { userId: dbUser.id },
          update: cleanData,
          create: {
            userId: dbUser.id,
            firstName: cleanData.firstName || '',
            lastName: cleanData.lastName || '',
            phoneNumber: cleanData.phoneNumber || '',
            grade: cleanData.grade || '10',
            school: cleanData.school || '',
            city: cleanData.city || '',
          },
        });

        // به‌روزرسانی کش سشن در صورت وجود
        if (AuthService.inMemoryUsers.has(userId)) {
          const userMem = AuthService.inMemoryUsers.get(userId);
          userMem.profile = { ...userMem.profile, ...cleanData };
          AuthService.inMemoryUsers.set(userId, userMem);
        }

        return updated;
      }
    } catch (err) {
      console.warn('⚠️ خطای به‌روزرسانی پروفایل در دیتابیس:', (err as Error).message);
    }

    return cleanData;
  }
}
