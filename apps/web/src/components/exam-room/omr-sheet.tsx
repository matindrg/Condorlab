'use client';

import React, { useRef, useEffect } from 'react';
import { Check, Flag, HelpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';

export interface OmrItem {
  questionNumber: number;
  selectedOption: number | null;
  selectedStatements?: Record<number, boolean | null> | null;
  numericValue?: number | null;
  isFlagged: boolean;
}

interface OmrSheetProps {
  totalQuestions: number;
  activeQuestion: number;
  answers: Record<number, { selectedOption: number | null; selectedStatements?: Record<number, boolean | null> | null; numericValue?: number | null; isFlagged: boolean }>;
  questions?: Array<{ questionNumber: number; type?: string; statements?: any[]; options?: any[] }>;
  readOnly?: boolean;
  onSelectQuestion: (qNum: number) => void;
  onSelectOption: (qNum: number, opt: number) => void;
  onSelectStatement?: (qNum: number, statementIdx: number, val: boolean | null) => void;
  onSelectNumeric?: (qNum: number, val: number | null) => void;
  onClearOption: (qNum: number) => void;
  onJumpToFirstUnanswered: () => void;
  onToggleFlag?: (qNum: number) => void;
}

export function OmrSheet({
  totalQuestions,
  activeQuestion,
  answers,
  questions,
  readOnly = false,
  onSelectQuestion,
  onSelectOption,
  onSelectStatement,
  onSelectNumeric,
  onClearOption,
  onJumpToFirstUnanswered,
  onToggleFlag,
}: OmrSheetProps) {
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // بررسی نوع آزمون بر مبنای متادیتای سوالات
  const isStage2Exam = Boolean(questions?.some((q) => q.type === 'stage2_statements' || (q.statements && q.statements.length > 0)));
  const is5ChoiceExam = !isStage2Exam && Boolean(questions?.some((q) => q.type === 'mcq5' || (q.options && q.options.length === 5)));

  // اسکرول خودکار به سوال فعال در پاسخ‌برگ
  useEffect(() => {
    const el = rowRefs.current.get(activeQuestion);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeQuestion]);

  const answeredCount = Object.values(answers).filter((a) => {
    const hasOption = a.selectedOption !== null && a.selectedOption !== undefined && a.selectedOption > 0;
    const hasStatements = a.selectedStatements && Object.values(a.selectedStatements).some((v) => v !== null && v !== undefined);
    const hasNumeric = a.numericValue !== null && a.numericValue !== undefined;
    return hasOption || hasStatements || hasNumeric;
  }).length;

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
      {isStage2Exam ? (
        <div className="grid grid-cols-12 px-3 py-2 border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground text-center">
          <span className="col-span-2 text-right">سؤال</span>
          <span className="col-span-8 text-center">گزاره‌های ۵ گانه (الف تا هـ)</span>
          <span className="col-span-2 text-left">وضعیت</span>
        </div>
      ) : is5ChoiceExam ? (
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground text-center">
          <span className="col-span-2 text-right">سؤال</span>
          <span className="col-span-1.5 text-center">۱</span>
          <span className="col-span-1.5 text-center">۲</span>
          <span className="col-span-1.5 text-center">۳</span>
          <span className="col-span-1.5 text-center">۴</span>
          <span className="col-span-1.5 text-center">۵</span>
          <span className="col-span-2 text-left">وضعیت</span>
        </div>
      ) : (
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground text-center">
          <span className="col-span-2 text-right">سؤال</span>
          <span className="col-span-2">۱</span>
          <span className="col-span-2">۲</span>
          <span className="col-span-2">۳</span>
          <span className="col-span-2">۴</span>
          <span className="col-span-2 text-left">وضعیت</span>
        </div>
      )}

      {/* لیست سطرهای سوالات با اسکرول مستقل */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2 space-y-0.5">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const qNum = idx + 1;
          const currentAnswer = answers[qNum];
          const selectedOption = currentAnswer?.selectedOption ?? null;
          const selectedStatements = currentAnswer?.selectedStatements ?? null;
          const isFlagged = currentAnswer?.isFlagged ?? false;
          const isActive = activeQuestion === qNum;

          // وضعیت پاسخگویی در گزاره‌ای
          const answeredStatementsCount = selectedStatements
            ? Object.values(selectedStatements).filter((v) => v !== null && v !== undefined).length
            : 0;
          const isStatementFullyAnswered = answeredStatementsCount === 5;
          const isStatementPartiallyAnswered = answeredStatementsCount > 0 && answeredStatementsCount < 5;

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
              {/* شماره سوال و نشانه‌گذاری */}
              <div className="col-span-2 text-right flex items-center gap-1">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (readOnly) return;
                    onToggleFlag?.(qNum);
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    readOnly ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    isFlagged
                      ? 'text-amber-500 bg-amber-500/15 hover:bg-amber-500/25'
                      : 'text-muted-foreground/30 hover:text-amber-500 hover:bg-muted'
                  }`}
                  title={isFlagged ? 'حذف نشانه‌گذاری بازبینی این سوال' : 'نشانه‌گذاری سوال برای بازبینی'}
                >
                  <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-500' : ''}`} />
                </button>
                <span
                  className={`text-xs font-mono font-bold ${
                    isActive ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {qNum}
                </span>
              </div>

              {/* گزاره‌های ۵ گانه مرحله ۲ یا مسائل محاسباتی عددی */}
              {(() => {
                const qDef = questions?.find((q) => q.questionNumber === qNum);
                const isNumeric = qDef?.type === 'numeric';
                const isStatement =
                  qDef?.type === 'stage2_statements' ||
                  Boolean(qDef?.statements && qDef.statements.length > 0) ||
                  (!qDef && isStage2Exam && qNum <= 30);

                if (isNumeric) {
                  const numVal = currentAnswer?.numericValue;
                  return (
                    <div className="col-span-8 flex items-center justify-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-medium">مسئله عددی (۰-۹۹):</span>
                      <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        {numVal !== null && numVal !== undefined ? numVal : '—'}
                      </span>
                    </div>
                  );
                }

                if (isStatement || isStage2Exam) {
                  return (
                    <div className="col-span-8 flex items-center justify-center gap-1 sm:gap-1.5">
                      {[1, 2, 3, 4, 5].map((sNum) => {
                        const stmtVal = selectedStatements ? selectedStatements[sNum] : null;
                        const stmtLabel = ['الف', 'ب', 'ج', 'د', 'هـ'][sNum - 1];

                        return (
                          <button
                            key={sNum}
                            type="button"
                            disabled={readOnly}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (readOnly) return;
                              onSelectQuestion(qNum);
                              // چرخه تعاملی: خالی -> صحیح -> غلط -> خالی
                              const nextVal =
                                stmtVal === null || stmtVal === undefined
                                  ? true
                                  : stmtVal === true
                                  ? false
                                  : null;
                              onSelectStatement?.(qNum, sNum, nextVal);
                            }}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                              readOnly ? 'cursor-not-allowed opacity-60' : ''
                            } ${
                              stmtVal === true
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                : stmtVal === false
                                ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                                : 'bg-muted/60 text-muted-foreground/70 border-border hover:bg-muted'
                            }`}
                            title={`${stmtLabel}: ${
                              stmtVal === true ? 'صحیح' : stmtVal === false ? 'غلط' : 'بی‌پاسخ'
                            }`}
                          >
                            {stmtLabel}:{stmtVal === true ? 'ص' : stmtVal === false ? 'غ' : '-'}
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                if (is5ChoiceExam) {
                  return (
                    <div className="col-span-8 flex justify-between px-1">
                      {[1, 2, 3, 4, 5].map((opt) => {
                        const isSelected = selectedOption === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={readOnly}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (readOnly) return;
                              if (isSelected) {
                                onClearOption(qNum);
                              } else {
                                onSelectOption(qNum, opt);
                              }
                            }}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                              readOnly ? 'cursor-not-allowed opacity-60' : ''
                            } ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30 scale-105'
                                : 'border border-border text-muted-foreground hover:border-primary/50 hover:bg-muted'
                            }`}
                          >
                            {isSelected ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : opt}
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                return [1, 2, 3, 4].map((opt) => {
                  const isSelected = selectedOption === opt;
                  return (
                    <div key={opt} className="col-span-2 flex justify-center">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (readOnly) return;
                          if (isSelected) {
                            onClearOption(qNum);
                          } else {
                            onSelectOption(qNum, opt);
                          }
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                          readOnly ? 'cursor-not-allowed opacity-60' : ''
                        } ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30 scale-105'
                            : 'border border-border text-muted-foreground hover:border-primary/50 hover:bg-muted'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3 stroke-[3]" /> : opt}
                      </button>
                    </div>
                  );
                });
              })()}

              {/* وضعیت سطر */}
              <div className="col-span-2 text-left">
                {isStage2Exam ? (
                  isStatementFullyAnswered ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      ۵/۵ کامل
                    </span>
                  ) : isStatementPartiallyAnswered ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      {answeredStatementsCount}/۵
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      نزده
                    </span>
                  )
                ) : selectedOption ? (
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
