'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  useExamHeartbeat,
  TakeoverInfo,
} from '@/hooks/use-exam-heartbeat';
import { ExamHeader } from '@/components/exam-room/exam-header';
import { DualViewContainer, ExamQuestionView } from '@/components/exam-room/dual-view-container';
import { OmrSheet } from '@/components/exam-room/omr-sheet';
import { WatermarkOverlay } from '@/components/exam-room/watermark-overlay';
import { TakeoverModal } from '@/components/exam-room/takeover-modal';
import { SubmitModal } from '@/components/exam-room/submit-modal';
import { ShortcutsModal } from '@/components/exam-room/shortcuts-modal';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  ArrowRight,
  Sheet,
  BookOpen,
} from 'lucide-react';

interface ExamRoomData {
  isSubmitted: boolean;
  submittedAt?: string;
  exam: {
    id: string;
    slug: string;
    title: string;
    durationMinutes: number;
    totalQuestions: number;
    price: number;
  };
  attempt: {
    id: string;
    startedAt: string;
    takeoverCount: number;
    status: string;
  };
  questions: ExamQuestionView[];
  answers: Record<number, { selectedOption: number | null; isFlagged: boolean }>;
  remainingSeconds: number;
  studentInfo: {
    name: string;
    grade: string;
    userId: string;
  };
}

export default function ExamRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const examIdentifier = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<ExamRoomData | null>(null);

  const [activeQuestion, setActiveQuestion] = useState<number>(1);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'content' | 'omr'>('content');
  const [submissionSummary, setSubmissionSummary] = useState<any>(null);

  // بارگذاری داده‌های اتاق آزمون
  useEffect(() => {
    let isMounted = true;
    async function loadRoom() {
      try {
        setIsLoading(true);
        let did = '';
        if (typeof window !== 'undefined') {
          did = localStorage.getItem('condor_device_id') || '';
          if (!did) {
            did = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
            localStorage.setItem('condor_device_id', did);
          }
        }

        const res = await fetch(`/api/exam-room/${examIdentifier}/init`, {
          cache: 'no-store',
          headers: {
            'x-device-id': did,
          },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'خطا در بارگذاری اتاق آزمون');
        }

        if (isMounted) {
          setRoomData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setInitError(err.message || 'خطا در برقراری ارتباط با سرور آزمون');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRoom();
    return () => {
      isMounted = false;
    };
  }, [examIdentifier]);

  // راه‌اندازی هوک قفل و ضربان قلب
  const {
    status,
    answers,
    remainingTakeovers,
    lastSyncTime,
    takeoverInfo,
    recordAnswer,
    toggleFlag,
    takeoverExam,
    submitExam,
    sendTelemetry,
    setTakeoverInfo,
  } = useExamHeartbeat({
    attemptId: roomData?.attempt?.id || '',
    examSlug: roomData?.exam?.slug || examIdentifier,
    initialAnswers: roomData?.answers || {},
    enabled: !!roomData && !roomData.isSubmitted,
    onSubmitted: () => {
      // وضعیت نهایی
    },
  });

  // پرش به اولین سوال پاسخ‌داده‌نشده
  const handleJumpToFirstUnanswered = useCallback(() => {
    if (!roomData?.questions) return;
    for (let i = 1; i <= roomData.questions.length; i++) {
      const ans = answers[i];
      if (!ans || ans.selectedOption === null) {
        setActiveQuestion(i);
        return;
      }
    }
  }, [answers, roomData]);

  // ثبت رخدادهای تله‌متری فرانت‌اند (ضد تقلب طبق PRD بخش ۵٫۳٫۶ و ANTI_CHEAT_FA)
  useEffect(() => {
    if (!roomData?.attempt?.id || roomData.isSubmitted) return;

    let blurStart = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        blurStart = Date.now();
        sendTelemetry({
          eventType: 'TAB_HIDDEN',
          startedAt: blurStart,
          details: { state: 'hidden' },
        });
      } else if (blurStart > 0) {
        const durationMs = Date.now() - blurStart;
        sendTelemetry({
          eventType: 'TAB_BLUR',
          startedAt: blurStart,
          durationMs,
          details: { durationMs },
        });
        blurStart = 0;
      }
    };

    const handleWindowBlur = () => {
      sendTelemetry({
        eventType: 'WINDOW_BLUR',
        startedAt: Date.now(),
      });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      sendTelemetry({
        eventType: 'CONTEXT_MENU',
        startedAt: Date.now(),
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // مسدودسازی کپی و مشاهده سورس
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'p', 'u', 's'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        sendTelemetry({
          eventType: 'COPY_ATTEMPT',
          startedAt: Date.now(),
          details: { key: e.key },
        });
        return;
      }

      // کلیدهای میانبر آزمون
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        recordAnswer(activeQuestion, Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        recordAnswer(activeQuestion, null);
      } else if (e.key === ' ' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFlag(activeQuestion);
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveQuestion((prev) => Math.min(roomData.questions.length, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setActiveQuestion((prev) => Math.max(1, prev - 1));
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleJumpToFirstUnanswered();
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [roomData, activeQuestion, recordAnswer, toggleFlag, sendTelemetry, handleJumpToFirstUnanswered]);

  // ثبت نهایی پاسخ‌برگ
  const handleFinalSubmit = async () => {
    const res = await submitExam();
    if (res?.success) {
      setSubmissionSummary(res.summary);
      setIsSubmitModalOpen(false);
      return res;
    }
    return res;
  };

  // حالت در حال بارگذاری اولیه
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-card border border-border shadow-xl text-center max-w-sm w-full space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <h2 className="text-base font-bold text-foreground">در حال آماده‌سازی صندلی آزمون...</h2>
          <p className="text-xs text-muted-foreground">
            بررسی قفل امنیتی دستگاه و بارگذاری پاسخ‌برگ اختصاصی
          </p>
        </div>
      </div>
    );
  }

  // خطای بارگذاری
  if (initError || !roomData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-card border border-destructive/20 shadow-xl text-center max-w-md w-full space-y-4">
          <div className="p-3 bg-destructive/10 text-destructive rounded-2xl w-fit mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-foreground">خطا در ورود به آزمون</h2>
          <p className="text-xs text-muted-foreground">{initError || 'امکان دسترسی به آزمون وجود ندارد.'}</p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="px-6 py-2.5 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors"
          >
            بازگشت به داشبورد
          </button>
        </div>
      </div>
    );
  }

  // اگر آزمون قبلاً ارسال شده باشد یا تازه ارسال شده باشد
  if (roomData.isSubmitted || status === 'submitted' || submissionSummary) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="p-8 sm:p-10 rounded-3xl bg-card border border-emerald-500/30 shadow-2xl text-center max-w-lg w-full space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-foreground">پاسخ‌برگ شما با موفقیت ثبت شد</h1>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              آزمون «{roomData.exam.title}» برای شما به پایان رسید و پاسخ‌های شما در سرور مرکزی کندرلب قفل گردید.
            </p>
          </div>

          {submissionSummary && (
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border text-xs">
              <div>
                <span className="text-muted-foreground">کل سؤالات</span>
                <div className="font-mono font-bold text-sm text-foreground mt-1">
                  {submissionSummary.totalQuestions}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">پاسخ‌داده</span>
                <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                  {submissionSummary.answeredCount}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">نزده</span>
                <div className="font-mono font-bold text-sm text-foreground mt-1">
                  {submissionSummary.unansweredCount}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push('/student/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-md"
            >
              مشاهده وضعیت در داشبورد
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentAnswer = answers[activeQuestion];

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col font-sans select-none">
      {/* واترمارک امنیتی ضد نشت */}
      <WatermarkOverlay
        studentName={roomData.studentInfo.name}
        studentId={roomData.studentInfo.userId}
        attemptId={roomData.attempt.id}
      />

      {/* هدر ثابت اتاق آزمون */}
      <ExamHeader
        title={roomData.exam.title}
        code="CL-101"
        remainingSeconds={roomData.remainingSeconds}
        status={status}
        lastSyncTime={lastSyncTime}
        remainingTakeovers={remainingTakeovers}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onRequestSubmit={() => setIsSubmitModalOpen(true)}
        onTimeExpired={() => setIsSubmitModalOpen(true)}
      />

      {/* نوار ناوبری موبایل (سوییچ بین دفترچه سوالات و پاسخ‌برگ OMR) */}
      <div className="lg:hidden p-2 bg-card border-b border-border flex items-center justify-center gap-2">
        <button
          onClick={() => setMobileTab('content')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            mobileTab === 'content'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          محتوای آزمون (سؤال {activeQuestion})
        </button>
        <button
          onClick={() => setMobileTab('omr')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            mobileTab === 'omr'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <Sheet className="w-3.5 h-3.5" />
          پاسخ‌برگ OMR
        </button>
      </div>

      {/* ناحیه محتوای دوگانه (Dual View Area) */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-[calc(100vh-80px)]">
        {/* ستون راست (۶۰٪ دسکتاپ): سوییچر دفترچه PDF / وب تکی */}
        <section
          className={`lg:col-span-8 flex flex-col h-[calc(100vh-140px)] ${
            mobileTab === 'content' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <DualViewContainer
            questions={roomData.questions}
            activeQuestionNumber={activeQuestion}
            selectedOption={currentAnswer?.selectedOption ?? null}
            isFlagged={currentAnswer?.isFlagged ?? false}
            onSelectQuestion={(qNum) => setActiveQuestion(qNum)}
            onSelectOption={(qNum, opt) => recordAnswer(qNum, opt)}
            onClearOption={(qNum) => recordAnswer(qNum, null)}
            onToggleFlag={(qNum) => toggleFlag(qNum)}
          />
        </section>

        {/* ستون چپ (۴۰٪ دسکتاپ): پاسخ‌برگ استاندارد OMR */}
        <section
          className={`lg:col-span-4 flex flex-col h-[calc(100vh-140px)] ${
            mobileTab === 'omr' ? 'block' : 'hidden lg:flex'
          }`}
        >
          <OmrSheet
            totalQuestions={roomData.questions.length}
            activeQuestion={activeQuestion}
            answers={answers}
            onSelectQuestion={(qNum) => {
              setActiveQuestion(qNum);
              setMobileTab('content');
            }}
            onSelectOption={(qNum, opt) => recordAnswer(qNum, opt)}
            onClearOption={(qNum) => recordAnswer(qNum, null)}
            onJumpToFirstUnanswered={handleJumpToFirstUnanswered}
          />
        </section>
      </main>

      {/* مدال تیک‌اوور (ورود دستگاه دیگر یا قطع قفل) */}
      <TakeoverModal
        isOpen={status === 'takeover_required' || status === 'lock_lost' || !!takeoverInfo}
        info={takeoverInfo}
        onTakeover={takeoverExam}
        onDismiss={() => setTakeoverInfo(null)}
      />

      {/* مدال تأیید ارسال نهایی */}
      <SubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmit={handleFinalSubmit}
        totalQuestions={roomData.questions.length}
        answers={answers}
      />

      {/* مدال راهنمای کلیدهای میانبر */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}
