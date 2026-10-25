import { useState, useEffect, useRef, useCallback } from 'react';

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

export interface PendingAnswer {
  questionNumber: number;
  selectedOption: number | null;
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
  initialAnswers?: Record<number, { selectedOption: number | null; isFlagged: boolean }>;
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
  enabled = true,
  heartbeatIntervalMs = 30000,
  onLockLost,
  onTakeoverRequired,
  onSubmitted,
}: UseExamHeartbeatOptions) {
  const [status, setStatus] = useState<HeartbeatStatus>('idle');
  const [answers, setAnswers] = useState<Record<number, { selectedOption: number | null; isFlagged: boolean }>>(
    initialAnswers,
  );
  const [remainingTakeovers, setRemainingTakeovers] = useState<number>(2);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [takeoverInfo, setTakeoverInfo] = useState<TakeoverInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  const clientSeqRef = useRef<number>(1);
  const pendingQueueRef = useRef<Map<number, PendingAnswer>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // تولید یا خواندن شناسه یکتای دستگاه در localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let did = localStorage.getItem('condor_device_id');
    if (!did) {
      did = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem('condor_device_id', did);
    }
    setDeviceId(did);
  }, []);

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
      if (!attemptId || !deviceId || status === 'submitted' || status === 'lock_lost') return;

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
            'x-device-id': deviceId,
          },
          body: JSON.stringify({
            clientSeq: currentSeq,
            answers: queueItems,
            deviceId,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          // پاسخ‌ها با موفقیت در سرور و ردیس ثبت شدند
          queueItems.forEach((item) => {
            pendingQueueRef.current.delete(item.questionNumber);
          });
          setLastSyncTime(new Date());
          setRemainingTakeovers(data.remainingTakeovers ?? 2);
          setStatus('active');
          setErrorMessage(null);
          return;
        }

        if (res.status === 403) {
          if (data.code === 'EXAM_LOCK_LOST' || data.code === 'EXAM_LOCK_MISSING') {
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
    [attemptId, deviceId, onLockLost, onTakeoverRequired, status],
  );

  /**
   * درخواست اولیه شروع و دریافت قفل
   */
  const startExam = useCallback(async () => {
    if (!attemptId || !deviceId) return;
    try {
      const res = await fetch(`/api/exam-room/${attemptId}/start`, {
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
        setLastSyncTime(new Date());
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
  const takeoverExam = useCallback(async () => {
    if (!attemptId || !deviceId) return;
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
   * تغییر و ثبت گزینه یک سوال
   */
  const recordAnswer = useCallback(
    (questionNumber: number, selectedOption: number | null) => {
      setAnswers((prev) => {
        const currentFlag = prev[questionNumber]?.isFlagged ?? false;
        const updated = {
          ...prev,
          [questionNumber]: {
            selectedOption,
            isFlagged: currentFlag,
          },
        };
        persistLocally(updated);
        return updated;
      });

      // اضافه به صف ارسال سرور
      pendingQueueRef.current.set(questionNumber, {
        questionNumber,
        selectedOption,
        answeredAt: Date.now(),
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
        const currentOption = prev[questionNumber]?.selectedOption ?? null;
        const currentFlag = prev[questionNumber]?.isFlagged ?? false;
        const updated = {
          ...prev,
          [questionNumber]: {
            selectedOption: currentOption,
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

  // چرخه اجرای خودکار هارت‌بیت هر ۳۰ ثانیه
  useEffect(() => {
    if (!enabled || !attemptId || !deviceId || status === 'submitted' || status === 'lock_lost') {
      return;
    }

    startExam();

    timerRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, attemptId, deviceId, heartbeatIntervalMs, sendHeartbeat, startExam, status]);

  return {
    status,
    answers,
    remainingTakeovers,
    lastSyncTime,
    takeoverInfo,
    errorMessage,
    deviceId,
    recordAnswer,
    toggleFlag,
    sendHeartbeat,
    takeoverExam,
    submitExam,
    setTakeoverInfo,
  };
}
