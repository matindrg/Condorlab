'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, ArrowLeft, X } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface ActiveExamData {
  slug: string;
  title: string;
  attemptId: string;
  expiryAt: number;
  userId?: string;
  status?: string;
}

export function ActiveExamBanner() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeExam, setActiveExam] = useState<ActiveExamData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const isExamRoom = Boolean(pathname && (pathname.endsWith('/room') || pathname.includes('/room/')));

  useEffect(() => {
    const checkActiveExam = () => {
      try {
        const raw = localStorage.getItem('condor_active_exam');
        if (!raw) {
          setActiveExam(null);
          setRemainingSeconds(0);
          return;
        }
        const data: ActiveExamData = JSON.parse(raw);
        const rem = Math.max(0, Math.floor((data.expiryAt - Date.now()) / 1000));
        if (rem > 0) {
          setActiveExam((prev) => {
            if (prev?.attemptId === data.attemptId && prev?.expiryAt === data.expiryAt) {
              return prev;
            }
            return data;
          });
          setRemainingSeconds(rem);
        } else {
          setActiveExam(null);
          setRemainingSeconds(0);
          localStorage.removeItem('condor_active_exam');
        }
      } catch {
        setActiveExam(null);
        setRemainingSeconds(0);
      }
    };

    checkActiveExam();

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          checkActiveExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const handleStorageChange = () => checkActiveExam();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('condor_active_exam_change', handleStorageChange);
    window.addEventListener('condor_auth_change', handleStorageChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('condor_active_exam_change', handleStorageChange);
      window.removeEventListener('condor_auth_change', handleStorageChange);
    };
  }, []);

  // در داخل اتاق آزمون، عدم وجود کاربر لاگین‌شده، عدم تطابق کاربر، یا رد کردن بنر، مخفی می‌شود
  if (
    isExamRoom ||
    !user ||
    !activeExam ||
    (activeExam.userId && activeExam.userId !== user.id) ||
    isDismissed ||
    remainingSeconds <= 0
  ) {
    return null;
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(m)}:${pad(s)}`;
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black px-3 sm:px-6 py-2 shadow-xl z-50 sticky top-0 transition-all">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span>آزمون در حال برگزاری:</span>
            <span className="underline decoration-black/30 underline-offset-2">{activeExam.title}</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-black/15 font-mono font-bold text-black border border-black/10">
            <Clock className="w-3.5 h-3.5 text-black" />
            <span>زمان باقیمانده: {formatTimer(remainingSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/exam/${activeExam.slug}/room`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 font-bold transition-all shadow-md shrink-0 text-xs"
          >
            <span>بازگشت به اتاق آزمون</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg hover:bg-black/10 text-black/70 hover:text-black transition-colors"
            title="مخفی‌سازی موقت این بنر"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
