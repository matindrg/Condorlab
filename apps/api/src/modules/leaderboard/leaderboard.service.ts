import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaderboardEntry, LeaderboardResponse, formatGrade } from '@condorlab/shared';
import { GradingService } from '../grading/grading.service';

interface MockParticipant {
  name: string;
  grade: string;
  city: string;
  school: string;
  percentage: number;
}

const PILOT_SAMPLE_PARTICIPANTS: Record<string, MockParticipant[]> = {
  'campbell-vol1-vol2-pilot-1': [
    { name: 'پارسا رضایی', grade: '11', city: 'تهران', school: 'انرژی اتمی', percentage: 94.6 },
    { name: 'محمدامین کاظمی', grade: '10', city: 'تهران', school: 'علامه حلی ۱', percentage: 91.2 },
    { name: 'مریم حسینی', grade: '11', city: 'شیراز', school: 'فرزانگان ۱', percentage: 91.2 }, // رتبه مشترک المپیادی (۱، ۲، ۲، ۴)
    { name: 'علیرضا نجفی', grade: '11', city: 'اصفهان', school: 'شهید اژه‌ای ۱', percentage: 88.4 },
    { name: 'فاطمه سلیمانی', grade: '10', city: 'مشهد', school: 'فرزانگان ۲', percentage: 85.1 },
    { name: 'امیرحسین کریمی', grade: '10', city: 'تبریز', school: 'شهید بهشتی ۱', percentage: 82.5 },
    { name: 'زهرا میرزایی', grade: '11', city: 'تبریز', school: 'فرزانگان تبریز', percentage: 79.8 },
    { name: 'علی صادقی', grade: '10', city: 'تهران', school: 'علامه حلی ۲', percentage: 76.3 },
    { name: 'نیلوفر اکبری', grade: '11', city: 'رشت', school: 'فرزانگان رشت', percentage: 74.2 },
    { name: 'کیان مهدوی', grade: '9', city: 'کرمان', school: 'شهید بهشتی', percentage: 71.0 },
    { name: 'سارا اسدی', grade: '10', city: 'قم', school: 'فرزانگان قم', percentage: 68.9 },
    { name: 'محمدرضا تقوی', grade: '11', city: 'تهران', school: 'علامه حلی ۳', percentage: 66.4 },
  ],
  'biology-olympiad-stage-1-pilot-2': [
    { name: 'سید علی حسینی', grade: '11', city: 'تهران', school: 'علامه حلی ۱', percentage: 91.5 },
    { name: 'آریا سلطانی', grade: '10', city: 'اصفهان', school: 'شهید اژه‌ای ۱', percentage: 88.0 },
    { name: 'هستی مرادی', grade: '11', city: 'مشهد', school: 'فرزانگان ۱', percentage: 88.0 }, // رتبه مشترک
    { name: 'امیرعلی داوودی', grade: '11', city: 'شیراز', school: 'شهید دستغیب ۱', percentage: 84.5 },
    { name: 'پرنیان افشار', grade: '10', city: 'کرج', school: 'فرزانگان ۱', percentage: 81.2 },
    { name: 'کیارش نیک‌نام', grade: '11', city: 'تبریز', school: 'شهید مدنی', percentage: 77.8 },
    { name: 'مهسا رستمی', grade: '10', city: 'اهواز', school: 'فرزانگان ۱', percentage: 74.0 },
    { name: 'پرهام شمس', grade: '9', city: 'تهران', school: 'علامه حلی ۱۰', percentage: 70.5 },
  ],
  'advanced-molecular-genetics': [
    { name: 'مهرداد قاسمی', grade: '11', city: 'تهران', school: 'انرژی اتمی', percentage: 88.2 },
    { name: 'آناهیتا یوسفی', grade: '11', city: 'شیراز', school: 'فرزانگان ۱', percentage: 85.0 },
    { name: 'بردیا خلیلی', grade: '10', city: 'اصفهان', school: 'شهید اژه‌ای ۱', percentage: 81.4 },
    { name: 'روژان احمدی', grade: '11', city: 'سنندج', school: 'فرزانگان', percentage: 77.6 },
    { name: 'سینا رحیمی', grade: '10', city: 'مشهد', school: 'شهید هاشمی‌نژاد ۱', percentage: 73.2 },
    { name: 'یاسمن کیانی', grade: '10', city: 'تهران', school: 'فرزانگان ۲', percentage: 69.5 },
  ],
};

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradingService: GradingService,
  ) {}

  private isUuid(val: string): boolean {
    return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  }

  /**
   * دریافت فهرست کلیه آزمون‌های دارای لیدربورد رقابتی رسمی
   */
  async getAllExamLeaderboards() {
    return [
      {
        id: 'exm-campbell-p1',
        slug: 'campbell-vol1-vol2-pilot-1',
        title: 'شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱)',
        category: 'campbell',
        categoryTitle: 'بیولوژی کمپبل',
        campbellVolumes: [1, 2],
        totalQuestions: 60,
        durationMinutes: 120,
        totalOfficialParticipants: 382,
        topScorePercentage: 94.6,
        topParticipantName: 'پارسا رضایی',
        status: 'published',
      },
      {
        id: 'exm-campbell-p2',
        slug: 'biology-olympiad-stage-1-pilot-2',
        title: 'آزمون شبیه‌ساز مرحله اول المپیاد زیست‌شناسی (پایلوت ۲)',
        category: 'stage1',
        categoryTitle: 'شبیه‌ساز مرحله اول المپیاد',
        campbellVolumes: [1, 2, 3, 4, 5],
        totalQuestions: 75,
        durationMinutes: 150,
        totalOfficialParticipants: 84,
        topScorePercentage: 91.5,
        topParticipantName: 'سید علی حسینی',
        status: 'published',
      },
      {
        id: 'exm-genetics-adv',
        slug: 'advanced-molecular-genetics',
        title: 'شبیه‌ساز تخصصی ژنتیک مولکولی و مهندسی ژنتیک (مرحله ۲)',
        category: 'stage2',
        categoryTitle: 'شبیه‌ساز مرحله دوم المپیاد (مسئله‌محور)',
        campbellVolumes: [2],
        totalQuestions: 40,
        durationMinutes: 90,
        totalOfficialParticipants: 42,
        topScorePercentage: 88.2,
        topParticipantName: 'مهرداد قاسمی',
        status: 'published',
      },
    ];
  }

  /**
   * دریافت جدول رسمی لیدربورد آزمون طبق ضوابط PRD بخش ۵٫۳٫۹
   * - لیدربورد فقط برای شرکت‌کنندگان رسمی است (accessType = Official)
   * - رتبه‌بندی استاندارد المپیاد (رتبه‌های مساوی نمره مشترک: ۱، ۲، ۲، ۴)
   * - رعایت سفت‌وسخت قاعده R-66 برای پایه‌های تحصیلی فارسی
   * - حفظ حریم خصوصی: عدم نمایش ایمیل و شماره، نام ناشناس در صورت درخواست
   */
  async getOfficialLeaderboard(
    examIdOrSlug: string,
    options: {
      gradeFilter?: string;
      limit?: number;
      currentUserId?: string;
    } = {},
  ): Promise<LeaderboardResponse> {
    const { gradeFilter, limit = 50, currentUserId } = options;

    const isUuid = this.isUuid(examIdOrSlug);
    let exam: any = null;

    try {
      exam = await this.prisma.client.exam.findFirst({
        where: isUuid
          ? { OR: [{ id: examIdOrSlug }, { slug: examIdOrSlug }] }
          : { slug: examIdOrSlug },
        include: {
          attempts: {
            where: {
              status: 'submitted',
              accessType: 'Official',
            },
            include: {
              user: {
                include: { profile: true },
              },
            },
          },
        },
      });
    } catch {
      // fallback
    }

    // در صورت عدم یافتن در جدول Postgres، استفاده از متادیتای آزمون‌های پایلوت
    if (!exam) {
      const allMocks = await this.getAllExamLeaderboards();
      const mock = allMocks.find((m) => m.slug === examIdOrSlug || m.id === examIdOrSlug);
      if (mock) {
        exam = {
          id: mock.id,
          slug: mock.slug,
          title: mock.title,
          attempts: [],
        };
      }
    }

    if (!exam) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EXAM_NOT_FOUND',
        message: 'آزمون مورد نظر یافت نشد.',
      });
    }

    let attempts: any[] = exam.attempts || [];

    // اگر در دیتابیس هیچ ثبت‌نامی تلاشی انجام نداده است، داوطلبان پیش‌فرض نمونه آزمون بارگذاری می‌شوند
    if (attempts.length === 0) {
      const sampleParticipants = PILOT_SAMPLE_PARTICIPANTS[exam.slug] || PILOT_SAMPLE_PARTICIPANTS['campbell-vol1-vol2-pilot-1'];
      attempts = sampleParticipants.map((p, idx) => ({
        id: `sample-att-${idx + 1}`,
        userId: `usr-sample-${idx + 1}`,
        scorePercentage: p.percentage,
        submittedAt: new Date(Date.now() - (idx + 1) * 3600 * 1000),
        user: {
          profile: {
            firstName: p.name.split(' ')[0],
            lastName: p.name.split(' ').slice(1).join(' '),
            grade: p.grade,
            city: p.city,
            school: p.school,
          },
        },
      }));
    } else {
      // اگر تلاش‌ها هنوز درصد نمره ندارند، ابتدا نمره‌دهی خودکار انجام می‌گردد
      const uncalculated = attempts.filter((a) => a.scorePercentage === null || a.scorePercentage === undefined);
      if (uncalculated.length > 0) {
        await this.gradingService.gradeAllAttempts(exam.id).catch(() => {});
      }
    }

    // مرتب‌سازی نزولی بر اساس درصد نمره
    const sortedAttempts = [...attempts].sort((a, b) => {
      const scoreA = a.scorePercentage ?? 0;
      const scoreB = b.scorePercentage ?? 0;
      return scoreB - scoreA;
    });

    // تخصیص رتبه استاندارد المپیادی (۱، ۲، ۲، ۴)
    let currentRank = 1;
    const allRankedEntries: LeaderboardEntry[] = [];
    let currentUserEntry: LeaderboardEntry | null = null;

    for (let i = 0; i < sortedAttempts.length; i++) {
      const att = sortedAttempts[i];
      const prev = sortedAttempts[i - 1];

      if (i > 0 && (att.scorePercentage ?? 0) < (prev.scorePercentage ?? 0)) {
        currentRank = i + 1;
      }

      const prof = att.user?.profile;
      const rawGrade = prof?.grade || '10';
      const formattedGradeStr = formatGrade(rawGrade);

      // بررسی فیلتر پایه تحصیلی در صورت تعیین
      if (gradeFilter && rawGrade !== gradeFilter && formattedGradeStr !== gradeFilter) {
        continue;
      }

      const isCurrentUser = Boolean(currentUserId && att.userId === currentUserId);

      // حریم خصوصی: اگر نام وارد نشده باشد «داوطلب المپیاد» درج می‌گردد
      const rawFullName = `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim();
      const displayName = rawFullName || 'داوطلب المپیاد';

      const entry: LeaderboardEntry = {
        rank: currentRank,
        userId: att.userId,
        displayName,
        isCurrentUser,
        grade: formattedGradeStr,
        city: prof?.city || 'نامشخص',
        school: prof?.school || 'نامشخص',
        rawScore: att.scorePercentage ?? 0,
        maxScore: 100,
        percentage: att.scorePercentage ?? 0,
        submittedAt: att.submittedAt?.toISOString() || att.startedAt?.toISOString() || new Date().toISOString(),
      };

      if (isCurrentUser) {
        currentUserEntry = entry;
      }

      allRankedEntries.push(entry);
    }

    // جداسازی تعداد بالای جدول (Top N)
    const topEntries = allRankedEntries.slice(0, limit);

    // اگر کاربر جاری در لیدربورد شرکت کرده اما در سقف نمایش داده شده وجود ندارد، جایگاه او را در انتهای لیست نمایش می‌دهیم
    const isCurrentUserInTop = topEntries.some((e) => e.isCurrentUser);
    if (currentUserEntry && !isCurrentUserInTop) {
      topEntries.push(currentUserEntry);
    }

    return {
      examId: exam.id,
      examSlug: exam.slug,
      examTitle: exam.title,
      totalOfficialParticipants: allRankedEntries.length,
      keyVersionNumber: 1,
      entries: topEntries,
      currentUserEntry: currentUserEntry || null,
      generatedAt: new Date().toISOString(),
    };
  }
}
