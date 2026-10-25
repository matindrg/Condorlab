import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ExamRoomService } from './exam-room.service';
import { ExamLockService } from './exam-lock.service';

describe('ExamRoomService (Attempt lifecycle & guard checks)', () => {
  const mockRedisService = {
    getClient: () => null,
  } as any;

  const mockPrisma = {
    client: {
      exam: {
        findFirst: async () => ({
          id: 'exam_pilot_1',
          slug: 'campbell-pilot-1',
          title: 'شبیه‌ساز جامع جلد ۱ و ۲ بیولوژی کمپبل',
          durationMinutes: 120,
          price: 0,
        }),
      },
      user: {
        findUnique: async () => ({
          id: 'user_artin',
          profile: { firstName: 'آرتین', lastName: 'رضایی', grade: '10' },
        }),
        findFirst: async () => ({
          id: 'user_artin',
          profile: { firstName: 'آرتین', lastName: 'رضایی', grade: '10' },
        }),
      },
      attempt: {
        findFirst: async () => null,
        create: async (args: any) => ({
          id: 'att_pilot_artin',
          examId: args.data.examId,
          userId: args.data.userId,
          status: 'in_progress',
          takeoverCount: 0,
          startedAt: new Date(),
          answers: [],
        }),
        findUnique: async ({ where }: any) => {
          if (where.id === 'att_not_found') return null;
          if (where.id === 'att_submitted') {
            return {
              id: 'att_submitted',
              userId: 'user_artin',
              status: 'submitted',
              submittedAt: new Date(),
            };
          }
          return {
            id: where.id,
            userId: 'user_artin',
            status: 'in_progress',
            takeoverCount: 0,
            startedAt: new Date(),
          };
        },
        update: async ({ data }: any) => ({
          id: 'att_pilot_artin',
          ...data,
        }),
      },
      attemptAnswer: {
        findMany: async () => [
          { questionNumber: 1, selectedOption: 2, isFlagged: false },
          { questionNumber: 2, selectedOption: 3, isFlagged: true },
        ],
        upsert: async () => ({}),
      },
    },
  } as any;

  const examLock = new ExamLockService(mockRedisService);
  const examRoom = new ExamRoomService(mockPrisma, examLock);

  it('1. بارگذاری و ایجاد صندلی در initRoom', async () => {
    const res = await examRoom.initRoom('campbell-pilot-1', 'user_artin', 'sess_1', 'dev_1');
    assert.strictEqual(res.isSubmitted, false);
    assert.strictEqual(res.exam.slug, 'campbell-pilot-1');
    assert.strictEqual(res.studentInfo.name, 'آرتین رضایی');
    assert.ok(res.remainingSeconds > 0);
  });

  it('2. خطای 404 در صورت عدم وجود attemptId', async () => {
    try {
      await examRoom.startExam('att_not_found', 'user_artin', 'sess_1', 'dev_1');
      assert.fail('باید خطای 404 صادر می‌شد.');
    } catch (err: any) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.getResponse().code, 'ATTEMPT_NOT_FOUND');
    }
  });

  it('3. خطای 403 در صورت عدم تعلق آزمون به کاربر جاری', async () => {
    try {
      await examRoom.startExam('att_pilot_artin', 'foreign_user', 'sess_1', 'dev_1');
      assert.fail('باید خطای 403 عدم دسترسی صادر می‌شد.');
    } catch (err: any) {
      assert.strictEqual(err.status, 403);
    }
  });

  it('4. دریافت و استعلام وضعیت قفل (getLockState)', async () => {
    const state = await examRoom.getLockState('att_pilot_artin', 'user_artin', 'sess_1', 'dev_1');
    assert.ok(typeof state.locked === 'boolean');
    assert.strictEqual(state.remainingTakeovers, 2);
  });

  it('5. ثبت نهایی پاسخ‌برگ و دریافت خلاصه کارنامه (submitExam)', async () => {
    // ابتدا قفل را دریافت می‌کنیم تا مالک فعال باشیم
    await examRoom.startExam('att_pilot_artin', 'user_artin', 'sess_1', 'dev_1');

    const submitRes = await examRoom.submitExam(
      'att_pilot_artin',
      'user_artin',
      'sess_1',
      'dev_1',
      [{ questionNumber: 1, selectedOption: 2 }],
    );

    assert.strictEqual(submitRes.success, true);
    assert.strictEqual(submitRes.status, 'submitted');
    assert.strictEqual(submitRes.summary.answeredCount, 2);
  });
});
