'use client';

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, LogOut, ArrowRight, Smartphone, Laptop, Loader2 } from 'lucide-react';
import { TakeoverInfo } from '@/hooks/use-exam-heartbeat';
import { useRouter } from 'next/navigation';

interface TakeoverModalProps {
  isOpen: boolean;
  info: TakeoverInfo | null;
  onTakeover: () => Promise<boolean>;
  onDismiss?: () => void;
}

export function TakeoverModal({
  isOpen,
  info,
  onTakeover,
  onDismiss,
}: TakeoverModalProps) {
  const router = useRouter();
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);

  if (!isOpen || !info) return null;

  const isLockLost = info.code === 'EXAM_LOCK_LOST' || info.code === 'EXAM_LOCK_MISSING';
  const isLimitReached = info.remainingTakeovers <= 0;

  const toFarsiDigits = (n: number | string) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/[0-9]/g, (d) => farsiDigits[parseInt(d, 10)]);
  };

  const handleTakeover = async () => {
    setIsTakingOver(true);
    setTakeoverError(null);
    try {
      const ok = await onTakeover();
      if (!ok) {
        setTakeoverError('امکان تصاحب قفل آزمون وجود ندارد. لطفاً با پشتیبانی تماس بگیرید.');
      }
    } catch {
      setTakeoverError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleExit = () => {
    router.push('/student/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg p-6 bg-card border border-amber-500/30 dark:border-amber-500/20 rounded-3xl shadow-2xl text-card-foreground">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 shrink-0">
            {isLimitReached ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {isLockLost
                ? 'آزمون در دستگاه دیگری فعال شد'
                : 'نشست فعال دیگری با این حساب در آزمون است'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              آزمون شما در دستگاه دیگر همچنان در جریان است و با بازگشت، هیچ پاسخی حذف نخواهد شد. برای ادامه در این دستگاه، می‌توانید دستگاه قبلی را خارج کنید.
            </p>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-2xl bg-muted/50 border border-border space-y-2.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Laptop className="w-4 h-4 text-primary" />
              وضعیت قفل دستگاه:
            </span>
            <span className="font-semibold text-amber-500">
              {isLockLost ? 'دسترسی این دستگاه معلق شده است' : 'دستگاه دیگر در حال پاسخ‌گویی است'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>سهمیه جابه‌جایی دستگاه (Anti-Bounce):</span>
            <span className="font-bold text-foreground">
              {info.remainingTakeovers > 0
                ? `${toFarsiDigits(info.remainingTakeovers)} بار از ۲ بار باقی‌مانده`
                : '۰ بار (سقف تکمیل شده)'}
            </span>
          </div>
          {info.lockedAt && (
            <div className="flex items-center justify-between">
              <span>زمان ثبت آخرین ضربان دستگاه دیگر:</span>
              <span className="font-mono text-xs">
                {new Date(info.lockedAt).toLocaleTimeString('fa-IR')}
              </span>
            </div>
          )}
        </div>

        {takeoverError && (
          <div className="mt-3 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-medium">
            {takeoverError}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {info.canTakeover && !isLimitReached ? (
            <button
              onClick={handleTakeover}
              disabled={isTakingOver}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
            >
              {isTakingOver ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  در حال بیرون راندن دستگاه دیگر...
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  بیرون راندن دستگاه دیگر و ادامه در این دستگاه
                </>
              )}
            </button>
          ) : (
            <div className="flex-1 p-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center font-medium">
              سقف مجاز ۲ بار جابه‌جایی دستگاه برای این آزمون مصرف شده است.
            </div>
          )}

          <button
            onClick={handleExit}
            className="flex items-center justify-center gap-1.5 py-3 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors border border-border"
          >
            <ArrowRight className="w-4 h-4" />
            انصراف و بازگشت به پیشخوان
          </button>
        </div>
      </div>
    </div>
  );
}
