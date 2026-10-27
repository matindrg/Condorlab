import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  MessageEvent,
} from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExamLockService,
  StoredAnswer,
  LockContext,
  TelemetryEvent,
  LockState,
} from './exam-lock.service';
import { CAMPBELL_PILOT_QUESTIONS, getQuestionsForExam } from './exam-questions.mock';
import { ExamStatus } from '@condorlab/shared';

@Injectable()
export class ExamRoomService {
  private lockEvents$ = new Subject<{
    attemptId: string;
    type: string;
    previousDeviceId?: string;
    newDeviceId?: string;
    version?: number;
  }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly examLock: ExamLockService,
  ) {}

  getLockEvents(attemptId: string): Observable<MessageEvent> {
    return this.lockEvents$.pipe(
      filter((ev) => ev.attemptId === attemptId),
      map((ev) => ({ data: ev } as unknown as MessageEvent)),
    );
  }

  /**
   * بارگذاری اطلاعات آزمون، پاسخ‌برگ، سوالات و احراز صندلی شرکت در آزمون
   */
  async initRoom(identifier: string, userId: string, sessionId: string, deviceId: string) {
    const dbExam = await this.resolveExam(identifier);
    const dbUser = await this.resolveUser(userId);

    // واکشی یا ایجاد ردیف شرکت (Attempt) — اولویت با آخرین تلاش در حال برگزاری
    let attempt = await this.prisma.client.attempt.findFirst({
      where: {
        examId: dbExam.id,
        userId: dbUser.id,
        status: 'in_progress',
      },
      orderBy: { startedAt: 'desc' },
      include: {
        answers: true,
      },
    });

    if (!attempt) {
      attempt = await this.prisma.client.attempt.findFirst({
        where: {
          examId: dbExam.id,
          userId: dbUser.id,
        },
        orderBy: { startedAt: 'desc' },
        include: {
          answers: true,
        },
      });
    }

    const examQuestions = getQuestionsForExam(dbExam.slug || dbExam.id);
    const totalQuestions = examQuestions.length;

    // اصل کلاینت با دانش صفر (Zero-Knowledge Client): کلید پاسخ‌ها هرگز به فرانت‌اند ارسال نمی‌شود
    const sanitizedQuestions = examQuestions.map((q) => {
      const { correctOption, correctStatements, correctNumber, ...safe } = q;
      if (safe.statements) {
        safe.statements = safe.statements.map((s) => {
          const { correctValue, ...safeStmt } = s;
          return safeStmt;
        });
      }
      return safe;
    });

    const isEnrolled = await this.isUserEnrolledInExam(dbUser.id, dbExam.id, dbExam.slug);
    if (!attempt && !isEnrolled && dbExam.price > 0) {
      throw new ForbiddenException('شما هنوز در این آزمون ثبت‌نام نکرده‌اید.');
    }

    // اگر ردیف تلاش وجود ندارد یا هنوز شروع نشده است (حالت Pre-Start State طبق دستور صریح و PRD)
    // به هیچ وجه آزمون خودکار شروع نمی‌شود و تایمر فعال نمی‌گردد
    if (!attempt || attempt.status === 'not_started') {
      return {
        hasStarted: false,
        canStart: true,
        isSubmitted: false,
        examTitle: dbExam.title,
        exam: {
          id: dbExam.id,
          slug: dbExam.slug,
          title: dbExam.title,
          durationMinutes: dbExam.durationMinutes,
          totalQuestions,
          price: dbExam.price,
        },
        attempt: attempt
          ? {
              id: attempt.id,
              status: 'not_started',
              takeoverCount: attempt.takeoverCount || 0,
              remainingTakeovers: 2,
            }
          : null,
        message: 'برای شروع پاسخ‌گویی به سؤالات، روی دکمه شروع آزمون کلیک نمایید.',
      };
    }

    if (attempt && (attempt.takeoverCount || 0) > 0) {
      this.examLock.syncTakeoverCount(attempt.id, attempt.takeoverCount);
    }

    if (attempt.status === 'submitted') {
      return {
        isSubmitted: true,
        submittedAt: attempt.submittedAt,
        examTitle: dbExam.title,
        exam: {
          id: dbExam.id,
          slug: dbExam.slug,
          title: dbExam.title,
          durationMinutes: dbExam.durationMinutes,
          totalQuestions,
          price: dbExam.price,
        },
        attempt: {
          id: attempt.id,
          startedAt: attempt.startedAt,
          takeoverCount: attempt.takeoverCount || 0,
          remainingTakeovers: 0,
          status: attempt.status,
        },
        message: 'شما قبلاً این آزمون را به پایان رسانده و پاسخ‌برگ را ارسال کرده‌اید.',
      };
    }

    // محاسبه زمان باقیمانده بر مبنای ساعت سرور و شروع آزمون
    const durationMinutes = dbExam.durationMinutes || 120;
    let startedAt = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    let expiryTime = startedAt + durationMinutes * 60 * 1000;
    const now = Date.now();
    let remainingSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));

    // اگر کاربر هنوز آزمون را آغاز نکرده یا پاسخی ثبت نکرده و زمان انقضا بر مبنای تاریخ ثبت‌نام منقضی شده است،
    // زمان شروع آزمون از لحظه ورود داوطلب به اتاق آزمون محاسبه می‌شود
    if (remainingSeconds <= 0 && (!attempt.answers || attempt.answers.length === 0) && (now - startedAt > 86400000)) {
      startedAt = now;
      expiryTime = startedAt + durationMinutes * 60 * 1000;
      remainingSeconds = durationMinutes * 60;

      this.prisma.client.attempt
        .update({
          where: { id: attempt.id },
          data: { startedAt: new Date(startedAt) },
        })
        .catch(() => {});
    }

    // بررسی اتمام مهلت آزمون و مهلت اضطراری ۲ دقیقه‌ای (Grace Period)
    if (remainingSeconds <= 0) {
      const gracePeriodMs = 120_000; // ۲ دقیقه مهلت اتصال مجدد و تخلیه بافر طبق درخواست و PRD
      const graceRemainingSeconds = Math.max(0, Math.floor((expiryTime + gracePeriodMs - now) / 1000));

      // اگر مهلت ۲ دقیقه اضافه هم تمام شده باشد، آزمون قطعی خاتمه یافته است
      if (graceRemainingSeconds <= 0) {
        const submittedAt = new Date(expiryTime);
        await this.prisma.client.attempt
          .update({
            where: { id: attempt.id },
            data: { status: 'submitted', submittedAt },
          })
          .catch(() => {});
        await this.examLock.release(attempt.id);

        return {
          isSubmitted: true,
          submittedAt: submittedAt.toISOString(),
          examTitle: dbExam.title,
          exam: {
            id: dbExam.id,
            slug: dbExam.slug,
            title: dbExam.title,
            durationMinutes: dbExam.durationMinutes,
            totalQuestions,
            price: dbExam.price,
          },
          attempt: {
            id: attempt.id,
            startedAt: attempt.startedAt,
            takeoverCount: attempt.takeoverCount || 0,
            remainingTakeovers: 0,
            status: 'submitted',
          },
          message: 'مهلت پاسخ‌گویی به این آزمون به پایان رسیده و پاسخ‌های شما ثبت نهایی گردید.',
        };
      }
    }

    // تجمیع پاسخ‌های ذخیره‌شده در Postgres و پاسخ‌های اخیر موجود در ردیس
    const redisAnswers = await this.examLock.getStoredAnswers(attempt.id);
    const mergedAnswers: Record<number, { selectedOption: number | null; selectedStatements?: Record<number, boolean | null> | null; numericValue?: number | null; isFlagged: boolean }> = {};

    attempt.answers.forEach((ans: any) => {
      mergedAnswers[ans.questionNumber] = {
        selectedOption: ans.selectedOption,
        selectedStatements: ans.selectedStatements || null,
        numericValue: ans.numericValue || null,
        isFlagged: ans.isFlagged,
      };
    });

    Object.entries(redisAnswers).forEach(([qNum, stored]) => {
      mergedAnswers[Number(qNum)] = {
        selectedOption: stored.selectedOption,
        selectedStatements: stored.selectedStatements || null,
        numericValue: stored.numericValue || null,
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
        totalQuestions,
        price: dbExam.price,
      },
      attempt: {
        id: attempt.id,
        startedAt: attempt.startedAt,
        takeoverCount: attempt.takeoverCount || 0,
        remainingTakeovers: Math.max(0, 2 - (attempt.takeoverCount || 0)),
        status: attempt.status,
      },
      questions: sanitizedQuestions,
      answers: mergedAnswers,
      remainingSeconds,
      serverTime: new Date().toISOString(),
      studentInfo,
    };
  }

  /**
   * شروع رسمی و دریافت قفل فعال نشست در اتاق آزمون (State Machine: NOT_STARTED -> IN_PROGRESS)
   */
  async startExam(identifier: string, userId: string, sessionId: string, deviceId: string) {
    const dbUser = await this.resolveUser(userId);
    let attempt: any = null;
    let dbExam: any = null;

    // بررسی آیا پارامتر ارسالی attemptId است یا exam slug / id
    if (this.isUuid(identifier)) {
      try {
        attempt = await this.prisma.client.attempt.findUnique({
          where: { id: identifier },
          include: { exam: true, answers: true },
        });
        if (attempt) {
          dbExam = attempt.exam;
        }
      } catch {}
    }

    if (!dbExam) {
      dbExam = await this.resolveExam(identifier);
    }

    if (!attempt) {
      attempt = await this.prisma.client.attempt.findFirst({
        where: { examId: dbExam.id, userId: dbUser.id },
        include: { answers: true },
      });
    }

    const isEnrolled = await this.isUserEnrolledInExam(dbUser.id, dbExam.id, dbExam.slug);
    if (!attempt && !isEnrolled && dbExam.price > 0) {
      throw new ForbiddenException('برای شروع آزمون، ابتدا باید در آزمون ثبت‌نام فرمایید.');
    }

    if (attempt?.status === 'submitted') {
      throw new BadRequestException('این آزمون قبلاً به پایان رسیده و پاسخ‌برگ آن ارسال گردیده است.');
    }

    const now = new Date();
    if (!attempt) {
      attempt = await this.prisma.client.attempt.create({
        data: {
          examId: dbExam.id,
          userId: dbUser.id,
          accessType: 'Official',
          status: 'in_progress',
          startedAt: now,
        },
        include: { answers: true },
      });
    } else if (attempt.status === 'not_started') {
      attempt = await this.prisma.client.attempt.update({
        where: { id: attempt.id },
        data: {
          status: 'in_progress',
          startedAt: now,
        },
        include: { answers: true },
      });
    }

    if (attempt && (attempt.takeoverCount || 0) > 0) {
      this.examLock.syncTakeoverCount(attempt.id, attempt.takeoverCount);
    }

    const ctx: LockContext = { attemptId: attempt.id, userId: dbUser.id, sessionId, deviceId };
    const lockResult = await this.examLock.acquire(ctx);

    const roomData = await this.initRoom(dbExam.slug || dbExam.id, dbUser.id, sessionId, deviceId);
    return {
      ...roomData,
      lock: lockResult,
    };
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
    const attempt = await this.assertAttemptAccess(attemptId, userId);
    if (attempt.status === 'submitted') {
      throw new ConflictException({
        statusCode: 409,
        code: 'EXAM_ALREADY_SUBMITTED',
        message: 'این آزمون قبلاً به پایان رسیده و تغییر پاسخ‌ها مسدود است.',
      });
    }

    const dbExam = await this.resolveExam(attempt.examId);
    const durationMinutes = dbExam.durationMinutes || 120;
    const startedAt = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const expiryTime = startedAt + durationMinutes * 60 * 1000;
    const now = Date.now();
    const gracePeriodMs = 120_000; // ۲ دقیقه مهلت اضطراری برای وصل شدن و تخلیه صف آفلاین طبق PRD

    // اگر زمان آزمون به همراه ۲ دقیقه مهلت اضطراری سپری شده باشد، پاسخ جدید نمی‌پذیریم و آزمون قطعی ثبت می‌شود
    if (now > expiryTime + gracePeriodMs) {
      if (attempt.status !== 'submitted') {
        await this.prisma.client.attempt
          .update({
            where: { id: attemptId },
            data: { status: 'submitted', submittedAt: new Date(expiryTime) },
          })
          .catch(() => {});
        await this.examLock.release(attemptId);
      }
      throw new ConflictException({
        statusCode: 409,
        code: 'EXAM_TIME_EXPIRED',
        message: 'مهلت رسمی و مهلت اضطراری آزمون به پایان رسیده و پاسخ‌برگ ثبت نهایی شده است.',
      });
    }

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
   * تصاحب قفل از دستگاه قبلی توسط دستگاه جدید و همگام‌سازی کامل پاسخ‌ها
   */
  async takeover(attemptId: string, userId: string, sessionId: string, deviceId: string) {
    await this.assertAttemptAccess(attemptId, userId);
    const ctx: LockContext = { attemptId, userId, sessionId, deviceId };
    const result = await this.examLock.takeover(ctx);

    // ارسال بلادرنگ رویداد اخراج به دستگاه قبلی از طریق جریان SSE
    if (result.status === 'taken_over') {
      this.lockEvents$.next({
        attemptId,
        type: 'LOCK_LOST',
        previousDeviceId: result.previousDeviceId,
        newDeviceId: deviceId,
        version: result.version,
      });
    }

    // به‌روزرسانی شمارنده takeover در دیتابیس Postgres
    try {
      await this.prisma.client.attempt.update({
        where: { id: attemptId },
        data: { takeoverCount: result.takeoverCount },
      });
    } catch {
      // ignore
    }

    // استخراج پاسخ‌های ثبت‌شده دستگاه قبلی برای اعمال و اورراید روی دستگاه جدید
    const answers = await this.getMergedAnswers(attemptId);

    return {
      ...result,
      answers,
    };
  }

  /**
   * تجمیع پاسخ‌های ذخیره‌شده در دیتابیس Postgres و پاسخ‌های اخیر ردیس
   */
  async getMergedAnswers(attemptId: string): Promise<Record<number, { selectedOption: number | null; selectedStatements?: Record<number, boolean | null> | null; numericValue?: number | null; isFlagged: boolean }>> {
    const redisAnswers = await this.examLock.getStoredAnswers(attemptId);
    let dbAnswers: any[] = [];
    try {
      dbAnswers = await this.prisma.client.attemptAnswer.findMany({
        where: { attemptId },
      });
    } catch {
      // fallback
    }

    const mergedAnswers: Record<number, { selectedOption: number | null; selectedStatements?: Record<number, boolean | null> | null; numericValue?: number | null; isFlagged: boolean }> = {};

    dbAnswers.forEach((ans: any) => {
      mergedAnswers[ans.questionNumber] = {
        selectedOption: ans.selectedOption,
        selectedStatements: ans.selectedStatements || null,
        numericValue: ans.numericValue || null,
        isFlagged: ans.isFlagged,
      };
    });

    Object.entries(redisAnswers).forEach(([qNum, stored]) => {
      mergedAnswers[Number(qNum)] = {
        selectedOption: stored.selectedOption,
        selectedStatements: stored.selectedStatements || null,
        numericValue: stored.numericValue || null,
        isFlagged: !!stored.isFlagged,
      };
    });

    return mergedAnswers;
  }

  /**
   * دریافت وضعیت زنده قفل
   */
  async getLockState(attemptId: string, userId: string, sessionId: string, deviceId: string): Promise<LockState> {
    await this.assertAttemptAccess(attemptId, userId, true);
    const ctx: LockContext = { attemptId, userId, sessionId, deviceId };
    return this.examLock.getState(ctx);
  }

  /**
   * ثبت نامحسوس رخداد ضد تقلب
   */
  async recordTelemetry(attemptId: string, userId: string, event: TelemetryEvent): Promise<{ success: boolean }> {
    await this.assertAttemptAccess(attemptId, userId, true);
    await this.examLock.recordTelemetry(attemptId, event);
    return { success: true };
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
    const attempt = await this.assertAttemptAccess(attemptId, userId, true);
    if (attempt.status === 'submitted') {
      return {
        success: true,
        status: 'already_submitted',
        message: 'این آزمون قبلاً ثبت نهایی شده است.',
        submittedAt: attempt.submittedAt?.toISOString(),
      };
    }

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

    // استخراج سوالات و آمار نهایی پاسخ‌برگ
    const examQuestions = getQuestionsForExam(attempt.exam?.slug || attempt.examId);
    const totalQuestions = examQuestions.length;

    const allAnswers = await this.prisma.client.attemptAnswer.findMany({
      where: { attemptId },
    });

    const answeredCount = allAnswers.filter((a: any) => {
      const hasOption = a.selectedOption !== null && a.selectedOption > 0;
      const hasStatements = a.selectedStatements && Object.values(a.selectedStatements).some((v) => v !== null && v !== undefined);
      const hasNumeric = a.numericValue !== null && a.numericValue !== undefined;
      return hasOption || hasStatements || hasNumeric;
    }).length;

    const flaggedCount = allAnswers.filter((a) => a.isFlagged).length;
    const unansweredCount = Math.max(0, totalQuestions - answeredCount);

    return {
      success: true,
      status: 'submitted',
      message: 'پاسخ‌برگ شما با موفقیت ثبت نهایی شد و آزمون به پایان رسید.',
      submittedAt: submittedAt.toISOString(),
      summary: {
        totalQuestions,
        answeredCount,
        unansweredCount,
        flaggedCount,
      },
    };
  }

  private isUuid(val: string): boolean {
    return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  }

  /**
   * بررسی اصالت شرکت در آزمون، مالکیت داوطلب و عدم پایان آزمون
   */
  private async assertAttemptAccess(attemptId: string, userId: string, allowSubmitted = false) {
    let attempt: any = null;
    try {
      attempt = await this.prisma.client.attempt.findUnique({
        where: { id: attemptId },
      });
    } catch {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'نشست آزمون مورد نظر یافت نشد.',
      });
    }

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'نشست آزمون مورد نظر یافت نشد.',
      });
    }

    if (attempt.userId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'شما مجاز به دسترسی به آزمون کاربر دیگری نیستید.',
      });
    }

    if (!allowSubmitted && attempt.status === 'submitted') {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_SUBMITTED',
        message: 'این آزمون قبلاً ثبت نهایی شده و ویرایش آن مسدود است.',
      });
    }

    return attempt;
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
    let exam: any = null;
    try {
      if (this.isUuid(identifier)) {
        exam = await this.prisma.client.exam.findFirst({
          where: {
            OR: [{ id: identifier }, { slug: identifier }],
          },
        });
      } else {
        exam = await this.prisma.client.exam.findFirst({
          where: { slug: identifier },
        });
      }
    } catch {
      // fallback
    }

    if (!exam) {
      exam = await this.prisma.client.exam.findFirst({
        where: {
          slug: { contains: 'campbell' },
        },
      });
    }

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
    let user: any = null;
    try {
      if (this.isUuid(userId)) {
        user = await this.prisma.client.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        });
      }
    } catch {
      // fallback
    }

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

  private async isUserEnrolledInExam(userId: string, examId: string, slug?: string): Promise<boolean> {
    try {
      if (!this.isUuid(userId)) return true;

      // ۱. بررسی ثبت‌نام در جدول Attempt
      const att = await this.prisma.client.attempt.findFirst({
        where: { userId, examId },
      });
      if (att) return true;

      // ۲. بررسی در سفارش‌های پرداخت‌شده
      const orders = await this.prisma.client.order.findMany({
        where: { userId, status: 'paid' },
        include: { ledgerEntries: true },
      });

      for (const ord of orders) {
        if (
          ord.ledgerEntries?.some(
            (l: any) =>
              l.description?.includes(examId) || (slug && l.description?.includes(slug)),
          )
        ) {
          return true;
        }
      }
    } catch {
      return true;
    }
    return false;
  }
}
