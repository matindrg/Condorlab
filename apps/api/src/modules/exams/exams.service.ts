import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamStatus, ExamSummary } from '@condorlab/shared';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * نمونه‌های پیش‌فرض برای پایلوت ۱ و ۲ در صورت خالی بودن دیتابیس
   */
  private readonly mockExams: ExamSummary[] = [
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
      windowStartTime: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      windowEndTime: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
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
      windowStartTime: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      windowEndTime: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
      durationMinutes: 150,
      totalQuestions: 75,
      price: 180000,
      capacity: 200,
      isCapacityVisible: false, // پیش‌فرض: عدم نمایش عدد باقی‌مانده طبق توافق
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
      windowStartTime: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
      windowEndTime: new Date(Date.now() + 26 * 24 * 3600 * 1000).toISOString(),
      durationMinutes: 90,
      totalQuestions: 40,
      price: 220000,
      capacity: 150,
      isCapacityVisible: false,
      officialEnrolledCount: 42,
    },
    {
      id: 'exm-campbell-vip',
      slug: 'campbell-vip-masterclass',
      title: 'کارگاه فشرده المپیاد زیست‌شناسی (تک‌ظرفیتی VIP)',
      category: 'campbell',
      labels: ['کارگاه فشرده', 'تک‌ظرفیتی VIP'],
      campbellVolumes: [1],
      status: ExamStatus.Closed,
      startTime: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
      windowStartTime: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      windowEndTime: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
      durationMinutes: 90,
      totalQuestions: 60,
      price: 50000,
      capacity: 2,
      isCapacityVisible: true,
      officialEnrolledCount: 2,
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
      windowStartTime: new Date().toISOString(),
      windowEndTime: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      durationMinutes: 1,
      totalQuestions: 5,
      price: 0,
      capacity: 1000,
      isCapacityVisible: true,
      officialEnrolledCount: 12,
    },
  ];

  /**
   * بارگذاری لیست پایه‌ای آزمون‌ها مستقیماً از دیتابیس (بدون کش مانع، جهت نمایش آنی محصولات جدید در رفرش)
   */
  async getBaseExams(): Promise<ExamSummary[]> {
    try {
      const exams = await this.prisma.client.exam.findMany({
        where: {
          status: { in: ['Published', 'Active', 'Closed'] },
        },
        orderBy: { startTime: 'asc' },
      });

      if (exams && exams.length > 0) {
        return exams.map((e) => this.mapPrismaExam(e));
      }
    } catch (err) {
      console.warn('⚠️ ناتوانی در واکشی آزمون‌ها از دیتابیس ابری، استفاده از داده‌های پیش‌فرض:', (err as Error).message);
    }

    return this.mockExams;
  }

  /**
   * دریافت شناسه‌ها و اسلاگ‌های تمام آزمون‌های خریداری‌شده توسط کاربر با یک کوئری سریع
   */
  async getUserEnrolledExamIds(userId: string | undefined): Promise<string[]> {
    if (!userId) return [];
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
      if (!isUuid) return [];

      const attempts = await this.prisma.client.attempt.findMany({
        where: { userId },
        select: {
          examId: true,
          exam: {
            select: { id: true, slug: true },
          },
        },
      });

      const ids: string[] = [];
      attempts.forEach((att) => {
        if (att.examId) ids.push(att.examId);
        if (att.exam?.id) ids.push(att.exam.id);
        if (att.exam?.slug) ids.push(att.exam.slug);
      });
      return Array.from(new Set(ids));
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * بررسی آیا کاربر این آزمون را خریداری کرده یا خیر
   */
  async isUserEnrolled(userId: string | undefined, examId: string): Promise<boolean> {
    if (!userId || !examId) return false;
    try {
      const enrolled = await this.getUserEnrolledExamIds(userId);
      return enrolled.includes(examId);
    } catch {
      return false;
    }
  }

  /**
   * دریافت لیست آزمون‌های کاتالوگ با فیلتر دسته‌بندی، جلد کمپبل و جستجو (بهینه‌سازی شده بدون N+1)
   */
  async findAll(
    category?: string,
    volume?: number,
    search?: string,
    userId?: string,
  ): Promise<ExamSummary[]> {
    const baseExams = await this.getBaseExams();
    let filtered = [...baseExams];

    if (category && category !== 'all') {
      filtered = filtered.filter((e) => e.category === category);
    }
    if (volume) {
      filtered = filtered.filter(
        (e) => e.campbellVolumes && e.campbellVolumes.includes(Number(volume)),
      );
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(s) ||
          (e.labels && e.labels.some((l) => l.toLowerCase().includes(s))),
      );
    }

    if (userId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
      const enrolledIds = await this.getUserEnrolledExamIds(userId);
      const enrolledSet = new Set(enrolledIds);

      const attemptsMap = new Map<string, { id: string; status: string }>();

      if (isUuid) {
        try {
          const attempts = await this.prisma.client.attempt.findMany({
            where: { userId },
            select: { id: true, examId: true, status: true, exam: { select: { slug: true } } },
          });
          attempts.forEach((att) => {
            if (att.examId) attemptsMap.set(att.examId, { id: att.id, status: att.status });
            if (att.exam?.slug) attemptsMap.set(att.exam.slug, { id: att.id, status: att.status });
          });
        } catch {
          // ignore
        }
      }

      filtered = filtered.map((exam) => {
        const att = attemptsMap.get(exam.id) || (exam.slug ? attemptsMap.get(exam.slug) : undefined);
        const isUserEnrolled = enrolledSet.has(exam.id) || (exam.slug ? enrolledSet.has(exam.slug) : false) || Boolean(att);
        const attemptStatus = att?.status || (isUserEnrolled ? 'not_started' : null);

        return {
          ...exam,
          isEnrolled: isUserEnrolled,
          attemptStatus,
          attemptId: att?.id,
        };
      });
    }

    return filtered;
  }

  /**
   * دریافت جزئیات یک آزمون با اسلاگ یکتا و محاسبه وضعیت ظرفیت و ماشین وضعیت آزمون داوطلب
   */
  async findBySlug(
    slug: string,
    userId?: string,
  ): Promise<
    ExamSummary & {
      isCapacityFull: boolean;
      remainingSeats?: number;
      isEnrolled?: boolean;
      examState: 'UNENROLLED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
      attemptId?: string;
    }
  > {
    const baseExams = await this.getBaseExams();
    let exam = baseExams.find((e) => e.slug === slug || e.id === slug);

    if (!exam) {
      try {
        const dbExam = await this.prisma.client.exam.findUnique({
          where: { slug },
        });
        if (dbExam) {
          exam = this.mapPrismaExam(dbExam);
        }
      } catch {
        // استفاده از لیست پیش‌فرض
      }
    }

    if (!exam) {
      exam = this.mockExams.find((e) => e.slug === slug);
    }

    if (!exam) {
      throw new NotFoundException('آزمون مورد نظر یافت نشد.');
    }

    const isCapacityFull =
      exam.status === ExamStatus.Closed ||
      (exam.capacity ? exam.officialEnrolledCount >= exam.capacity : false);
    const remainingSeats = exam.capacity ? Math.max(0, exam.capacity - exam.officialEnrolledCount) : undefined;

    let isEnrolled = false;
    let examState: 'UNENROLLED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' = 'UNENROLLED';
    let attemptId: string | undefined = undefined;

    if (userId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
      const enrolledIds = await this.getUserEnrolledExamIds(userId);
      const enrolledSet = new Set(enrolledIds);
      isEnrolled = enrolledSet.has(exam.id) || (exam.slug ? enrolledSet.has(exam.slug) : false);

      if (isUuid) {
        try {
          const attempt = await this.prisma.client.attempt.findFirst({
            where: {
              userId,
              OR: [{ examId: exam.id }, { exam: { slug: exam.slug } }],
            },
            orderBy: { startedAt: 'desc' },
          });

          if (attempt) {
            attemptId = attempt.id;
            isEnrolled = true;

            const windowEndMs = exam.endTime ? new Date(exam.endTime).getTime() : Infinity;
            const now = Date.now();

            if (attempt.status === 'not_started') {
              if (now >= windowEndMs) {
                examState = 'EXPIRED' as any;
              } else {
                examState = 'NOT_STARTED';
              }
            } else if (attempt.status === 'in_progress') {
              const durationMinutes = exam.durationMinutes || 120;
              const startedAtMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : now;
              const userExpiryMs = startedAtMs + durationMinutes * 60 * 1000;
              const effectiveExpiryMs = Math.min(userExpiryMs, windowEndMs);
              const remainingSeconds = Math.max(0, Math.floor((effectiveExpiryMs - now) / 1000));
              if (remainingSeconds <= 0) {
                examState = 'SUBMITTED';
              } else {
                examState = 'IN_PROGRESS';
              }
            } else if (attempt.status === 'submitted') {
              if (attempt.scorePercentage !== null && attempt.scorePercentage !== undefined) {
                examState = 'GRADED';
              } else {
                examState = 'SUBMITTED';
              }
            } else if (attempt.status === 'expired') {
              examState = 'EXPIRED' as any;
            }
          } else if (isEnrolled) {
            examState = 'NOT_STARTED';
          }
        } catch {
          if (isEnrolled) examState = 'NOT_STARTED';
        }
      } else if (isEnrolled) {
        examState = 'NOT_STARTED';
      }
    }

    return {
      ...exam,
      isCapacityFull,
      remainingSeats: exam.isCapacityVisible ? remainingSeats : undefined,
      isEnrolled,
      examState,
      attemptId,
    };
  }

  private mapPrismaExam(e: any): ExamSummary {
    const isCapacityFull =
      e.status === 'Closed' ||
      (e.capacity ? e.officialEnrolledCount >= e.capacity : false);
    const remainingSeats = e.capacity ? Math.max(0, e.capacity - e.officialEnrolledCount) : undefined;

    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      category: e.category || 'campbell',
      labels: e.labels || [],
      campbellVolumes: e.campbellVolumes || [],
      status: e.status as ExamStatus,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      windowStartTime: e.startTime.toISOString(),
      windowEndTime: e.endTime.toISOString(),
      durationMinutes: e.durationMinutes,
      totalQuestions: 60,
      price: e.price,
      capacity: e.capacity || undefined,
      isCapacityVisible: e.isCapacityVisible,
      officialEnrolledCount: e.officialEnrolledCount,
      isCapacityFull,
      remainingSeats: e.isCapacityVisible ? remainingSeats : undefined,
    };
  }
}
