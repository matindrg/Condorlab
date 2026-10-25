'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertOctagon, ArrowLeft, Loader2, Flag, HelpCircle, Check } from 'lucide-react';

interface SubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<any>;
  totalQuestions: number;
  answers: Record<number, { selectedOption: number | null; isFlagged: boolean }>;
}

export function SubmitModal({
  isOpen,
  onClose,
  onSubmit,
  totalQuestions,
  answers,
}: SubmitModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const answeredCount = Object.values(answers).filter(
    (a) => a.selectedOption !== null && a.selectedOption > 0,
  ).length;

  const flaggedCount = Object.values(answers).filter((a) => a.isFlagged).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onSubmit();
      if (!res?.success) {
        setError(res?.error || 'خطا در ثبت نهایی پاسخ‌برگ.');
      }
    } catch (e: any) {
      setError(e?.message || 'خطا در ارسال داده‌ها به سرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg p-6 bg-card border border-border rounded-3xl shadow-2xl text-card-foreground">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              آیا از ثبت نهایی پاسخ‌برگ خود اطمینان دارید؟
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              لطفاً گزارش آماری زیر را پیش از ارسال قطعی بررسی فرمایید.
            </p>
          </div>
        </div>

        {/* کارت آمار پاسخ‌ها */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <Check className="w-3.5 h-3.5" />
              پاسخ‌داده
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
              {answeredCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-500/10 border border-zinc-500/20">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs font-medium">
              <HelpCircle className="w-3.5 h-3.5" />
              نزده (سفید)
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-foreground">
              {unansweredCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
              <Flag className="w-3.5 h-3.5" />
              نشان‌دار
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-amber-700 dark:text-amber-300">
              {flaggedCount}
            </div>
          </div>
        </div>

        {/* هشدار عدم امکان بازگشت */}
        <div className="mt-5 p-3.5 rounded-2xl bg-destructive/5 border border-destructive/20 text-xs text-destructive flex items-start gap-2.5">
          <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>توجه مهم:</strong> پس از کلیک روی «ثبت قطعی»، پاسخ‌برگ شما در دیتابیس قفل شده و آزمون برای شما پایان خواهد یافت. امکان بازگشت یا تغییر پاسخ‌ها به هیچ عنوان وجود نخواهد داشت.
          </span>
        </div>

        {error && (
          <div className="mt-3 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-medium">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors"
          >
            بازگشت به آزمون
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-destructive hover:bg-destructive/90 rounded-xl transition-colors shadow-lg shadow-destructive/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال ثبت قطعی...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                ثبت قطعی و ارسال پاسخ‌برگ
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
