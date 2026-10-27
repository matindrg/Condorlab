import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calculateMCQ4QuestionScore,
  calculateStage1QuestionScore,
  calculateStage2QuestionScore,
  calculateNumericQuestionScore,
} from '@condorlab/shared';
import { getQuestionsForExam, ExamQuestion } from '../exam-room/exam-questions.mock';

export interface QuestionGradingDetail {
  questionNumber: number;
  type: string;
  weight: number;
  subject: string;
  topic: string;
  campbellVolume?: number;
  campbellChapter?: number;
  score: number;
  status: 'correct' | 'wrong' | 'blank' | 'partial' | 'removed';
  userAnswer: any;
  correctAnswer: any;
  explanation?: string;
  isRemoved?: boolean;
  isDualAnswer?: boolean;
}

export interface TopicBreakdownItem {
  topic: string;
  subject: string;
  campbellVolume?: number;
  campbellChapter?: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  rawScore: number;
  maxScore: number;
  percentage: number;
  status: 'strong' | 'moderate' | 'weak';
}

export interface ReportCard {
  attemptId: string;
  examId: string;
  examSlug: string;
  examTitle: string;
  accessType: string;
  keyVersionNumber: number;
  submittedAt: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  officialRank?: number | null;
  totalOfficialParticipants?: number;
  summary: {
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    blankCount: number;
    partialCount: number;
    removedCount: number;
  };
  topicBreakdown: TopicBreakdownItem[];
  questions: QuestionGradingDetail[];
}

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  private isUuid(val: string): boolean {
    return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  }

  /**
   * تصحیح یک کارنامه/تلاش مشخص بر مبنای کلید و اصلاحات مصوب PRD
   */
  async gradeAttempt(attemptId: string): Promise<ReportCard> {
    let attempt: any = null;
    try {
      if (this.isUuid(attemptId)) {
        attempt = await this.prisma.client.attempt.findUnique({
          where: { id: attemptId },
          include: {
            answers: true,
            exam: true,
            user: { include: { profile: true } },
          },
        });
      }
    } catch (e) {
      // fallback
    }

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'تلاش آزمون مورد نظر یافت نشد.',
      });
    }

    const examId = attempt.examId;
    const examSlug = attempt.exam?.slug || attempt.examId;
    const examTitle = attempt.exam?.title || 'آزمون شبیه‌ساز المپیاد';
    const questions = getQuestionsForExam(examSlug);

    // دریافت اصلاحیه‌های کلید از دیتابیس در صورت وجود
    const keyAmendments = await this.getKeyAmendments(examId);

    // نگاشت پاسخ‌های دانش‌آموز بر اساس شماره سوال
    const userAnswersMap = new Map<number, any>();
    if (attempt.answers && Array.isArray(attempt.answers)) {
      attempt.answers.forEach((ans: any) => {
        userAnswersMap.set(ans.questionNumber, ans);
      });
    }

    let totalRawScore = 0;
    let totalMaxScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;
    let partialCount = 0;
    let removedCount = 0;

    const questionDetails: QuestionGradingDetail[] = [];
    const topicStatsMap = new Map<string, {
      subject: string;
      campbellVolume?: number;
      campbellChapter?: number;
      totalQuestions: number;
      correctCount: number;
      wrongCount: number;
      blankCount: number;
      rawScore: number;
      maxScore: number;
    }>();

    for (const q of questions) {
      const qNum = q.questionNumber;
      const weight = q.weight || 1;
      const subject = q.subject || 'زیست‌شناسی';
      const topic = q.topic || 'عمومی';
      const qType = q.type || 'mcq4';

      // بررسی اصلاحیه حذف سوال (الگوی ۱ در PRD ۵٫۳٫۱۶)
      const isQuestionRemoved = keyAmendments.removedQuestions.has(qNum);
      if (isQuestionRemoved) {
        removedCount++;
        questionDetails.push({
          questionNumber: qNum,
          type: qType,
          weight: 0,
          subject,
          topic,
          campbellVolume: q.chapter,
          campbellChapter: q.chapter,
          score: 0,
          status: 'removed',
          userAnswer: null,
          correctAnswer: null,
          isRemoved: true,
          explanation: 'این سؤال به دلیل اصلاح کلید پس از آزمون حذف شده و در محاسبه نمره لحاظ نگردیده است.',
        });
        continue;
      }

      totalMaxScore += weight;

      const userAns = userAnswersMap.get(qNum);
      let qScore = 0;
      let qStatus: 'correct' | 'wrong' | 'blank' | 'partial' = 'blank';
      let formattedUserAnswer: any = null;
      let formattedCorrectAnswer: any = null;

      if (qType === 'stage2_statements') {
        // گزاره‌ای ۵ تایی مرحله ۲ طبق PRD ۵٫۳٫۴
        const userStatements = userAns?.selectedStatements || null;
        const keyStatements = q.correctStatements || { 1: true, 2: false, 3: true, 4: false, 5: false };
        const removedStmts = keyAmendments.removedStatements.get(qNum) || [];
        const dualStmts = keyAmendments.dualAnswerStatements.get(qNum) || [];

        const res = calculateStage2QuestionScore(userStatements, keyStatements, weight, removedStmts, dualStmts);
        qScore = res.score;

        if (res.isAllBlank) {
          qStatus = 'blank';
          blankCount++;
        } else if (res.correctCount === (5 - removedStmts.length)) {
          qStatus = 'correct';
          correctCount++;
        } else if (res.correctCount > 0 && res.wrongCount > 0) {
          qStatus = 'partial';
          partialCount++;
        } else {
          qStatus = 'wrong';
          wrongCount++;
        }

        formattedUserAnswer = userStatements;
        formattedCorrectAnswer = keyStatements;
      } else if (qType === 'mcq5') {
        // ۵ گزینه‌ای مرحله ۱ المپیاد با نمره منفی ۰٫۲۵
        const selectedOpt = userAns?.selectedOption ?? null;
        const correctOpt = q.correctOption || 1;
        const res = calculateStage1QuestionScore(selectedOpt, correctOpt, weight, 0.25);
        qScore = res.score;
        qStatus = res.status;

        if (res.status === 'correct') correctCount++;
        else if (res.status === 'wrong') wrongCount++;
        else blankCount++;

        formattedUserAnswer = selectedOpt;
        formattedCorrectAnswer = correctOpt;
      } else if (qType === 'numeric') {
        // عددی دو رقمی
        const numericVal = userAns?.numericValue ?? null;
        const correctNum = q.correctNumber || 0;
        const res = calculateNumericQuestionScore(numericVal, correctNum, weight);
        qScore = res.score;
        qStatus = res.status;

        if (res.status === 'correct') correctCount++;
        else if (res.status === 'wrong') wrongCount++;
        else blankCount++;

        formattedUserAnswer = numericVal;
        formattedCorrectAnswer = correctNum;
      } else {
        // ۴ گزینه‌ای استاندارد کمپبل
        const selectedOpt = userAns?.selectedOption ?? null;
        const correctOpt = q.correctOption || 1;
        const res = calculateMCQ4QuestionScore(selectedOpt, correctOpt, weight, 0.25);
        qScore = res.score;
        qStatus = res.status;

        if (res.status === 'correct') correctCount++;
        else if (res.status === 'wrong') wrongCount++;
        else blankCount++;

        formattedUserAnswer = selectedOpt;
        formattedCorrectAnswer = correctOpt;
      }

      totalRawScore += qScore;

      questionDetails.push({
        questionNumber: qNum,
        type: qType,
        weight,
        subject,
        topic,
        campbellVolume: q.chapter,
        campbellChapter: q.chapter,
        score: Math.round(qScore * 100) / 100,
        status: qStatus,
        userAnswer: formattedUserAnswer,
        correctAnswer: formattedCorrectAnswer,
        explanation: q.explanation,
      });

      // تجمیع آمار مبحثی
      const topicKey = topic;
      const currentTopic = topicStatsMap.get(topicKey) || {
        subject,
        campbellVolume: q.chapter,
        campbellChapter: q.chapter,
        totalQuestions: 0,
        correctCount: 0,
        wrongCount: 0,
        blankCount: 0,
        rawScore: 0,
        maxScore: 0,
      };

      currentTopic.totalQuestions++;
      currentTopic.maxScore += weight;
      currentTopic.rawScore += qScore;
      if (qStatus === 'correct') currentTopic.correctCount++;
      else if (qStatus === 'wrong') currentTopic.wrongCount++;
      else if (qStatus === 'blank') currentTopic.blankCount++;

      topicStatsMap.set(topicKey, currentTopic);
    }

    // درصد کل با ۲ رقم اعشار و حفظ علامت منفی (PRD بخش ۵٫۳٫۴)
    const percentage = totalMaxScore > 0 ? Math.round((totalRawScore / totalMaxScore) * 10000) / 100 : 0;

    // به‌روزرسانی نمره تلاش در دیتابیس
    try {
      if (this.isUuid(attempt.id)) {
        await this.prisma.client.attempt.update({
          where: { id: attempt.id },
          data: { scorePercentage: percentage },
        });
      }
    } catch {
      // non-blocking
    }

    // ساخت شکست موضوعی (Topic Breakdown)
    const topicBreakdown: TopicBreakdownItem[] = Array.from(topicStatsMap.entries()).map(([tName, stats]) => {
      const topicPct = stats.maxScore > 0 ? Math.round((stats.rawScore / stats.maxScore) * 10000) / 100 : 0;
      let status: 'strong' | 'moderate' | 'weak' = 'moderate';
      if (topicPct >= 65) status = 'strong';
      else if (topicPct < 35) status = 'weak';

      return {
        topic: tName,
        subject: stats.subject,
        campbellVolume: stats.campbellVolume,
        campbellChapter: stats.campbellChapter,
        totalQuestions: stats.totalQuestions,
        correctCount: stats.correctCount,
        wrongCount: stats.wrongCount,
        blankCount: stats.blankCount,
        rawScore: Math.round(stats.rawScore * 100) / 100,
        maxScore: stats.maxScore,
        percentage: topicPct,
        status,
      };
    });

    return {
      attemptId: attempt.id,
      examId,
      examSlug,
      examTitle,
      accessType: attempt.accessType || 'Official',
      keyVersionNumber: keyAmendments.versionNumber,
      submittedAt: attempt.submittedAt?.toISOString() || new Date().toISOString(),
      rawScore: Math.round(totalRawScore * 100) / 100,
      maxScore: totalMaxScore,
      percentage,
      officialRank: attempt.officialRank,
      summary: {
        totalQuestions: questions.length,
        correctCount,
        wrongCount,
        blankCount,
        partialCount,
        removedCount,
      },
      topicBreakdown,
      questions: questionDetails,
    };
  }

  /**
   * تصحیح همگانی تمام تلاش‌های آزمون و محاسبه رتبه‌بندی رسمی (PRD ۵٫۳٫۹)
   */
  async gradeAllAttempts(examIdOrSlug: string) {
    const isUuid = this.isUuid(examIdOrSlug);
    let exam: any = null;
    try {
      exam = await this.prisma.client.exam.findFirst({
        where: isUuid
          ? { OR: [{ id: examIdOrSlug }, { slug: examIdOrSlug }] }
          : { slug: examIdOrSlug },
        include: {
          attempts: {
            where: { status: 'submitted' },
            include: { answers: true, user: { include: { profile: true } } },
          },
        },
      });
    } catch {
      // fallback
    }

    if (!exam) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EXAM_NOT_FOUND',
        message: 'آزمون مورد نظر یافت نشد.',
      });
    }

    const attempts = exam.attempts || [];
    const gradedAttempts: Array<{ attemptId: string; percentage: number; accessType: string }> = [];

    for (const att of attempts) {
      const report = await this.gradeAttempt(att.id);
      gradedAttempts.push({
        attemptId: att.id,
        percentage: report.percentage,
        accessType: att.accessType || 'Official',
      });
    }

    // رتبه‌بندی رسمی: فقط برای شرکت‌کنندگان رسمی بازه آزمون (PRD ۵٫۳٫۹)
    const officialAttempts = gradedAttempts
      .filter((a) => a.accessType === 'Official')
      .sort((a, b) => b.percentage - a.percentage);

    // اعمال رتبه‌های مشترک المپیاد (۱، ۲، ۲، ۴)
    let currentRank = 1;
    for (let i = 0; i < officialAttempts.length; i++) {
      if (i > 0 && officialAttempts[i].percentage < officialAttempts[i - 1].percentage) {
        currentRank = i + 1;
      }

      const attId = officialAttempts[i].attemptId;
      try {
        await this.prisma.client.attempt.update({
          where: { id: attId },
          data: { officialRank: currentRank },
        });
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      examId: exam.id,
      examTitle: exam.title,
      totalGraded: gradedAttempts.length,
      totalOfficial: officialAttempts.length,
      highestScore: officialAttempts.length > 0 ? officialAttempts[0].percentage : 0,
      lowestScore: officialAttempts.length > 0 ? officialAttempts[officialAttempts.length - 1].percentage : 0,
    };
  }

  /**
   * واکشی اصلاحات کلید آزمون
   */
  private async getKeyAmendments(examId: string) {
    const removedQuestions = new Set<number>();
    const removedStatements = new Map<number, number[]>();
    const dualAnswerStatements = new Map<number, number[]>();
    let versionNumber = 1;

    try {
      if (this.isUuid(examId)) {
        const latestKeyVersion = await this.prisma.client.keyVersion.findFirst({
          where: { examId, isCurrent: true },
          include: { amendments: true },
          orderBy: { versionNumber: 'desc' },
        });

        if (latestKeyVersion) {
          versionNumber = latestKeyVersion.versionNumber;
          latestKeyVersion.amendments.forEach((amend) => {
            if (amend.newOption === -1) {
              // حذف سوال
              removedQuestions.add(amend.questionNumber);
            }
          });
        }
      }
    } catch {
      // fallback
    }

    return {
      versionNumber,
      removedQuestions,
      removedStatements,
      dualAnswerStatements,
    };
  }
}
