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
      campbellVolumes: [1, 2, 3, 4, 5],
      status: ExamStatus.Published,
      startTime: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
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

  /**
   * دریافت لیست آزمون‌های کاتالوگ با فیلتر جلد کمپبل و جستجو
   */
  async findAll(volume?: number, search?: string): Promise<ExamSummary[]> {
    try {
      const exams = await this.prisma.client.exam.findMany({
        where: {
          status: { in: ['Published', 'Active'] },
        },
        orderBy: { startTime: 'asc' },
      });

      if (exams && exams.length > 0) {
        return exams.map((e) => this.mapPrismaExam(e));
      }
    } catch {
      // استفاده از داده‌های پیش‌فرض در صورت عدم دسترسی به دیتابیس
    }

    let filtered = [...this.mockExams];
    if (volume) {
      filtered = filtered.filter((e) => e.campbellVolumes.includes(Number(volume)));
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((e) => e.title.toLowerCase().includes(s));
    }
    return filtered;
  }

  /**
   * دریافت جزئیات یک آزمون با اسلاگ یکتا و محاسبه وضعیت ظرفیت
   */
  async findBySlug(slug: string): Promise<ExamSummary & { isCapacityFull: boolean; remainingSeats?: number }> {
    let exam: ExamSummary | undefined;

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

    if (!exam) {
      exam = this.mockExams.find((e) => e.slug === slug);
    }

    if (!exam) {
      throw new NotFoundException('آزمون مورد نظر یافت نشد.');
    }

    const isCapacityFull = exam.capacity ? exam.officialEnrolledCount >= exam.capacity : false;
    const remainingSeats = exam.capacity ? Math.max(0, exam.capacity - exam.officialEnrolledCount) : undefined;

    return {
      ...exam,
      isCapacityFull,
      remainingSeats: exam.isCapacityVisible ? remainingSeats : undefined,
    };
  }

  private mapPrismaExam(e: any): ExamSummary {
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      campbellVolumes: [1, 2], // پیش‌فرض
      status: e.status as ExamStatus,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      durationMinutes: e.durationMinutes,
      totalQuestions: 60,
      price: e.price,
      capacity: e.capacity || undefined,
      isCapacityVisible: e.isCapacityVisible,
      officialEnrolledCount: e.officialEnrolledCount,
    };
  }
}
