'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  HelpCircle,
  LogOut,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { HeartbeatStatus } from '@/hooks/use-exam-heartbeat';

interface ExamHeaderProps {
  title: string;
  code?: string;
  remainingSeconds: number;
  status: HeartbeatStatus;
  lastSyncTime: Date | null;
  remainingTakeovers: number;
  onOpenShortcuts: () => void;
  onRequestSubmit: () => void;
  onTimeExpired: () => void;
}

export function ExamHeader({
  title,
  code = 'CL-101',
  remainingSeconds: initialRemainingSeconds,
  status,
  lastSyncTime,
  remainingTakeovers,
  onOpenShortcuts,
  onRequestSubmit,
  onTimeExpired,
}: ExamHeaderProps) {
  const [timeLeft, setTimeLeft] = useState(initialRemainingSeconds);
  const hasExpiredRef = React.useRef(false);

  // همگام‌سازی زمان با سرور
  useEffect(() => {
    setTimeLeft(initialRemainingSeconds);
    if (initialRemainingSeconds <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onTimeExpired();
      }
    } else {
      hasExpiredRef.current = false;
    }
  }, [initialRemainingSeconds, onTimeExpired]);

  // شمارش معکوس مستقل در کلاینت
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onTimeExpired();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeExpired]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const toFarsiDigits = (n: number | string) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/[0-9]/g, (d) => farsiDigits[parseInt(d, 10)]);
  };

  const isLowTime = timeLeft <= 600; // کمتر از ۱۰ دقیقه
  const isCriticalTime = timeLeft <= 300; // کمتر از ۵ دقیقه

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* سمت راست: نام آزمون و کد */}
          <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg sm:rounded-xl shrink-0">
              {code}
            </div>
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-foreground truncate max-w-[130px] sm:max-w-xs md:max-w-sm lg:max-w-md">
              {title}
            </h1>
          </div>

          {/* مرکز: تایمر زمان باقیمانده */}
          <div className="shrink-0">
            <div
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl border transition-all ${
                isCriticalTime
                  ? 'bg-destructive/10 border-destructive/30 text-destructive animate-pulse'
                  : isLowTime
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  : 'bg-muted/80 border-border text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <div className="flex items-baseline gap-1 font-mono text-xs sm:text-base font-bold tracking-wider">
                <span className="text-[10px] sm:text-xs font-sans text-muted-foreground ml-0.5 hidden xs:inline">زمان:</span>
                {formatTimer(timeLeft)}
              </div>
            </div>
          </div>

          {/* سمت چپ: ابزارها، وضعیت شبکه، پایان آزمون */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* شاخص وضعیت اتصال و سینک */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 text-xs rounded-xl bg-muted/50 border border-border">
              {status === 'active' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-muted-foreground">متصل</span>
                </>
              ) : status === 'syncing' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                  <span className="text-blue-500 font-medium">همگام‌سازی...</span>
                </>
              ) : status === 'idle' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
                  <span className="text-muted-foreground">در حال اتصال...</span>
                </>
              ) : status === 'lock_lost' || status === 'takeover_required' ? (
                <>
                  <Smartphone className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span className="text-amber-500 font-medium">جابه‌جایی دستگاه</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-500 font-medium">آفلاین</span>
                </>
              )}
            </div>

            {/* سهمیه جابه‌جایی دستگاه (Anti-Bounce Limit) */}
            <div
              className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl border transition-colors ${
                remainingTakeovers === 0
                  ? 'bg-destructive/10 border-destructive/20 text-destructive font-semibold'
                  : remainingTakeovers === 1
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'bg-muted/50 border-border text-muted-foreground font-medium'
              }`}
              title="سقف مجاز تغییر دستگاه در طول آزمون (حداکثر ۲ بار)"
            >
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>سوییچ مجاز: {toFarsiDigits(remainingTakeovers)} از ۲</span>
            </div>

            {/* دکمه راهنمای میانبرها */}
            <button
              onClick={onOpenShortcuts}
              className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
              title="راهنمای کلیدهای میانبر (?)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* دکمه تحویل آزمون */}
            <button
              onClick={onRequestSubmit}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-destructive hover:text-white bg-destructive/10 hover:bg-destructive border border-destructive/20 rounded-xl transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تحویل آزمون</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
