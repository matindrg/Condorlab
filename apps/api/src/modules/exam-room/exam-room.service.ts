import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamLockService, StoredAnswer, LockContext } from './exam-lock.service';
import { CAMPBELL_PILOT_QUESTIONS } from './exam-questions.mock';
import { ExamStatus } from '@condorlab/shared';

@Injectable()
export class ExamRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examLock: ExamLockService,
  ) {}

  /**
   * بارگذاری اطلاعات آزمون، پاسخ‌برگ، سوالات و احراز صندلی شرکت در آزمون
   */
  async initRoom(identifier: string, userId: string, sessionId: string, deviceId: string) {
    const dbExam = await this.resolveExam(identifier);
    const dbUser = await this.resolveUser(userId);

    // واکشی یا ایجاد ردیف شرکت (Attempt)
    let attempt = await this.prisma.client.attempt.findFirst({
      where: {
        examId: dbExam.id,
        userId: dbUser.id,
      },
      include: {
        answers: true,
      },
    });

    if (!attempt) {
      // اگر کاربر قبلاً ثبت‌نام کرده یا آزمون پایلوت رایگان است، صندلی شرکت ایجاد می‌شود
      attempt = await this.prisma.client.attempt.create({
        data: {
          examId: dbExam.id,
          userId: dbUser.id,
          accessType: 'Official',
          status: 'in_progress',
          startedAt: new Date(),
        },
        include: {
          answers: true,
        },
      });
    }

    if (attempt.status === 'submitted') {
      return {
        isSubmitted: true,
        submittedAt: attempt.submittedAt,
        examTitle: dbExam.title,
        message: 'شما قبلاً این آزمون را به پایان رسانده و پاسخ‌برگ را ارسال کرده‌اید.',
      };
    }

    // محاسبه زمان باقیمانده بر مبنای ساعت سرور و شروع آزمون
    const durationMinutes = dbExam.durationMinutes || 120;
    const startedAt = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const expiryTime = startedAt + durationMinutes * 60 * 1000;
    const remainingSeconds = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));

    // تجمیع پاسخ‌های ذخیره‌شده در Postgres و پاسخ‌های اخیر موجود در ردیس
    const redisAnswers = await this.examLock.getStoredAnswers(attempt.id);
    const mergedAnswers: Record<number, { selectedOption: number | null; isFlagged: boolean }> = {};

    attempt.answers.forEach((ans) => {
      mergedAnswers[ans.questionNumber] = {
        selectedOption: ans.selectedOption,
        isFlagged: ans.isFlagged,
      };
    });

    Object.entries(redisAnswers).forEach(([qNum, stored]) => {
      mergedAnswers[Number(qNum)] = {
        selectedOption: stored.selectedOption,
        isFlagged: !!stored.isFlagged,
      };
    });

    // اطلاعات دانش‌آموز برای واترمارک امنیتی ضد نشت
    const studentInfo = {
      name: `${dbUser.profile?.firstName || 'دانش‌آموز'} ${dbUser.profile?.lastName || ''}`.trim(),
      grade: dbUser.profile?.grade || 'المپیاد',
      userId: dbUser.id,
    };

    return {
      isSubmitted: false,
      exam: {
        id: dbExam.id,
        slug: dbExam.slug,
        title: dbExam.title,
        durationMinutes,
        totalQuestions: CAMPBELL_PILOT_QUESTIONS.length,
        price: dbExam.price,
      },
      attempt: {
        id: attempt.id,
        startedAt: attempt.startedAt,
        takeoverCount: attempt.takeoverCount,
        status: attempt.status,
      },
      questions: CAMPBELL_PILOT_QUESTIONS,
      answers: mergedAnswers,
      remainingSeconds,
      serverTime: new Date().toISOString(),
      studentInfo,
    };
  }

  /**
   * شروع رسمی و دریافت قفل فعال نشست در اتاق آزمون
   */
  async startExam(attemptId: string, userId: string, sessionId: string, deviceId: string) {
    const ctx: LockContext = { attemptId, userId, sessionId, deviceId };
    return this.examLock.acquire(ctx);
  }

  /**
   * پردازش ضربان ۳۰ ثانیه‌ای و همگام‌سازی دسته‌ای پاسخ‌ها
   */
  async heartbeat(
    attemptId: string,
    userId: string,
    sessionId: string,
    deviceId: string,
    clientSeq: number,
    answers: StoredAnswer[] = [],
  ) {
    const ctx: LockContext = { attemptId, userId, sessionId, deviceId };
    const result = await this.examLock.heartbeat(ctx, clientSeq, answers);

    // ثبت غیرهم‌زمان و اتمیک پاسخ‌ها در دیتابیس Postgres
    if (answers && answers.length > 0) {
      this.persistAnswers(attemptId, answers).catch((err) => {
        console.warn('⚠️ Non-blocking error persisting answers to Postgres:', err.message);
      });
    }

    return result;
  }

  /**
   * تصاحب قفل از دستگاه قبلی توسط دستگاه جدید
   */
  async takeover(attemptId: string, userId: string, sessionId: string, deviceId: string) {
    const ctx: LockContext = { attemptId, userId, sessionId, deviceId };
    const result = await this.examLock.takeover(ctx);

    // به‌روزرسانی شمارنده takeover در دیتابیس
    try {
      await this.prisma.client.attempt.update({
        where: { id: attemptId },
        data: { takeoverCount: result.takeoverCount },
      });
    } catch {
      // ignore
    }

    return result;
  }

  /**
   * ثبت نهایی پاسخ‌برگ و اتمام قطعی آزمون
   */
  async submitExam(
    attemptId: string,
    userId: string,
    sessionId: string,
    deviceId: string,
    answers: StoredAnswer[] = [],
  ) {
    const ctx: LockContext = { attemptId, userId, sessionId, deviceId };
    await this.examLock.assertOwner(ctx);

    if (answers && answers.length > 0) {
      await this.persistAnswers(attemptId, answers);
    }

    const submittedAt = new Date();
    await this.prisma.client.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'submitted',
        submittedAt,
      },
    });

    // آزادسازی قفل ردیس
    await this.examLock.release(ctx);

    // آمار نهایی پاسخ‌برگ
    const allAnswers = await this.prisma.client.attemptAnswer.findMany({
      where: { attemptId },
    });

    const answeredCount = allAnswers.filter((a) => a.selectedOption !== null && a.selectedOption > 0).length;
    const flaggedCount = allAnswers.filter((a) => a.isFlagged).length;
    const unansweredCount = CAMPBELL_PILOT_QUESTIONS.length - answeredCount;

    return {
      success: true,
      message: 'پاسخ‌برگ شما با موفقیت ثبت نهایی شد و آزمون به پایان رسید.',
      submittedAt: submittedAt.toISOString(),
      summary: {
        totalQuestions: CAMPBELL_PILOT_QUESTIONS.length,
        answeredCount,
        unansweredCount,
        flaggedCount,
      },
    };
  }

  /**
   * ثبت پاسخ‌ها در جدول AttemptAnswer
   */
  private async persistAnswers(attemptId: string, answers: StoredAnswer[]) {
    for (const ans of answers) {
      if (!ans || typeof ans.questionNumber !== 'number') continue;
      try {
        await this.prisma.client.attemptAnswer.upsert({
          where: {
            attemptId_questionNumber: {
              attemptId,
              questionNumber: ans.questionNumber,
            },
          },
          create: {
            attemptId,
            questionNumber: ans.questionNumber,
            selectedOption: ans.selectedOption || null,
            isFlagged: !!ans.isFlagged,
            answeredAt: ans.answeredAt ? new Date(ans.answeredAt) : new Date(),
          },
          update: {
            selectedOption: ans.selectedOption || null,
            isFlagged: !!ans.isFlagged,
            answeredAt: ans.answeredAt ? new Date(ans.answeredAt) : new Date(),
          },
        });
      } catch (e) {
        // ignore
      }
    }
  }

  private async resolveExam(identifier: string) {
    let exam = await this.prisma.client.exam.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
    });

    if (!exam) {
      // ساخت پیش‌فرض برای پایلوت ۱ در صورت عدم وجود
      exam = await this.prisma.client.exam.create({
        data: {
          slug: identifier.includes('campbell') ? identifier : 'campbell-vol1-vol2-pilot-1',
          title: 'شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل (پایلوت ۱)',
          status: ExamStatus.Published,
          startTime: new Date(Date.now() - 3600 * 1000),
          endTime: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          durationMinutes: 120,
          price: 0,
          capacity: 500,
          isCapacityVisible: true,
          officialEnrolledCount: 382,
        },
      });
    }

    return exam;
  }

  private async resolveUser(userId: string) {
    let user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.client.user.findFirst({
        include: { profile: true },
      });
    }

    if (!user) {
      user = await this.prisma.client.user.create({
        data: {
          profile: {
            create: {
              firstName: 'آرتین',
              lastName: 'رضایی',
              grade: '10',
              city: 'تهران',
              school: 'علامه حلی',
            },
          },
        },
        include: { profile: true },
      });
    }

    return user;
  }
}
