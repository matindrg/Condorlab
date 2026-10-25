import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ExamLockService,
  LockContext,
  StoredAnswer,
  TelemetryEvent,
} from './exam-lock.service';

describe('ExamLockService (In-Memory Fallback & Concurrency Engine)', () => {
  // شبیه‌ساز ماک برای RedisService در حالت قطع ردیس (استفاده از فال‌بک پایدار درون حافظه)
  const mockRedisService = {
    getClient: () => null,
  } as any;

  const service = new ExamLockService(mockRedisService);

  const attemptId = `test_att_${Date.now()}`;
  const userId = 'user_student_1';
  const deviceA = 'dev_laptop_chrome';
  const deviceB = 'dev_mobile_safari';
  const deviceC = 'dev_tablet_firefox';

  const ctxA: LockContext = {
    attemptId,
    userId,
    sessionId: 'sess_1',
    deviceId: deviceA,
  };

  const ctxB: LockContext = {
    attemptId,
    userId,
    sessionId: 'sess_2',
    deviceId: deviceB,
  };

  const ctxC: LockContext = {
    attemptId,
    userId,
    sessionId: 'sess_3',
    deviceId: deviceC,
  };

  it('1. دستگاه A باید بتواند قفل اولیه را دریافت کند (status: acquired)', async () => {
    const res = await service.acquire(ctxA);
    assert.strictEqual(res.status, 'acquired');
    assert.strictEqual(res.version, 1);
    assert.ok(res.expiresAt);
    assert.ok(res.serverTime);
  });

  it('2. درخواست مجدد از همان دستگاه A باید idempotent باشد (status: already_locked)', async () => {
    const res = await service.acquire(ctxA);
    assert.strictEqual(res.status, 'already_locked');
    assert.strictEqual(res.version, 1);
  });

  it('3. ورود دستگاه B در حین فعال بودن A باید با خطای 409 EXAM_LOCKED متوقف شود', async () => {
    try {
      await service.acquire(ctxB);
      assert.fail('باید خطای 409 پرتاب می‌شد.');
    } catch (err: any) {
      assert.strictEqual(err.status, 409);
      const resp = err.getResponse();
      assert.strictEqual(resp.code, 'EXAM_LOCKED');
      assert.strictEqual(resp.details.canTakeover, true);
      assert.strictEqual(resp.details.remainingTakeovers, 2);
    }
  });

  it('4. دستگاه A باید بتواند ضربان قلب (Heartbeat) ارسال کرده و پاسخ‌ها را ثبت کند', async () => {
    const answers: StoredAnswer[] = [
      { questionNumber: 1, selectedOption: 2, isFlagged: false },
      { questionNumber: 2, selectedOption: 4, isFlagged: true },
    ];
    const res = await service.heartbeat(ctxA, 1, answers);
    assert.strictEqual(res.status, 'ok');
    assert.strictEqual(res.version, 1);
    assert.strictEqual(res.ackedSeq, 1);
    assert.strictEqual(res.remainingTakeovers, 2);

    const stored = await service.getStoredAnswers(attemptId);
    assert.strictEqual(stored[1]?.selectedOption, 2);
    assert.strictEqual(stored[2]?.selectedOption, 4);
    assert.strictEqual(stored[2]?.isFlagged, true);
  });

  it('5. دستگاه B باید بتواند قفل را تسخیر کند (Takeover ۱ از ۲)', async () => {
    const res = await service.takeover(ctxB);
    assert.strictEqual(res.status, 'taken_over');
    assert.strictEqual(res.version, 2);
    assert.strictEqual(res.takeoverCount, 1);
    assert.strictEqual(res.remainingTakeovers, 1);
    assert.strictEqual(res.previousDeviceId, deviceA);
  });

  it('6. دستگاه قبلی A در ضربان بعدی باید اخراج شود (403 EXAM_LOCK_LOST)', async () => {
    try {
      await service.heartbeat(ctxA, 2, [{ questionNumber: 1, selectedOption: 3 }]);
      assert.fail('باید خطای 403 پرتاب می‌شد.');
    } catch (err: any) {
      assert.strictEqual(err.status, 403);
      const resp = err.getResponse();
      assert.strictEqual(resp.code, 'EXAM_LOCK_LOST');
    }
  });

  it('7. دستگاه C می‌تواند برای دومین بار قفل را تسخیر کند (Takeover ۲ از ۲)', async () => {
    const res = await service.takeover(ctxC);
    assert.strictEqual(res.status, 'taken_over');
    assert.strictEqual(res.version, 3);
    assert.strictEqual(res.takeoverCount, 2);
    assert.strictEqual(res.remainingTakeovers, 0);
    assert.strictEqual(res.previousDeviceId, deviceB);
  });

  it('8. تلاش برای تسخیر سوم (Anti-Bounce Limit) باید با 403 TAKEOVER_LIMIT_REACHED مسدود شود', async () => {
    try {
      await service.takeover(ctxA);
      assert.fail('باید خطای 403 سقف مجاز پرتاب می‌شد.');
    } catch (err: any) {
      assert.strictEqual(err.status, 403);
      const resp = err.getResponse();
      assert.strictEqual(resp.code, 'TAKEOVER_LIMIT_REACHED');
      assert.strictEqual(resp.details.remainingTakeovers, 0);
    }
  });

  it('9. بررسی مالکیت assertOwner باید برای دستگاه C موفق و برای دستگاه‌های A و B مردود شود', async () => {
    const ver = await service.assertOwner(ctxC);
    assert.strictEqual(ver, 3);

    try {
      await service.assertOwner(ctxA);
      assert.fail('باید خطای مالکیت پرتاب می‌شد.');
    } catch (err: any) {
      assert.strictEqual(err.status, 403);
    }
  });

  it('10. ثبت رخدادهای تله‌متری فرانت‌اند و بازیابی آن برای پایش داوری', async () => {
    const event: TelemetryEvent = {
      eventType: 'TAB_BLUR',
      startedAt: Date.now(),
      durationMs: 3500,
      details: { target: 'external_browser_window' },
    };

    await service.recordTelemetry(attemptId, event);
    const logs = await service.getTelemetryEvents(attemptId);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].eventType, 'TAB_BLUR');
    assert.strictEqual(logs[0].durationMs, 3500);
  });

  it('11. دریافت وضعیت زنده قفل (getState)', async () => {
    const stateC = await service.getState(ctxC);
    assert.strictEqual(stateC.locked, true);
    assert.strictEqual(stateC.isOwner, true);
    assert.strictEqual(stateC.version, 3);
    assert.strictEqual(stateC.takeoverCount, 2);
    assert.strictEqual(stateC.remainingTakeovers, 0);
    assert.strictEqual(stateC.canTakeover, false);

    const stateA = await service.getState(ctxA);
    assert.strictEqual(stateA.locked, true);
    assert.strictEqual(stateA.isOwner, false);
  });

  it('12. آزادسازی قفل در انتهای آزمون (release)', async () => {
    await service.release(attemptId);
    const state = await service.getState(ctxC);
    assert.strictEqual(state.locked, false);
    assert.strictEqual(state.isOwner, false);
  });
});
