'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PostExamSummary } from '@/components/exam-room/post-exam-summary';
import { getOrCreateDeviceId } from '@/lib/device';
import {
  FileCheck2,
  ArrowRight,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SummaryPageProps {
  params: Promise<{ id: string }>;
}

export default function ExamSummaryPage({ params }: SummaryPageProps) {
  const resolvedParams = use(params);
  const examIdentifier = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);
        const deviceId = getOrCreateDeviceId();

        // واکشی داده‌های نشست آزمون از اندپوینت اختصاصی init
        const res = await fetch(
          `/api/exam-room/${encodeURIComponent(examIdentifier)}/init`,
          {
            headers: {
              'x-device-id': deviceId,
            },
            cache: 'no-store',
          }
        );

        if (!res.ok) {
          if (res.status === 401) {
            router.replace('/login');
            return;
          }
          if (res.status === 403) {
            setError('شما در این آزمون ثبت‌نام نکرده‌اید یا دسترسی به آن برای شما مجاز نیست.');
            return;
          }
          setError('خطا در واکشی اطلاعات آزمون و پاسخ‌برگ.');
          return;
        }

        const data = await res.json();
        setRoomData(data);

        // اگر آزمون هنوز ثبت نهایی نشده، کاربر باید به اتاق آزمون هدایت شود
        const isDone = data.isSubmitted || data.attempt?.status === 'submitted' || data.attempt?.status === 'graded';
        if (!isDone) {
          router.replace(`/exam/${examIdentifier}/room`);
          return;
        }
      } catch (err: any) {
        setError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
      } finally {
        setLoading(false);
      }
    }

    if (examIdentifier) {
      fetchSummary();
    }
  }, [examIdentifier, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0F12] text-white flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-[#FFCC00]/10 border border-[#FFCC00]/20 flex items-center justify-center text-[#FFCC00] mb-4 shadow-xl">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-base font-bold text-white mb-2">در حال بارگذاری خلاصه پاسخ‌برگ...</h2>
        <p className="text-xs text-gray-400">اطلاعات پاسخ‌ها و گزینه‌های انتخابی شما در حال آماده‌سازی است.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0E0F12] text-white flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-[#16181D] border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">عدم دسترسی به خلاصه پاسخ‌برگ</h3>
          <p className="text-xs text-gray-300 leading-relaxed">{error}</p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/10"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>بازگشت به پنل کاربری</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!roomData) {
    return null;
  }

  // محاسبه خلاصه کلیدها و سوالات پاسخ داده شده
  const answers = roomData.answers || {};
  const totalQuestions = roomData.exam?.totalQuestions || roomData.questions?.length || 60;
  const answeredCount = Object.values(answers).filter((a: any) => {
    const hasOpt = a?.selectedOption !== null && a?.selectedOption !== undefined && a.selectedOption > 0;
    const hasStmts =
      a?.selectedStatements &&
      Object.values(a.selectedStatements).some((v) => v !== null && v !== undefined);
    const hasNum = a?.numericValue !== null && a?.numericValue !== undefined;
    return hasOpt || hasStmts || hasNum;
  }).length;
  const flaggedCount = Object.values(answers).filter((a: any) => a?.isFlagged).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div className="min-h-screen bg-[#0E0F12] text-foreground font-sans pb-20" dir="rtl">
      {/* هدر اختصاصی بازگشت به پنل */}
      <div className="border-b border-white/10 bg-[#121418]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/student/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>پنل دانش‌آموزی</span>
            </Link>
            <span>/</span>
            <span className="text-[#FFCC00] font-bold">خلاصه رسمی پاسخ‌برگ</span>
          </div>

          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-bold transition-all border border-white/10"
          >
            <span>بازگشت به داشبورد</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <PostExamSummary
          examTitle={roomData.exam?.title || roomData.examTitle || 'آزمون المپیاد'}
          examSlug={roomData.exam?.slug || examIdentifier}
          submittedAt={roomData.submittedAt || roomData.attempt?.submittedAt}
          questions={roomData.questions || []}
          answers={answers}
          summary={{
            totalQuestions,
            answeredCount,
            unansweredCount,
            flaggedCount,
          }}
          studentName={roomData.studentInfo?.name}
        />
      </div>
    </div>
  );
}
