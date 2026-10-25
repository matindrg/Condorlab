'use client';

import React, { useRef, useEffect } from 'react';
import { Check, Flag, HelpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';

export interface OmrItem {
  questionNumber: number;
  selectedOption: number | null;
  isFlagged: boolean;
}

interface OmrSheetProps {
  totalQuestions: number;
  activeQuestion: number;
  answers: Record<number, { selectedOption: number | null; isFlagged: boolean }>;
  onSelectQuestion: (qNum: number) => void;
  onSelectOption: (qNum: number, opt: number) => void;
  onClearOption: (qNum: number) => void;
  onJumpToFirstUnanswered: () => void;
}

export function OmrSheet({
  totalQuestions,
  activeQuestion,
  answers,
  onSelectQuestion,
  onSelectOption,
  onClearOption,
  onJumpToFirstUnanswered,
}: OmrSheetProps) {
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // اسکرول خودکار به سوال فعال در پاسخ‌برگ
  useEffect(() => {
    const el = rowRefs.current.get(activeQuestion);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeQuestion]);

  const answeredCount = Object.values(answers).filter(
    (a) => a.selectedOption !== null && a.selectedOption > 0,
  ).length;

  const flaggedCount = Object.values(answers).filter((a) => a.isFlagged).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
      {/* هدر پاسخ‌برگ و خلاصه آمار */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            پاسخ‌برگ OMR استاندارد
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
              {answeredCount}/{totalQuestions}
            </span>
          </h2>
          <button
            onClick={onJumpToFirstUnanswered}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            اولین نزده
          </button>
        </div>

        {/* نوار آمار فشرده */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="py-1 px-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
            <Check className="w-3 h-3" />
            {answeredCount} پاسخ
          </div>
          <div className="py-1 px-2 rounded-xl bg-muted border border-border text-muted-foreground font-medium flex items-center justify-center gap-1">
            <HelpCircle className="w-3 h-3" />
            {unansweredCount} نزده
          </div>
          <div className="py-1 px-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold flex items-center justify-center gap-1">
            <Flag className="w-3 h-3" />
            {flaggedCount} نشان
          </div>
        </div>
      </div>

      {/* سرستون‌های جدول پاسخ‌برگ */}
      <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground text-center">
        <span className="col-span-2 text-right">سؤال</span>
        <span className="col-span-2">۱</span>
        <span className="col-span-2">۲</span>
        <span className="col-span-2">۳</span>
        <span className="col-span-2">۴</span>
        <span className="col-span-2 text-left">وضعیت</span>
      </div>

      {/* لیست سطرهای سوالات با اسکرول مستقل */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2 space-y-0.5">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const qNum = idx + 1;
          const currentAnswer = answers[qNum];
          const selectedOption = currentAnswer?.selectedOption ?? null;
          const isFlagged = currentAnswer?.isFlagged ?? false;
          const isActive = activeQuestion === qNum;

          return (
            <div
              key={qNum}
              ref={(el) => {
                if (el) rowRefs.current.set(qNum, el);
                else rowRefs.current.delete(qNum);
              }}
              onClick={() => onSelectQuestion(qNum)}
              className={`grid grid-cols-12 items-center px-2 py-1.5 rounded-xl cursor-pointer transition-all ${
                isActive
                  ? 'bg-primary/10 border border-primary/30 shadow-sm'
                  : 'hover:bg-muted/40'
              }`}
            >
              {/* شماره سوال */}
              <div className="col-span-2 text-right flex items-center gap-1.5">
                <span
                  className={`text-xs font-mono font-bold ${
                    isActive ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {qNum}
                </span>
                {isFlagged && <Flag className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />}
              </div>

              {/* حباب‌های ۴ گزینه OMR */}
              {[1, 2, 3, 4].map((opt) => {
                const isSelected = selectedOption === opt;
                return (
                  <div key={opt} className="col-span-2 flex justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelected) {
                          onClearOption(qNum);
                        } else {
                          onSelectOption(qNum, opt);
                        }
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30 scale-105'
                          : 'border border-border text-muted-foreground hover:border-primary/50 hover:bg-muted'
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3 stroke-[3]" /> : opt}
                    </button>
                  </div>
                );
              })}

              {/* وضعیت سطر */}
              <div className="col-span-2 text-left">
                {selectedOption ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                    ثبت شد
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                    نزده
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* فوتر پاسخ‌برگ */}
      <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <span>کلیدهای ۱ تا ۴ برای ثبت سریع</span>
        {answers[activeQuestion]?.selectedOption && (
          <button
            onClick={() => onClearOption(activeQuestion)}
            className="flex items-center gap-1 text-destructive hover:underline"
          >
            <Trash2 className="w-3 h-3" />
            پاک کردن این سوال
          </button>
        )}
      </div>
    </div>
  );
}
