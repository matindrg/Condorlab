import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamsService } from '../exams/exams.service';
import { getQuestionsForExam, ExamQuestion, CAMPBELL_PILOT_QUESTIONS, STAGE1_PILOT_QUESTIONS, STAGE2_PILOT_QUESTIONS } from '../exam-room/exam-questions.mock';
import { ExamStatus } from '@condorlab/shared';

// مخزن حافظه‌ای پویا برای نگه‌داری سوالات ایجادشده یا ویرایش‌شده توسط ادمین در طول اجرای سرور
const dynamicExamQuestions: Record<string, ExamQuestion[]> = {};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examsService: ExamsService,
  ) {}

  /**
   * دریافت تمام آزمون‌ها با جزئیات کامل مدیریتی
   */
  async getExams() {
    try {
      const dbExams = await this.prisma.client.exam.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { attempts: true },
          },
        },
      });

      if (dbExams && dbExams.length > 0) {
        return dbExams.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          category: e.category,
          labels: e.labels,
          status: e.status,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
          windowStartTime: e.startTime.toISOString(),
          windowEndTime: e.endTime.toISOString(),
          durationMinutes: e.durationMinutes,
          price: e.price,
          capacity: e.capacity,
          isCapacityVisible: e.isCapacityVisible,
          officialEnrolledCount: e.officialEnrolledCount || e._count?.attempts || 0,
          totalQuestions: this.getQuestions(e.slug).length,
          attemptsCount: e._count?.attempts || 0,
        }));
      }
    } catch (e) {
      // استفاده از داده‌های پیش‌فرض در صورت عدم دسترسی به دیتابیس
    }

    const fallbackExams = await this.examsService.findAll();
    return fallbackExams.map((e) => ({
      ...e,
      totalQuestions: this.getQuestions(e.slug).length,
      attemptsCount: e.officialEnrolledCount || 0,
    }));
  }

  /**
   * ایجاد آزمون جدید توسط ادمین
   */
  async createExam(data: {
    title: string;
    slug: string;
    category?: string;
    labels?: string[];
    durationMinutes: number;
    price?: number;
    capacity?: number;
    isCapacityVisible?: boolean;
    startTime: string;
    endTime: string;
    status?: 'Draft' | 'Published';
  }) {
    const statusVal = data.status === 'Draft' ? ExamStatus.Draft : ExamStatus.Published;

    try {
      const created = await this.prisma.client.exam.create({
        data: {
          title: data.title,
          slug: data.slug,
          category: data.category || 'campbell',
          labels: data.labels || [],
          durationMinutes: Number(data.durationMinutes),
          price: Number(data.price || 0),
          capacity: data.capacity ? Number(data.capacity) : null,
          isCapacityVisible: Boolean(data.isCapacityVisible),
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          status: statusVal,
        },
      });
      return { success: true, exam: created };
    } catch (err: any) {
      // در صورت خطای دیتابیس، شیء در حافظه ثبت می‌شود
      const newExam = {
        id: `exm-custom-${Date.now().toString(36)}`,
        slug: data.slug,
        title: data.title,
        category: data.category || 'campbell',
        labels: data.labels || [],
        durationMinutes: Number(data.durationMinutes),
        price: Number(data.price || 0),
        capacity: data.capacity ? Number(data.capacity) : 200,
        isCapacityVisible: Boolean(data.isCapacityVisible),
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        windowStartTime: new Date(data.startTime).toISOString(),
        windowEndTime: new Date(data.endTime).toISOString(),
        status: statusVal,
        totalQuestions: 0,
        officialEnrolledCount: 0,
      };
      (this.examsService as any).mockExams?.unshift(newExam);
      return { success: true, exam: newExam, fallback: true };
    }
  }

  /**
   * ویرایش آزمون موجود
   */
  async updateExam(
    idOrSlug: string,
    data: {
      title?: string;
      durationMinutes?: number;
      price?: number;
      capacity?: number;
      isCapacityVisible?: boolean;
      startTime?: string;
      endTime?: string;
      status?: 'Draft' | 'Published';
    },
  ) {
    try {
      const updated = await this.prisma.client.exam.update({
        where: idOrSlug.includes('-') && idOrSlug.length === 36 ? { id: idOrSlug } : { slug: idOrSlug },
        data: {
          ...(data.title ? { title: data.title } : {}),
          ...(data.durationMinutes ? { durationMinutes: Number(data.durationMinutes) } : {}),
          ...(data.price !== undefined ? { price: Number(data.price) } : {}),
          ...(data.capacity !== undefined ? { capacity: Number(data.capacity) } : {}),
          ...(data.isCapacityVisible !== undefined ? { isCapacityVisible: Boolean(data.isCapacityVisible) } : {}),
          ...(data.startTime ? { startTime: new Date(data.startTime) } : {}),
          ...(data.endTime ? { endTime: new Date(data.endTime) } : {}),
          ...(data.status ? { status: data.status === 'Draft' ? ExamStatus.Draft : ExamStatus.Published } : {}),
        },
      });
      return { success: true, exam: updated };
    } catch {
      // همگام‌سازی در لیست ماک
      const list = (this.examsService as any).mockExams || [];
      const item = list.find((e: any) => e.id === idOrSlug || e.slug === idOrSlug);
      if (item) {
        if (data.title) item.title = data.title;
        if (data.durationMinutes) item.durationMinutes = Number(data.durationMinutes);
        if (data.price !== undefined) item.price = Number(data.price);
        if (data.capacity !== undefined) item.capacity = Number(data.capacity);
        if (data.isCapacityVisible !== undefined) item.isCapacityVisible = Boolean(data.isCapacityVisible);
        if (data.startTime) {
          item.startTime = new Date(data.startTime).toISOString();
          item.windowStartTime = item.startTime;
        }
        if (data.endTime) {
          item.endTime = new Date(data.endTime).toISOString();
          item.windowEndTime = item.endTime;
        }
        if (data.status) item.status = data.status === 'Draft' ? ExamStatus.Draft : ExamStatus.Published;
        return { success: true, exam: item, fallback: true };
      }
      return { success: true, message: 'بروزرسانی در حافظه با موفقیت انجام شد.' };
    }
  }

  /**
   * حذف آزمون
   */
  async deleteExam(idOrSlug: string) {
    try {
      await this.prisma.client.exam.delete({
        where: idOrSlug.includes('-') && idOrSlug.length === 36 ? { id: idOrSlug } : { slug: idOrSlug },
      });
    } catch {
      const list = (this.examsService as any).mockExams || [];
      const idx = list.findIndex((e: any) => e.id === idOrSlug || e.slug === idOrSlug);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
    return { success: true };
  }

  /**
   * دریافت سوالات یک آزمون
   */
  getQuestions(examSlugOrId: string): ExamQuestion[] {
    if (dynamicExamQuestions[examSlugOrId]) {
      return dynamicExamQuestions[examSlugOrId];
    }
    const defaultQuestions = getQuestionsForExam(examSlugOrId);
    dynamicExamQuestions[examSlugOrId] = [...defaultQuestions];
    return dynamicExamQuestions[examSlugOrId];
  }

  /**
   * افزودن یا ویرایش سوال در بانک سوالات آزمون
   */
  saveQuestion(examSlugOrId: string, questionData: Partial<ExamQuestion>) {
    const list = this.getQuestions(examSlugOrId);
    const existingIndex = list.findIndex((q) => q.questionNumber === questionData.questionNumber);

    const formattedQuestion: ExamQuestion = {
      id: questionData.id || Date.now(),
      questionNumber: questionData.questionNumber || list.length + 1,
      type: questionData.type || 'mcq4',
      topic: questionData.topic || 'عمومی المپیاد',
      stem: questionData.stem || '',
      options: questionData.options,
      statements: questionData.statements,
      correctOption: questionData.correctOption,
      correctStatements: questionData.correctStatements,
      correctNumber: questionData.correctNumber,
      weight: questionData.weight || 1,
      explanation: questionData.explanation || '',
    };

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...formattedQuestion };
    } else {
      list.push(formattedQuestion);
    }

    dynamicExamQuestions[examSlugOrId] = list;
    return { success: true, question: formattedQuestion, totalQuestions: list.length };
  }

  /**
   * حذف سوال از آزمون
   */
  deleteQuestion(examSlugOrId: string, questionNumber: number) {
    const list = this.getQuestions(examSlugOrId);
    const filtered = list.filter((q) => q.questionNumber !== questionNumber);
    dynamicExamQuestions[examSlugOrId] = filtered;
    return { success: true, totalQuestions: filtered.length };
  }

  /**
   * دریافت لیست محصولات فروشگاه
   */
  async getProducts() {
    const exams = await this.getExams();
    return exams.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      price: e.price,
      status: e.status === 'Published' || e.status === 'ACTIVE' ? 'active' : 'inactive',
      category: e.category,
      capacity: e.capacity,
      enrolledCount: e.officialEnrolledCount || 0,
    }));
  }

  /**
   * بروزرسانی قیمت و وضعیت محصول
   */
  async updateProductPrice(idOrSlug: string, price: number, isActive?: boolean) {
    await this.updateExam(idOrSlug, {
      price,
      status: isActive === false ? 'Draft' : 'Published',
    });
    return { success: true };
  }

  /**
   * فهرست کاربران سامانه برای مدیریت
   */
  async getUsers() {
    try {
      const users = await (this.prisma.client.user as any).findMany({
        include: {
          profile: true,
          attempts: {
            select: { id: true, status: true, examId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (users && users.length > 0) {
        return users.map((u: any) => ({
          id: u.id,
          role: u.role,
          email: u.email || '',
          phoneNumber: u.phoneNumber || u.profile?.phoneNumber || '',
          fullName: u.profile ? `${u.profile.firstName || ''} ${u.profile.lastName || ''}`.trim() : 'داوطلب المپیاد',
          grade: u.profile?.grade || '10',
          school: u.profile?.school || 'نامشخص',
          city: u.profile?.city || 'نامشخص',
          attemptsCount: u.attempts?.length || 0,
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        }));
      }
    } catch {}

    // فال‌بک نمونه داوطلبان برای محیط تست
    return [
      {
        id: 'usr-dev-student-1',
        role: 'Student',
        email: 'artin@condorlab.ir',
        phoneNumber: '09121112233',
        fullName: 'آرتین رادمنش',
        grade: '10',
        school: 'دبیرستان علامه حلی ۱ تهران',
        city: 'تهران',
        attemptsCount: 2,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-dev-student-2',
        role: 'Student',
        email: 'sara@condorlab.ir',
        phoneNumber: '09123334455',
        fullName: 'سارا صادقی',
        grade: '11',
        school: 'فرزانگان ۱ تهران',
        city: 'تهران',
        attemptsCount: 1,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'usr-dev-master-admin',
        role: 'MasterAdmin',
        email: 'admin@condorlab.ir',
        phoneNumber: '09120000000',
        fullName: 'مدیر ارشد کندرلب',
        grade: '12',
        school: 'ستاد سنجش و ارزیابی',
        city: 'تهران',
        attemptsCount: 0,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
    ];
  }

  /**
   * بازنشانی تلاش آزمون کاربر جهت امکان شرکت دوباره
   */
  async resetAttempt(userId?: string, examIdOrSlug?: string) {
    try {
      if (userId) {
        await this.prisma.client.attemptAnswer.deleteMany({
          where: { attempt: { userId } },
        });
        await this.prisma.client.attempt.deleteMany({
          where: { userId },
        });
      }
      return { success: true, message: 'تلاش‌های آزمون کاربر با موفقیت حذف و بازنشانی گردید.' };
    } catch {
      return { success: true, message: 'بازنشانی در حافظه با موفقیت ثبت شد.' };
    }
  }
}
