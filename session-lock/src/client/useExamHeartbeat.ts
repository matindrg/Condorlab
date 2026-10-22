import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExamApiError, postJson } from './exam-api';

export type HeartbeatStatus =
  | 'idle'
  | 'active'
  | 'offline'
  | 'lock_lost'
  | 'takeover_required'
  | 'kicked'
  | 'error';

export interface PendingAnswer {
  questionId: string;
  value: unknown;
  clientSeq: number;
  savedAt: number;
}

interface StoredQueue {
  version: 1;
  nextSeq: number;
  answers: PendingAnswer[];
}

export interface TakeoverInfo {
  code: string;
  message: string;
  canTakeover: boolean;
  remainingTakeovers: number;
  lastSeenAt?: string;
  version?: number;
}

export interface LockLostInfo {
  code: string;
  reason: 'lock_lost' | 'lock_missing' | 'takeover_limit' | 'auth';
  remainingTakeovers?: number;
  canTakeover?: boolean;
}

export interface UseExamHeartbeatOptions {
  attemptId: string;
  enabled?: boolean;
  apiBaseUrl?: string;
  heartbeatIntervalMs?: number;
  storageKey?: string;
  getAccessToken: () => string | null | Promise<string | null>;
  onLockLost?: (info: LockLostInfo) => void;
  onTakeoverRequired?: (info: TakeoverInfo) => void;
  onAuthError?: () => void;
  onSynced?: (ackedSeq: number) => void;
  onStatusChange?: (status: HeartbeatStatus) => void;
}

interface StartPayload {
  status: 'acquired' | 'already_locked';
  version: number;
  expiresAt: string;
  serverTime: string;
  heartbeatIntervalMs: number;
}

interface HeartbeatPayload {
  status: 'ok';
  version: number;
  ackedSeq: number;
  takeoverCount: number;
  remainingTakeovers: number;
  expiresAt: string;
  serverTime: string;
  heartbeatIntervalMs: number;
}

const DEFAULT_HEARTBEAT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PENDING_ANSWERS = 200;

function emptyQueue(): StoredQueue {
  return { version: 1, nextSeq: 1, answers: [] };
}

function readQueue(storageKey: string): StoredQueue {
  if (typeof window === 'undefined') return emptyQueue();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return emptyQueue();
    const parsed = JSON.parse(raw) as Partial<StoredQueue>;
    if (parsed.version !== 1 || !Array.isArray(parsed.answers)) return emptyQueue();

    const answers = parsed.answers.filter(
      (answer): answer is PendingAnswer =>
        Boolean(answer) &&
        typeof answer.questionId === 'string' &&
        typeof answer.clientSeq === 'number' &&
        Number.isFinite(answer.clientSeq),
    );
    const maxSeq = answers.reduce((max, answer) => Math.max(max, answer.clientSeq), 0);
    const nextSeq = Math.max(
      typeof parsed.nextSeq === 'number' ? parsed.nextSeq : 1,
      maxSeq + 1,
    );
    return { version: 1, nextSeq, answers };
  } catch {
    return emptyQueue();
  }
}

function writeQueue(storageKey: string, queue: StoredQueue): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {
    // Quota/private-mode failures are non-fatal; the in-memory queue remains.
  }
}

/**
 * useExamHeartbeat
 *
 * Responsibilities:
 *  - send a 30s heartbeat and refresh the server-side lock;
 *  - persist answers in LocalStorage while offline and flush them atomically
 *    with the next successful heartbeat;
 *  - distinguish a real network error (retry/offline banner) from an explicit
 *    403 lock-lost response (stop, show takeover modal / kick out);
 *  - expose takeover() for the "use this device" action.
 */
export function useExamHeartbeat(options: UseExamHeartbeatOptions) {
  const {
    attemptId,
    enabled = true,
    apiBaseUrl = '',
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS,
    storageKey: customStorageKey,
    getAccessToken,
  } = options;

  const storageKey = useMemo(
    () => customStorageKey ?? `condorlab:exam:${attemptId}:pending:v1`,
    [attemptId, customStorageKey],
  );

  const [status, setStatus] = useState<HeartbeatStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [takeoverInfo, setTakeoverInfo] = useState<TakeoverInfo | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [remainingTakeovers, setRemainingTakeovers] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const queueRef = useRef<StoredQueue>(readQueue(storageKey));
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1_000);

  // Keep the latest callbacks without re-creating the heartbeat every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sendHeartbeatRef = useRef<(reason: string) => Promise<void>>(async () => {});

  useEffect(() => {
    setPendingCount(queueRef.current.answers.length);
    // Load once per attempt/storage key.
    queueRef.current = readQueue(storageKey);
    setPendingCount(queueRef.current.answers.length);
  }, [storageKey]);

  useEffect(() => {
    optionsRef.current.onStatusChange?.(status);
  }, [status]);

  const persistQueue = useCallback(
    (next: StoredQueue) => {
      queueRef.current = next;
      if (mountedRef.current) setPendingCount(next.answers.length);
      writeQueue(storageKey, next);
    },
    [storageKey],
  );

  const clearLocalAnswers = useCallback(() => {
    const current = queueRef.current;
    // Keep nextSeq monotonic: a future answer must never reuse an old sequence.
    persistQueue({ ...current, answers: [] });
  }, [persistQueue]);

  const failAuth = useCallback(() => {
    stoppedRef.current = true;
    setStatus('kicked');
    optionsRef.current.onAuthError?.();
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryRef.current || stoppedRef.current || !mountedRef.current) return;
    const delay = Math.min(retryDelayRef.current, 30_000);
    retryRef.current = setTimeout(() => {
      retryRef.current = null;
      retryDelayRef.current = Math.min(delay * 2, 30_000);
      void sendHeartbeatRef.current('retry');
    }, delay);
  }, []);

  const handleLockFailure = useCallback(
    (error: ExamApiError) => {
      stoppedRef.current = true;
      startedRef.current = false;
      setStarted(false);
      setStatus('lock_lost');
      const details = (error.details ?? {}) as Record<string, unknown>;
      const canTakeover = details.canTakeover === true;
      const remaining =
        typeof details.remainingTakeovers === 'number' ? details.remainingTakeovers : 0;

      const info: TakeoverInfo = {
        code: error.code,
        message: error.message,
        canTakeover,
        remainingTakeovers: remaining,
        lastSeenAt: typeof details.lockedAt === 'string' ? details.lockedAt : undefined,
        version: typeof details.version === 'number' ? details.version : undefined,
      };
      setTakeoverInfo(info);
      setRemainingTakeovers(remaining);
      optionsRef.current.onLockLost?.({
        code: error.code,
        reason: error.code === 'EXAM_LOCK_LOST' ? 'lock_lost' : 'lock_missing',
        remainingTakeovers: remaining,
        canTakeover,
      });
    },
    [],
  );

  const sendHeartbeat = useCallback(
    async (reason: string) => {
      if (!enabled || stoppedRef.current || inFlightRef.current) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus('offline');
        return;
      }

      inFlightRef.current = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const token = await optionsRef.current.getAccessToken();
        if (!token) {
          failAuth();
          return;
        }

        const current = queueRef.current;
        const answers = current.answers.map(({ questionId, value }) => ({ questionId, value }));
        const clientSeq = answers.length > 0 ? current.nextSeq - 1 : undefined;

        const data = await postJson<HeartbeatPayload>(
          `${apiBaseUrl}/api/exam/${encodeURIComponent(attemptId)}/heartbeat`,
          token,
          { ...(clientSeq ? { clientSeq } : {}), ...(answers.length ? { answers } : {}) },
          controller.signal,
        );

        const remaining = current.answers.filter((answer) => answer.clientSeq > data.ackedSeq);
        persistQueue({ ...current, answers: remaining });

        setLastSyncedAt(Date.now());
        setLastError(null);
        setStatus('active');
        setTakeoverInfo(null);
        setRemainingTakeovers(data.remainingTakeovers);
        setLockExpiresAt(data.expiresAt);
        setServerTimeOffset(Date.parse(data.serverTime) - Date.now());
        retryDelayRef.current = 1_000;
        optionsRef.current.onSynced?.(data.ackedSeq);
      } catch (error) {
        if (error instanceof ExamApiError) {
          if (error.status === 401) {
            failAuth();
            return;
          }
          if (
            error.status === 403 &&
            (error.code === 'EXAM_LOCK_LOST' || error.code === 'EXAM_LOCK_MISSING')
          ) {
            handleLockFailure(error);
            return;
          }
          if (error.status === 403 && error.code === 'TAKEOVER_LIMIT_REACHED') {
            stoppedRef.current = true;
            startedRef.current = false;
            setStarted(false);
            setStatus('kicked');
            clearLocalAnswers();
            optionsRef.current.onLockLost?.({
              code: error.code,
              reason: 'takeover_limit',
              remainingTakeovers: 0,
            });
            return;
          }
          if (error.status === 409) {
            // Attempt submitted/expired: no point retrying the heartbeat.
            stoppedRef.current = true;
            setStatus('kicked');
            setLastError(error.message);
            return;
          }
        }

        // Network/timeout/5xx/429: do NOT kick the user out.
        setStatus('offline');
        setLastError(error instanceof Error ? error.message : 'خطای شبکه');
        scheduleRetry();
      } finally {
        clearTimeout(timeout);
        inFlightRef.current = false;
        // A successful request that resolved after takeover state change must
        // not re-open a stopped session.
        if (reason === 'manual' && stoppedRef.current) {
          // no-op; kept for readability
        }
      }
    },
    [
      apiBaseUrl,
      attemptId,
      clearLocalAnswers,
      enabled,
      failAuth,
      handleLockFailure,
      persistQueue,
      scheduleRetry,
    ],
  );

  sendHeartbeatRef.current = sendHeartbeat;

  const queueAnswer = useCallback(
    (questionId: string, value: unknown) => {
      const current = queueRef.current;
      const nextAnswer: PendingAnswer = {
        questionId,
        value,
        clientSeq: current.nextSeq,
        savedAt: Date.now(),
      };
      const withoutPrevious = current.answers.filter((answer) => answer.questionId !== questionId);
      const answers = [...withoutPrevious, nextAnswer].slice(-MAX_PENDING_ANSWERS);
      persistQueue({ version: 1, nextSeq: current.nextSeq + 1, answers });

      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          void sendHeartbeatRef.current('answer');
        }, 300);
      }
    },
    [persistQueue],
  );

  const startExam = useCallback(async (): Promise<boolean> => {
    if (startedRef.current) return true;
    if (isStarting) return false;
    setIsStarting(true);
    setLastError(null);

    try {
      const token = await optionsRef.current.getAccessToken();
      if (!token) {
        failAuth();
        return false;
      }

      const data = await postJson<StartPayload>(
        `${apiBaseUrl}/api/exam/${encodeURIComponent(attemptId)}/start`,
        token,
        {},
      );

      startedRef.current = true;
      setStarted(true);
      setStatus('active');
      setTakeoverInfo(null);
      setLockExpiresAt(data.expiresAt);
      setServerTimeOffset(Date.parse(data.serverTime) - Date.now());
      void sendHeartbeatRef.current('start');
      return true;
    } catch (error) {
      if (error instanceof ExamApiError) {
        if (error.status === 401) {
          failAuth();
          return false;
        }
        if (error.status === 403 && error.code === 'TAKEOVER_LIMIT_REACHED') {
          const details = (error.details ?? {}) as Record<string, unknown>;
          const remaining =
            typeof details.remainingTakeovers === 'number' ? details.remainingTakeovers : 0;
          setTakeoverInfo({
            code: error.code,
            message: error.message,
            canTakeover: false,
            remainingTakeovers: remaining,
          });
          setRemainingTakeovers(remaining);
          setStatus('kicked');
          optionsRef.current.onLockLost?.({
            code: error.code,
            reason: 'takeover_limit',
            remainingTakeovers: remaining,
            canTakeover: false,
          });
          return false;
        }
        if (error.status === 409 && error.code === 'EXAM_LOCKED') {
          const details = (error.details ?? {}) as Record<string, unknown>;
          const info: TakeoverInfo = {
            code: error.code,
            message: error.message,
            canTakeover: details.canTakeover === true,
            remainingTakeovers:
              typeof details.remainingTakeovers === 'number' ? details.remainingTakeovers : 0,
            lastSeenAt: typeof details.lockedAt === 'string' ? details.lockedAt : undefined,
            version: typeof details.version === 'number' ? details.version : undefined,
          };
          setTakeoverInfo(info);
          setRemainingTakeovers(info.remainingTakeovers);
          optionsRef.current.onTakeoverRequired?.(info);
          return false;
        }
        setLastError(error.message);
      } else {
        setLastError(error instanceof Error ? error.message : 'شروع آزمون انجام نشد.');
      }
      return false;
    } finally {
      setIsStarting(false);
    }
  }, [apiBaseUrl, attemptId, failAuth, isStarting]);

  const takeover = useCallback(async (): Promise<boolean> => {
    if (isTakingOver) return false;
    setIsTakingOver(true);
    setLastError(null);

    try {
      const token = await optionsRef.current.getAccessToken();
      if (!token) {
        failAuth();
        return false;
      }

      await postJson(
        `${apiBaseUrl}/api/exam/${encodeURIComponent(attemptId)}/takeover`,
        token,
        { confirm: true },
      );

      stoppedRef.current = false;
      startedRef.current = true;
      setStarted(true);
      setStatus('active');
      setTakeoverInfo(null);
      retryDelayRef.current = 1_000;
      // Immediately flush the local queue against the newly acquired lock.
      void sendHeartbeatRef.current('takeover');
      return true;
    } catch (error) {
      if (error instanceof ExamApiError) {
        if (error.status === 401) {
          failAuth();
          return false;
        }
        if (error.status === 403 && error.code === 'TAKEOVER_LIMIT_REACHED') {
          stoppedRef.current = true;
          startedRef.current = false;
          setStarted(false);
          setTakeoverInfo((previous) =>
            previous
              ? { ...previous, canTakeover: false, remainingTakeovers: 0 }
              : {
                  code: error.code,
                  message: error.message,
                  canTakeover: false,
                  remainingTakeovers: 0,
                },
          );
          setRemainingTakeovers(0);
          setStatus('kicked');
          clearLocalAnswers();
          optionsRef.current.onLockLost?.({
            code: error.code,
            reason: 'takeover_limit',
            remainingTakeovers: 0,
            canTakeover: false,
          });
          return false;
        }
        setLastError(error.message);
      } else {
        setLastError(error instanceof Error ? error.message : 'جابه‌جایی دستگاه انجام نشد.');
      }
      return false;
    } finally {
      setIsTakingOver(false);
    }
  }, [apiBaseUrl, attemptId, clearLocalAnswers, failAuth, isTakingOver]);

  const retryNow = useCallback(() => {
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    retryDelayRef.current = 1_000;
    void sendHeartbeatRef.current('manual');
  }, []);

  useEffect(() => {
    if (!enabled || !started) return;

    mountedRef.current = true;
    stoppedRef.current = false;

    void sendHeartbeatRef.current('mount');
    intervalRef.current = setInterval(() => {
      void sendHeartbeatRef.current('interval');
    }, heartbeatIntervalMs);

    const onOnline = () => {
      setStatus((previous) => (previous === 'kicked' || previous === 'lock_lost' ? previous : 'active'));
      void sendHeartbeatRef.current('online');
    };
    const onOffline = () => setStatus('offline');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeatRef.current('visible');
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      intervalRef.current = null;
      retryRef.current = null;
      debounceRef.current = null;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, started, heartbeatIntervalMs]);

  return {
    status,
    started,
    isStarting,
    pendingCount,
    lastSyncedAt,
    lastError,
    takeoverInfo,
    isTakingOver,
    canTakeover: takeoverInfo?.canTakeover ?? false,
    remainingTakeovers,
    serverTimeOffset,
    lockExpiresAt,
    queueAnswer,
    startExam,
    takeover,
    retryNow,
    clearLocalAnswers,
  };
}
