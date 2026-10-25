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
    if (initialRemainingSeconds > 0) {
      hasExpiredRef.current = false;
    }
  }, [initialRemainingSeconds]);

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

  const isLowTime = timeLeft <= 600; // کمتر از ۱۰ دقیقه
  const isCriticalTime = timeLeft <= 300; // کمتر از ۵ دقیقه

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* سمت راست: نام آزمون و کد */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="px-2.5 py-1 text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 rounded-xl">
              {code}
            </div>
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate max-w-[280px] sm:max-w-md lg:max-w-lg">
              {title}
            </h1>
          </div>

          {/* مرکز: تایمر زمان باقیمانده */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-2xl border transition-all ${
                isCriticalTime
                  ? 'bg-destructive/10 border-destructive/30 text-destructive animate-pulse'
                  : isLowTime
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  : 'bg-muted/80 border-border text-foreground'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <div className="flex items-baseline gap-1 font-mono text-base sm:text-lg font-bold tracking-wider">
                <span className="text-xs font-sans text-muted-foreground ml-1">زمان:</span>
                {formatTimer(timeLeft)}
              </div>
            </div>
          </div>

          {/* سمت چپ: ابزارها، وضعیت شبکه، پایان آزمون */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* شاخص وضعیت اتصال و سینک */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 text-xs rounded-xl bg-muted/50 border border-border">
              {status === 'active' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-muted-foreground">متصل (ذخیره آنلاین)</span>
                </>
              ) : status === 'syncing' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                  <span className="text-blue-500 font-medium">همگام‌سازی...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-500 font-medium">آفلاین (صف محلی)</span>
                </>
              )}
            </div>

            {/* سهمیه دستگاه */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl bg-muted/40 border border-border text-muted-foreground">
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>دستگاه مجاز: ۱ از ۲</span>
            </div>

            {/* دکمه راهنمای میانبرها */}
            <button
              onClick={onOpenShortcuts}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
              title="راهنمای کلیدهای میانبر (?)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* دکمه پایان آزمون */}
            <button
              onClick={onRequestSubmit}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-destructive hover:text-white bg-destructive/10 hover:bg-destructive border border-destructive/20 rounded-xl transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              پایان آزمون
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
