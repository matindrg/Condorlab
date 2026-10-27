import { useState, useEffect, useRef, useCallback } from 'react';
import { getOrCreateDeviceId } from '@/lib/device';

export type HeartbeatStatus =
  | 'idle'
  | 'active'
  | 'syncing'
  | 'offline'
  | 'lock_lost'
  | 'takeover_required'
  | 'kicked'
  | 'submitted'
  | 'error';

export interface AnswerStateItem {
  selectedOption: number | null;
  selectedStatements?: Record<number, boolean | null> | null;
  numericValue?: number | null;
  isFlagged: boolean;
}

export interface PendingAnswer {
  questionNumber: number;
  selectedOption: number | null;
  selectedStatements?: Record<number, boolean | null> | null;
  numericValue?: number | null;
  isFlagged?: boolean;
  answeredAt: number;
}

export interface TakeoverInfo {
  code: string;
  message: string;
  canTakeover: boolean;
  remainingTakeovers: number;
  lockedAt?: string;
  version?: number;
}

export interface UseExamHeartbeatOptions {
  attemptId: string;
  examSlug: string;
  initialAnswers?: Record<number, AnswerStateItem>;
  initialRemainingTakeovers?: number;
  deviceId?: string;
  enabled?: boolean;
  heartbeatIntervalMs?: number;
  onLockLost?: (info: TakeoverInfo) => void;
  onTakeoverRequired?: (info: TakeoverInfo) => void;
  onSubmitted?: () => void;
}

export function useExamHeartbeat({
  attemptId,
  examSlug,
  initialAnswers = {},
  initialRemainingTakeovers = 2,
  deviceId: optionsDeviceId,
  enabled = true,
  heartbeatIntervalMs = 30000,
  onLockLost,
  onTakeoverRequired,
  onSubmitted,
}: UseExamHeartbeatOptions) {
  const [status, setStatus] = useState<HeartbeatStatus>('idle');
  const [answers, setAnswers] = useState<Record<number, AnswerStateItem>>(
    initialAnswers,
  );
  const [remainingTakeovers, setRemainingTakeovers] = useState<number>(initialRemainingTakeovers);

  useEffect(() => {
    if (initialRemainingTakeovers !== undefined) {
      setRemainingTakeovers(initialRemainingTakeovers);
    }
  }, [initialRemainingTakeovers]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [takeoverInfo, setTakeoverInfo] = useState<TakeoverInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>(() => {
    return optionsDeviceId || getOrCreateDeviceId();
  });

  useEffect(() => {
    if (!deviceId) {
      const did = optionsDeviceId || getOrCreateDeviceId();
      if (did) setDeviceId(did);
    }
  }, [optionsDeviceId, deviceId]);

  const clientSeqRef = useRef<number>(1);
  const pendingQueueRef = useRef<Map<number, PendingAnswer>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<HeartbeatStatus>(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // بارگذاری پاسخ‌های قبلی از localStorage در صورت وجود
  useEffect(() => {
    if (typeof window === 'undefined' || !attemptId) return;
    try {
      const saved = localStorage.getItem(`condor_exam_answers_${attemptId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAnswers((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, [attemptId]);

  // ثبت در localStorage با هر تغییر پاسخ
  const persistLocally = useCallback(
    (newAnswers: Record<number, { selectedOption: number | null; isFlagged: boolean }>) => {
      if (typeof window === 'undefined' || !attemptId) return;
      try {
        localStorage.setItem(`condor_exam_answers_${attemptId}`, JSON.stringify(newAnswers));
      } catch {
        // ignore
      }
    },
    [attemptId],
  );

  /**
   * ارسال ضربان به همراه صف پاسخ‌های جدید
   */
  const sendHeartbeat = useCallback(
    async (isManual = false) => {
      const activeDeviceId = deviceId || getOrCreateDeviceId();
      if (!attemptId || !activeDeviceId || statusRef.current === 'submitted' || statusRef.current === 'lock_lost') return;

      const queueItems = Array.from(pendingQueueRef.current.values());
      const currentSeq = clientSeqRef.current++;

      if (!isManual) {
        setStatus((prev) => (prev === 'active' || prev === 'idle' ? 'syncing' : prev));
      }

      try {
        const res = await fetch(`/api/exam-room/${attemptId}/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': activeDeviceId,
          },
          body: JSON.stringify({
            clientSeq: currentSeq,
            answers: queueItems,
            deviceId: activeDeviceId,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          // پاسخ‌ها با موفقیت در سرور و ردیس ثبت شدند
          queueItems.forEach((item) => {
            pendingQueueRef.current.delete(item.questionNumber);
          });
          setLastSyncTime(new Date());
          if (data.remainingTakeovers !== undefined) {
            setRemainingTakeovers(data.remainingTakeovers);
          }
          setStatus('active');
          setErrorMessage(null);
          return;
        }

        if (res.status === 403) {
          if (data.code === 'EXAM_LOCK_LOST') {
            const info: TakeoverInfo = {
              code: data.code,
              message: data.message || 'نشست دیگری وارد آزمون شد.',
              canTakeover: data.details?.canTakeover ?? false,
              remainingTakeovers: data.details?.remainingTakeovers ?? 0,
            };
            setStatus('lock_lost');
            setTakeoverInfo(info);
            onLockLost?.(info);
            return;
          }

          if (data.code === 'EXAM_LOCK_MISSING') {
            // در صورت انقضای موقت قفل بدون تسخیر توسط دستگاه دیگر، قفل بدون مزاحمت برای داوطلب تمدید می‌شود
            startExam();
            return;
          }
        }

        if (res.status === 409 && data.code === 'EXAM_LOCKED') {
          const info: TakeoverInfo = {
            code: 'EXAM_LOCKED',
            message: data.message || 'آزمون روی دستگاه دیگری باز است.',
            canTakeover: data.details?.canTakeover ?? true,
            remainingTakeovers: data.details?.remainingTakeovers ?? 1,
            lockedAt: data.details?.lockedAt,
            version: data.details?.version,
          };
          setStatus('takeover_required');
          setTakeoverInfo(info);
          onTakeoverRequired?.(info);
          return;
        }

        // سایر خطاها
        setStatus('offline');
      } catch {
        // قطع اتصال اینترنت داوطلب (پوشش آفلاین ۲ دقیقه‌ای)
        setStatus('offline');
      }
    },
    [attemptId, deviceId, onLockLost, onTakeoverRequired],
  );

  /**
   * درخواست اولیه شروع و دریافت قفل
   */
  const startExam = useCallback(async () => {
    const activeDeviceId = deviceId || getOrCreateDeviceId();
    if (!attemptId || !activeDeviceId) return;
    try {
      const res = await fetch(`/api/exam-room/${attemptId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': activeDeviceId,
        },
        body: JSON.stringify({ deviceId: activeDeviceId }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('active');
        setTakeoverInfo(null);
        setLastSyncTime(new Date());
        if (data.remainingTakeovers !== undefined) {
          setRemainingTakeovers(data.remainingTakeovers);
        }
        return;
      }

      if (res.status === 409 && data.code === 'EXAM_LOCKED') {
        const info: TakeoverInfo = {
          code: 'EXAM_LOCKED',
          message: data.message || 'آزمون روی دستگاه دیگری باز است.',
          canTakeover: data.details?.canTakeover ?? true,
          remainingTakeovers: data.details?.remainingTakeovers ?? 1,
          lockedAt: data.details?.lockedAt,
          version: data.details?.version,
        };
        setStatus('takeover_required');
        setTakeoverInfo(info);
        onTakeoverRequired?.(info);
      } else if (res.status === 403 && data.code === 'TAKEOVER_LIMIT_REACHED') {
        setStatus('kicked');
        setErrorMessage('سقف مجاز جابه‌جایی دستگاه (۲ بار) برای این آزمون مصرف شده است.');
      } else {
        setStatus('active'); // اجازه ادامه به صورت آفلاین
      }
    } catch {
      setStatus('active');
    }
  }, [attemptId, deviceId, onTakeoverRequired]);

  /**
   * تصاحب قفل از دستگاه دیگر با کسر سهمیه
   */
  const takeoverExam = useCallback(async (): Promise<boolean> => {
    if (!attemptId || !deviceId) return false;
    try {
      const res = await fetch(`/api/exam-room/${attemptId}/takeover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ deviceId }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('active');
        setTakeoverInfo(null);
        setRemainingTakeovers(data.remainingTakeovers ?? 1);
        setLastSyncTime(new Date());

        // همگام‌سازی و اورراید فوری پاسخ‌های دستگاه مبدا روی این دستگاه
        if (data.answers && typeof data.answers === 'object') {
          setAnswers((prev) => {
            const merged = { ...prev, ...data.answers };
            persistLocally(merged);
            return merged;
          });
        }

        return true;
      }

      if (res.status === 403) {
        setErrorMessage(data.message || 'امکان تصاحب آزمون وجود ندارد.');
        return false;
      }
      return false;
    } catch {
      setErrorMessage('خطا در برقراری ارتباط با سرور.');
      return false;
    }
  }, [attemptId, deviceId]);

  /**
   * تغییر و ثبت گزینه یا پاسخ تحلیلی یک سوال
   */
  const recordAnswer = useCallback(
    (
      questionNumber: number,
      selectedOption: number | null,
      selectedStatements?: Record<number, boolean | null> | null,
      numericValue?: number | null,
    ) => {
      setAnswers((prev) => {
        const current = prev[questionNumber];
        const updated = {
          ...prev,
          [questionNumber]: {
            selectedOption,
            selectedStatements: selectedStatements !== undefined ? selectedStatements : (current?.selectedStatements || null),
            numericValue: numericValue !== undefined ? numericValue : (current?.numericValue || null),
            isFlagged: current?.isFlagged ?? false,
          },
        };
        persistLocally(updated);
        return updated;
      });

      // اضافه به صف ارسال سرور
      pendingQueueRef.current.set(questionNumber, {
        questionNumber,
        selectedOption,
        selectedStatements,
        numericValue,
        answeredAt: Date.now(),
      });
    },
    [persistLocally],
  );

  /**
   * ثبت انتخاب درست/غلط برای یک گزاره در سوالات گزاره‌ای مرحله دوم (PRD ۵٫۳٫۴)
   */
  const recordStatement = useCallback(
    (questionNumber: number, statementIdx: number, val: boolean | null) => {
      setAnswers((prev) => {
        const current = prev[questionNumber];
        const prevStmts = current?.selectedStatements || {};
        const updatedStmts = { ...prevStmts, [statementIdx]: val };
        const updated = {
          ...prev,
          [questionNumber]: {
            selectedOption: current?.selectedOption ?? null,
            selectedStatements: updatedStmts,
            numericValue: current?.numericValue ?? null,
            isFlagged: current?.isFlagged ?? false,
          },
        };
        persistLocally(updated);

        pendingQueueRef.current.set(questionNumber, {
          questionNumber,
          selectedOption: current?.selectedOption ?? null,
          selectedStatements: updatedStmts,
          numericValue: current?.numericValue ?? null,
          isFlagged: current?.isFlagged ?? false,
          answeredAt: Date.now(),
        });

        return updated;
      });
    },
    [persistLocally],
  );

  /**
   * ثبت پاسخ عددی دو رقمی (۰ تا ۹۹) برای مسائل محاسباتی مرحله دوم (PRD ۵٫۳٫۴)
   */
  const recordNumeric = useCallback(
    (questionNumber: number, val: number | null) => {
      setAnswers((prev) => {
        const current = prev[questionNumber];
        const normalized = val === null || val === undefined ? null : Math.max(0, Math.min(99, Math.floor(val)));
        const updated = {
          ...prev,
          [questionNumber]: {
            selectedOption: null,
            selectedStatements: null,
            numericValue: normalized,
            isFlagged: current?.isFlagged ?? false,
          },
        };
        persistLocally(updated);

        pendingQueueRef.current.set(questionNumber, {
          questionNumber,
          selectedOption: null,
          selectedStatements: null,
          numericValue: normalized,
          isFlagged: current?.isFlagged ?? false,
          answeredAt: Date.now(),
        });

        return updated;
      });
    },
    [persistLocally],
  );

  /**
   * علامت‌گذاری سوال برای بازبینی (Flag)
   */
  const toggleFlag = useCallback(
    (questionNumber: number) => {
      setAnswers((prev) => {
        const current = prev[questionNumber];
        const currentOption = current?.selectedOption ?? null;
        const currentStatements = current?.selectedStatements ?? null;
        const currentNumeric = current?.numericValue ?? null;
        const currentFlag = current?.isFlagged ?? false;
        const updated = {
          ...prev,
          [questionNumber]: {
            selectedOption: currentOption,
            selectedStatements: currentStatements,
            numericValue: currentNumeric,
            isFlagged: !currentFlag,
          },
        };
        persistLocally(updated);
        return updated;
      });

      // افزودن وضعیت پرچم به صف ارسال
      const currentAnswer = answers[questionNumber];
      pendingQueueRef.current.set(questionNumber, {
        questionNumber,
        selectedOption: currentAnswer?.selectedOption ?? null,
        selectedStatements: currentAnswer?.selectedStatements ?? null,
        numericValue: currentAnswer?.numericValue ?? null,
        isFlagged: !(currentAnswer?.isFlagged ?? false),
        answeredAt: Date.now(),
      });
    },
    [answers, persistLocally],
  );

  /**
   * ارسال نهایی آزمون (Submit)
   */
  const submitExam = useCallback(async () => {
    if (!attemptId || !deviceId) return;

    const allAnswersList: PendingAnswer[] = Object.entries(answers).map(([qNum, val]) => ({
      questionNumber: Number(qNum),
      selectedOption: val.selectedOption,
      selectedStatements: val.selectedStatements,
      numericValue: val.numericValue,
      isFlagged: val.isFlagged,
      answeredAt: Date.now(),
    }));

    try {
      const res = await fetch(`/api/exam-room/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          answers: allAnswersList,
          deviceId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('submitted');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`condor_exam_answers_${attemptId}`);
          localStorage.removeItem('condor_active_exam');
          window.dispatchEvent(new Event('condor_active_exam_change'));
        }
        onSubmitted?.();
        return { success: true, summary: data.summary };
      }

      throw new Error(data.message || 'خطا در ثبت نهایی آزمون');
    } catch (e: any) {
      setErrorMessage(e.message || 'خطا در ارتباط با سرور هنگام ثبت نهایی.');
      return { success: false, error: e.message };
    }
  }, [attemptId, deviceId, answers, onSubmitted]);

  /**
   * ارسال رویدادهای تله‌متری رفتاری ضدتقلب
   */
  const sendTelemetry = useCallback(
    async (event: {
      eventType: 'TAB_BLUR' | 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'CONTEXT_MENU' | 'COPY_ATTEMPT';
      startedAt: number;
      durationMs?: number;
      details?: Record<string, unknown>;
    }) => {
      if (!attemptId) return;
      try {
        fetch(`/api/exam-room/${attemptId}/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }).catch(() => {});
      } catch {
        // ignore
      }
    },
    [attemptId],
  );

  const hasStartedRef = useRef(false);

  useEffect(() => {
    hasStartedRef.current = false;
  }, [attemptId]);

  // چرخه اجرای خودکار هارت‌بیت هر ۳۰ ثانیه (بدون تکرار بی‌مورد startExam)
  useEffect(() => {
    if (!enabled || !attemptId || !deviceId || status === 'submitted' || status === 'lock_lost') {
      return;
    }

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startExam();
    }

    timerRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, attemptId, deviceId, heartbeatIntervalMs, sendHeartbeat, startExam, status === 'submitted' || status === 'lock_lost']);

  // اتصال بلادرنگ SSE برای اخراج فوری دستگاه قبلی (Instant Kick-Out زیر ۱ ثانیه)
  useEffect(() => {
    if (!enabled || !attemptId || !deviceId || status === 'submitted' || status === 'lock_lost') {
      return;
    }

    let eventSource: EventSource | null = null;
    const activeDeviceId = deviceId || getOrCreateDeviceId();
    try {
      eventSource = new EventSource(`/api/exam-room/${attemptId}/events`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'LOCK_LOST' && payload.previousDeviceId === activeDeviceId) {
            const info: TakeoverInfo = {
              code: 'EXAM_LOCK_LOST',
              message: 'آزمون در دستگاه دیگری فعال شد و دسترسی این دستگاه فوراً معلق گردید.',
              canTakeover: true,
              remainingTakeovers: Math.max(0, remainingTakeovers - 1),
            };
            setStatus('lock_lost');
            setTakeoverInfo(info);
            onLockLost?.(info);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // fallback
    }

    // پروب سریع هر ۴ ثانیه برای پایش تغییر مالکیت در پس‌زمینه
    const probeInterval = setInterval(async () => {
      if (statusRef.current === 'submitted' || statusRef.current === 'lock_lost') return;
      try {
        const checkRes = await fetch(`/api/exam-room/${attemptId}/lock`, {
          headers: { 'x-device-id': activeDeviceId },
        });
        if (checkRes.ok) {
          const stateData = await checkRes.json();
          if (stateData && stateData.locked && !stateData.isOwner) {
            const info: TakeoverInfo = {
              code: 'EXAM_LOCK_LOST',
              message: 'آزمون در دستگاه دیگری فعال شد و دسترسی این دستگاه فوراً معلق گردید.',
              canTakeover: stateData.canTakeover ?? true,
              remainingTakeovers: stateData.remainingTakeovers ?? 0,
            };
            setStatus('lock_lost');
            setTakeoverInfo(info);
            onLockLost?.(info);
          }
        }
      } catch {
        // ignore
      }
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(probeInterval);
    };
  }, [enabled, attemptId, deviceId, status, remainingTakeovers, onLockLost]);

  return {
    status,
    answers,
    remainingTakeovers,
    lastSyncTime,
    takeoverInfo,
    errorMessage,
    deviceId,
    recordAnswer,
    recordStatement,
    recordNumeric,
    toggleFlag,
    sendHeartbeat,
    takeoverExam,
    submitExam,
    sendTelemetry,
    setTakeoverInfo,
  };
}
