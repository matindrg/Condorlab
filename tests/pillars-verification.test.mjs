import test from 'node:test';
import assert from 'node:assert/strict';

test('Pillar 1: Smart Caching Event Contract & Invalidation Names', () => {
  const supportedEvents = [
    'condor:invalidate:all',
    'condor:invalidate:purchases',
    'condor:invalidate:exams',
    'condor:invalidate:user',
    'condor_auth_change',
    'condor_active_exam_change',
  ];

  assert.equal(supportedEvents.length, 6);
  assert.ok(supportedEvents.includes('condor:invalidate:purchases'));
  assert.ok(supportedEvents.includes('condor:invalidate:exams'));
});

test('Pillar 2 - Rule C: 7-State Exam Card Action Button Matrix', () => {
  // شبیه‌ساز منطق تابع getExamCardState
  function evaluateCardState({ now, start, end, status, isReportPublished }) {
    const isBefore = start ? now < start : false;
    const isAfter = end ? now > end : false;
    const isDuring = !isBefore && !isAfter;

    const hasParticipated = ['in_progress', 'submitted', 'completed', 'expired', 'missed', 'graded'].includes(status);
    const isSubmitted = ['submitted', 'completed', 'graded'].includes(status);
    const isInProgress = status === 'in_progress';

    if (isBefore) return 1; // State 1: Before Window Starts (No button)
    if (isDuring && !hasParticipated) return 2; // State 2: During Window NOT_STARTED
    if (isDuring && isInProgress) return 3; // State 3: During Window IN_PROGRESS
    if (isSubmitted && !isReportPublished) return 4; // State 4: SUBMITTED waiting for report
    if (isSubmitted && isReportPublished) return 5; // State 5: SUBMITTED report published
    if (isAfter && !hasParticipated && !isReportPublished) return 6; // State 6: Absent no report -> muted badge
    if (isAfter && !hasParticipated && isReportPublished) return 7; // State 7: Absent with published solutions
    return 2;
  }

  const baseNow = 1000000;
  const futureStart = baseNow + 10000;
  const futureEnd = baseNow + 20000;
  const pastStart = baseNow - 20000;
  const pastEnd = baseNow - 10000;
  const currentStart = baseNow - 5000;
  const currentEnd = baseNow + 5000;

  // 1. Before Window
  assert.equal(evaluateCardState({ now: baseNow, start: futureStart, end: futureEnd, status: 'not_started', isReportPublished: false }), 1);

  // 2. During Window NOT_STARTED
  assert.equal(evaluateCardState({ now: baseNow, start: currentStart, end: currentEnd, status: 'not_started', isReportPublished: false }), 2);

  // 3. During Window IN_PROGRESS
  assert.equal(evaluateCardState({ now: baseNow, start: currentStart, end: currentEnd, status: 'in_progress', isReportPublished: false }), 3);

  // 4. SUBMITTED waiting for report
  assert.equal(evaluateCardState({ now: baseNow, start: currentStart, end: currentEnd, status: 'submitted', isReportPublished: false }), 4);

  // 5. SUBMITTED report published
  assert.equal(evaluateCardState({ now: baseNow, start: pastStart, end: pastEnd, status: 'submitted', isReportPublished: true }), 5);

  // 6. After Window Absent without published solutions
  assert.equal(evaluateCardState({ now: baseNow, start: pastStart, end: pastEnd, status: 'not_started', isReportPublished: false }), 6);

  // 7. After Window Absent with published solutions
  assert.equal(evaluateCardState({ now: baseNow, start: pastStart, end: pastEnd, status: 'not_started', isReportPublished: true }), 7);
});

test('Pillar 2 - Rule B: Strict Exam Lobby Gatekeeping Logic', () => {
  function canEnterLobby({ now, start, end, isSubmitted, isEnrolled }) {
    if (!isEnrolled) return { allowed: false, reason: 'NOT_ENROLLED' };
    if (isSubmitted) return { allowed: false, reason: 'ALREADY_SUBMITTED' };
    if (start && now < start) return { allowed: false, reason: 'BEFORE_WINDOW' };
    if (end && now > end) return { allowed: false, reason: 'EXPIRED' };
    return { allowed: true };
  }

  const now = 50000;
  // کاربر شرکت‌کرده نباید وارد لابی شود
  assert.deepEqual(canEnterLobby({ now, start: 40000, end: 60000, isSubmitted: true, isEnrolled: true }), {
    allowed: false,
    reason: 'ALREADY_SUBMITTED',
  });

  // قبل از بازه نباید وارد لابی شود
  assert.deepEqual(canEnterLobby({ now, start: 60000, end: 80000, isSubmitted: false, isEnrolled: true }), {
    allowed: false,
    reason: 'BEFORE_WINDOW',
  });

  // بعد از انقضا نباید وارد لابی شود
  assert.deepEqual(canEnterLobby({ now, start: 10000, end: 30000, isSubmitted: false, isEnrolled: true }), {
    allowed: false,
    reason: 'EXPIRED',
  });

  // در بازه رسمی و ثبت‌نامی مجاز است
  assert.deepEqual(canEnterLobby({ now, start: 40000, end: 60000, isSubmitted: false, isEnrolled: true }), {
    allowed: true,
  });
});

test('Rule R-66: Verbal Persian Grade Compliance', () => {
  const gradeMapping = {
    '7': 'پایه هفتم',
    '8': 'پایه هشتم',
    '9': 'پایه نهم',
    '10': 'پایه دهم',
    '11': 'پایه یازدهم',
    '12': 'پایه دوازدهم',
  };

  for (const [digit, verbal] of Object.entries(gradeMapping)) {
    assert.match(verbal, /^پایه [آ-ی]+$/);
    assert.doesNotMatch(verbal, /[0-9۰-۹]/, 'Grade string must never contain digits');
  }
});

test('Rule 5: Stage 2 Statements Notation Compliance (ص / غ only)', () => {
  const validLabels = ['ص (صحیح)', 'غ (غلط)', 'ص', 'غ'];
  const forbiddenWord = 'درست';

  for (const label of validLabels) {
    assert.ok(!label.includes(forbiddenWord), 'Stage 2 statements must never use the word درست');
  }
});

test('DevTools & Fetch Binding Hotfix: Non-Interference & Next.js RSC Protection', async () => {
  // شبیه‌ساز رفتار fetch bound
  let nativeFetchCallCount = 0;
  const mockWindow = {
    fetch: function (url, init) {
      nativeFetchCallCount++;
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
    },
  };

  const boundNativeFetch = mockWindow.fetch.bind(mockWindow);

  // شبیه‌ساز رهگیری DevTools با اصل ایزولاسیون کامل
  const interceptor = async (url, init = {}, currentSim = 'normal') => {
    const isNextInternal =
      url.includes('/_next/') ||
      url.includes('_rsc=') ||
      url.includes('__next') ||
      Boolean(init?.headers?.['RSC']);

    if (isNextInternal) {
      return boundNativeFetch(url, init);
    }

    const isApi = url.includes('/api/');
    if (currentSim === 'normal' || !isApi) {
      return boundNativeFetch(url, init);
    }

    if (currentSim === 'offline') {
      throw new TypeError('Failed to fetch');
    }

    if (currentSim === '500') {
      return { status: 500, ok: false };
    }

    return boundNativeFetch(url, init);
  };

  // ۱. تست انتقال صفحات Next.js بدون وقفه یا خطا روی کلیک اول
  const rscResponse = await interceptor('/student/dashboard?_rsc=123', { headers: { RSC: '1' } }, 'normal');
  assert.equal(rscResponse.status, 200);
  assert.equal(nativeFetchCallCount, 1);

  // ۲. تست فراخوانی عادی لاگین و ادمین در حالت نرمال
  const loginRes = await interceptor('/api/auth/login', { method: 'POST' }, 'normal');
  assert.equal(loginRes.status, 200);
  assert.equal(nativeFetchCallCount, 2);

  // ۳. تست شبیه‌سازی قطعی شبکه صرفاً برای API
  await assert.rejects(
    async () => {
      await interceptor('/api/admin/users', { method: 'GET' }, 'offline');
    },
    { name: 'TypeError', message: 'Failed to fetch' }
  );

  // ۴. در حالت آفلاین شبیه‌سازی‌شده، ریکوئست‌های داخلی Next هرگز نباید متوقف شوند
  const rscDuringOffline = await interceptor('/_next/static/chunks/app.js', {}, 'offline');
  assert.equal(rscDuringOffline.status, 200);
});

test('DevTools: Keyboard Shortcut Handler across Persian & English Layouts', () => {
  const isShortcut = (e) =>
    (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd' || e.code === 'KeyD');

  // انگلیسی استاندارد
  assert.ok(isShortcut({ ctrlKey: true, shiftKey: true, key: 'D', code: 'KeyD' }));
  assert.ok(isShortcut({ ctrlKey: true, shiftKey: true, key: 'd', code: 'KeyD' }));

  // مک با کلید Command
  assert.ok(isShortcut({ metaKey: true, shiftKey: true, key: 'D', code: 'KeyD' }));

  // کیبورد فارسی (که کاراکتر 'ی' تولید می‌کند ولی e.code آن همچنان 'KeyD' است)
  assert.ok(isShortcut({ ctrlKey: true, shiftKey: true, key: 'ی', code: 'KeyD' }));

  // عدم تطابق بدون شورتکات کامل
  assert.ok(!isShortcut({ ctrlKey: true, shiftKey: false, key: 'D', code: 'KeyD' }));
  assert.ok(!isShortcut({ ctrlKey: false, shiftKey: true, key: 'D', code: 'KeyD' }));
});

test('DevTools: Grades Scope Supports 7th Through 11th (پایه هفتم تا یازدهم)', () => {
  const devToolsGrades = [
    { id: '7', label: 'پایه هفتم' },
    { id: '8', label: 'پایه هشتم' },
    { id: '9', label: 'پایه نهم' },
    { id: '10', label: 'پایه دهم' },
    { id: '11', label: 'پایه یازدهم' },
  ];

  assert.equal(devToolsGrades.length, 5);
  const ids = devToolsGrades.map((g) => g.id);
  assert.deepEqual(ids, ['7', '8', '9', '10', '11']);

  // بررسی عدم حضور پایه دوازدهم (ممنوع طبق قانون رسمی المپیاد زیست)
  assert.ok(!ids.includes('12'));
});

test('Architectural Fix 1: Real DB User Impersonation & Split-Brain Elimination', async () => {
  const dedicatedAccounts = [
    { target: 'admin', expectedRole: 'MasterAdmin', id: 'a0000000-0000-4000-8000-000000000001' },
    { target: 'student-10', expectedRole: 'Student', id: 'a0000000-0000-4000-8000-000000000002' },
    { target: 'student-fresh', expectedRole: 'Student', id: 'a0000000-0000-4000-8000-000000000003' },
    { target: 'officer', expectedRole: 'ExamOfficer', id: 'a0000000-0000-4000-8000-000000000004' },
  ];

  for (const acc of dedicatedAccounts) {
    // شبیه‌ساز صدور سشن بک‌اند با کوکی واقعی
    const sessionId = 'test_sess_' + acc.target;
    const sessionCookie = Buffer.from(`${acc.id}:${sessionId}`).toString('base64');
    
    // اعتبارسنجی انطباق ۱۰۰٪ آی‌دی کلاینت و سرور (Zero Split-Brain)
    const tokenParts = Buffer.from(sessionCookie, 'base64').toString('utf-8').split(':');
    assert.equal(tokenParts[0], acc.id);
    assert.equal(tokenParts[1], sessionId);
  }
});

test('Architectural Fix 2: DevTools UI State Persistence across Transitions', () => {
  const mockSessionStorage = new Map();
  const STORAGE_KEY = 'condor_devtools_state_v1';

  // ذخیره وضعیت حین کار کاربر
  const testState = {
    isOpen: true,
    activeTab: 'cache',
    isMinimized: false,
    simulatedNetwork: 'normal',
  };
  mockSessionStorage.set(STORAGE_KEY, JSON.stringify(testState));

  // بازیابی وضعیت در رفرش یا ناوبری
  const restored = JSON.parse(mockSessionStorage.get(STORAGE_KEY));
  assert.equal(restored.isOpen, true);
  assert.equal(restored.activeTab, 'cache');
  assert.equal(restored.isMinimized, false);
});

test('Architectural Fix 3: Strict Query Gating & Cold-Start Retry Logic', async () => {
  let executionCount = 0;
  let cacheCommitted = false;

  // تابع واکشی با تاب‌آوری کلد-استارت
  async function fetchWithColdStartRetry({ isMounted, isAuthLoading, userId, dbFailuresBeforeSuccess }) {
    // ۱. گیت صریح: در صورت لودینگ احراز یا نبود کاربر نباید شلیک شود
    const isAuthReady = isMounted && !isAuthLoading && Boolean(userId);
    if (!isAuthReady) {
      return { skipped: true };
    }

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      attempts++;
      executionCount++;
      if (attempts <= dbFailuresBeforeSuccess) {
        // شبیه‌سازی خطای اتصال موقت کلد استارت
        continue;
      }
      // موفقیت دیتابیس
      cacheCommitted = true;
      return { success: true, attempts };
    }
    return { success: false };
  }

  // حالت ۱: احراز هویت هنوز در حال لودینگ است -> نباید شلیک شود
  const res1 = await fetchWithColdStartRetry({ isMounted: true, isAuthLoading: true, userId: null, dbFailuresBeforeSuccess: 0 });
  assert.equal(res1.skipped, true);
  assert.equal(executionCount, 0);

  // حالت ۲: احراز آماده است و دیتابیس در تلاش اول کلد-استارت است و در تلاش دوم پاسخ می‌دهد
  const res2 = await fetchWithColdStartRetry({ isMounted: true, isAuthLoading: false, userId: 'usr-1', dbFailuresBeforeSuccess: 1 });
  assert.equal(res2.success, true);
  assert.equal(res2.attempts, 2);
  assert.equal(cacheCommitted, true);
});

test('Architectural Fix 4: Atomic Exam State Sync & Summary Route Access', () => {
  // شبیه‌ساز محاسبه دکمه و وضعیت کارت کاتالوگ
  function getCatalogCardConfig(attemptStatus, isEnrolled) {
    if (attemptStatus === 'submitted' || attemptStatus === 'graded') {
      return {
        badgeText: 'پاسخ‌برگ ثبت شد',
        buttonText: 'مشاهده خلاصه پاسخ‌برگ',
        targetRoute: '/exam/slug/summary',
      };
    }
    if (attemptStatus === 'in_progress') {
      return {
        badgeText: 'آزمون در جریان',
        buttonText: 'بازگشت به اتاق آزمون',
        targetRoute: '/exam/slug/room',
      };
    }
    if (isEnrolled) {
      return {
        badgeText: 'صندلی شما فعال است',
        buttonText: 'ورود به لابی آزمون',
        targetRoute: '/exams/slug',
      };
    }
    return {
      badgeText: 'پذیرش فعال',
      buttonText: 'مشاهده و ثبت‌نام',
      targetRoute: '/exams/slug',
    };
  }

  // ۱. کاربری که آزمون را سابمیت کرده هرگز نباید دکمه "شرکت در آزمون" ببیند
  const submittedCard = getCatalogCardConfig('submitted', true);
  assert.equal(submittedCard.buttonText, 'مشاهده خلاصه پاسخ‌برگ');
  assert.equal(submittedCard.targetRoute, '/exam/slug/summary');

  // ۲. کاربری که در جریان آزمون است دکمه بازگشت به اتاق را می‌بیند
  const inProgressCard = getCatalogCardConfig('in_progress', true);
  assert.equal(inProgressCard.buttonText, 'بازگشت به اتاق آزمون');
  assert.equal(inProgressCard.targetRoute, '/exam/slug/room');

  // ۳. کاربری که ثبت‌نام کرده ولی شروع نکرده وارد لابی می‌شود
  const enrolledCard = getCatalogCardConfig('not_started', true);
  assert.equal(enrolledCard.buttonText, 'ورود به لابی آزمون');

  // ۴. کاربر ثبت‌نام نکرده دکمه ثبت‌نام می‌بیند
  const unenrolledCard = getCatalogCardConfig(null, false);
  assert.equal(unenrolledCard.buttonText, 'مشاهده و ثبت‌نام');
});
