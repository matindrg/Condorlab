'use client';

import React, { useState } from 'react';
import {
  FileText,
  LayoutList,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Flag,
  Trash2,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

export interface StatementItemView {
  id: string;
  label: string; // 'الف', 'ب', 'ج', 'د', 'هـ'
  text: string;
}

export interface ExamQuestionView {
  id: number;
  questionNumber: number;
  type?: 'mcq4' | 'mcq5' | 'stage2_statements' | 'numeric';
  chapter?: number;
  subject?: string;
  topic: string;
  stem: string;
  options?: string[];
  statements?: StatementItemView[];
  pdfPage?: number;
}

interface DualViewContainerProps {
  questions: ExamQuestionView[];
  activeQuestionNumber: number;
  selectedOption?: number | null;
  selectedStatements?: Record<number, boolean | null> | null;
  numericValue?: number | null;
  isFlagged: boolean;
  readOnly?: boolean;
  onSelectQuestion: (qNum: number) => void;
  onSelectOption: (qNum: number, opt: number) => void;
  onSelectStatement?: (qNum: number, statementIdx: number, val: boolean | null) => void;
  onSelectNumeric?: (qNum: number, val: number | null) => void;
  onClearOption: (qNum: number) => void;
  onToggleFlag: (qNum: number) => void;
}

export function DualViewContainer({
  questions,
  activeQuestionNumber,
  selectedOption,
  selectedStatements,
  numericValue,
  isFlagged,
  readOnly = false,
  onSelectQuestion,
  onSelectOption,
  onSelectStatement,
  onSelectNumeric,
  onClearOption,
  onToggleFlag,
}: DualViewContainerProps) {
  const [viewMode, setViewMode] = useState<'pdf' | 'web'>('web');
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [pdfZoom, setPdfZoom] = useState<number>(100);

  const totalQuestions = questions.length;
  const currentQuestion =
    questions.find((q) => q.questionNumber === activeQuestionNumber) || questions[0];

  const totalPdfPages = Math.max(...questions.map((q) => q.pdfPage || 1), 6);

  const handleNextQuestion = () => {
    if (activeQuestionNumber < totalQuestions) {
      const nextNum = activeQuestionNumber + 1;
      onSelectQuestion(nextNum);
      const nextQ = questions.find((q) => q.questionNumber === nextNum);
      if (nextQ?.pdfPage) setPdfPage(nextQ.pdfPage);
    }
  };

  const handlePrevQuestion = () => {
    if (activeQuestionNumber > 1) {
      const prevNum = activeQuestionNumber - 1;
      onSelectQuestion(prevNum);
      const prevQ = questions.find((q) => q.questionNumber === prevNum);
      if (prevQ?.pdfPage) setPdfPage(prevQ.pdfPage);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-3xl shadow-sm overflow-hidden relative">
      {/* سوییچر بالای ناحیه محتوا با هایلایت کاملاً مشخص */}
      <div className="p-3 border-b border-border bg-muted/40 shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* انتخابگر دوحالته PDF / وب تکی با هایلایت طلایی برجسته */}
        <div className="inline-flex p-1 bg-muted/90 rounded-2xl border border-border shadow-inner">
          <button
            type="button"
            onClick={() => {
              setViewMode('pdf');
              if (currentQuestion?.pdfPage) setPdfPage(currentQuestion.pdfPage);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'pdf'
                ? 'bg-[#FFCC00] text-black shadow-md shadow-[#FFCC00]/25 font-black ring-2 ring-[#FFCC00]/30 scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <FileText className={`w-4 h-4 ${viewMode === 'pdf' ? 'text-black' : 'text-primary'}`} />
            فایل PDF آزمون (دفترچه)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('web')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'web'
                ? 'bg-[#FFCC00] text-black shadow-md shadow-[#FFCC00]/25 font-black ring-2 ring-[#FFCC00]/30 scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <LayoutList className={`w-4 h-4 ${viewMode === 'web' ? 'text-black' : 'text-primary'}`} />
            نمای تکی وب
          </button>
        </div>

        {/* کنترل‌های مربوط به حالت انتخابی */}
        {viewMode === 'pdf' ? (
          <div className="flex items-center gap-2">
            {/* ناوبری صفحات PDF */}
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                disabled={pdfPage <= 1}
                className="p-1 hover:bg-card rounded-lg disabled:opacity-40 transition-colors"
                title="صفحه قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-mono font-medium px-2">
                صفحه {pdfPage} از {totalPdfPages}
              </span>
              <button
                onClick={() => setPdfPage((p) => Math.min(totalPdfPages, p + 1))}
                disabled={pdfPage >= totalPdfPages}
                className="p-1 hover:bg-card rounded-lg disabled:opacity-40 transition-colors"
                title="صفحه بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* زوم PDF */}
            <div className="hidden sm:flex items-center gap-1 bg-muted px-2 py-1 rounded-xl border border-border text-xs">
              <button
                onClick={() => setPdfZoom((z) => Math.max(70, z - 10))}
                className="p-1 hover:bg-card rounded-lg"
                title="کوچک‌نمایی"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono w-10 text-center">{pdfZoom}٪</span>
              <button
                onClick={() => setPdfZoom((z) => Math.min(150, z + 10))}
                className="p-1 hover:bg-card rounded-lg"
                title="بزرگ‌نمایی"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPdfZoom(100)}
                className="p-1 hover:bg-card rounded-lg"
                title="اندازه طبیعی"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-mono">
              سؤال {activeQuestionNumber} از {totalQuestions}
            </span>
          </div>
        )}
      </div>

      {/* محتوای بدنه (اسکرول‌پذیر مستقل) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
        {viewMode === 'pdf' ? (
          /* نمای رندرشده دفترچه سوالات استاندارد PDF */
          <div
            className="mx-auto max-w-3xl transition-transform origin-top"
            style={{ transform: `scale(${pdfZoom / 100})` }}
          >
            <div className="p-8 sm:p-12 bg-white dark:bg-zinc-950 border border-border/80 rounded-2xl shadow-md text-foreground">
              {/* سربرگ صفحه دفترچه */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 text-xs text-muted-foreground mb-6">
                <span className="font-bold text-foreground">کندرلب • شبیه‌ساز جامع المپیاد زیست‌شناسی</span>
                <span className="font-mono">صفحه {pdfPage}</span>
              </div>

              {/* سوالات موجود در این صفحه PDF */}
              <div className="space-y-8">
                {questions
                  .filter((q) => (q.pdfPage || 1) === pdfPage)
                  .map((q) => {
                    const isCurrent = q.questionNumber === activeQuestionNumber;
                    return (
                      <div
                        key={q.id}
                        onClick={() => onSelectQuestion(q.questionNumber)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20'
                            : 'border-transparent hover:border-border hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 text-xs font-mono font-bold bg-muted border border-border rounded-lg text-primary">
                              سؤال {q.questionNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {q.topic} (فصل {q.chapter})
                            </span>
                          </div>
                          {isCurrent && (
                            <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              در حال پاسخ‌گویی در پاسخ‌برگ
                            </span>
                          )}
                        </div>

                        {/* صورت سوال */}
                        <p className="text-sm font-medium leading-relaxed text-foreground mt-2">
                          {q.stem}
                        </p>

                        {/* گزینه‌ها یا گزاره‌های تحلیلی */}
                        {q.statements && q.statements.length > 0 ? (
                          <div className="space-y-2 mt-4">
                            {q.statements.map((stmt, sIdx) => (
                              <div
                                key={stmt.id || sIdx}
                                className="flex items-start gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs"
                              >
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 font-bold text-[10px]">
                                  {stmt.label || ['الف', 'ب', 'ج', 'د', 'هـ'][sIdx]}
                                </span>
                                <span className="leading-relaxed">{stmt.text}</span>
                              </div>
                            ))}
                          </div>
                        ) : q.options && q.options.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                            {q.options.map((opt, optIdx) => {
                              const optNumber = optIdx + 1;
                              const isOptSelected = selectedOption === optNumber && isCurrent;
                              return (
                                <div
                                  key={optIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (readOnly) return;
                                    onSelectQuestion(q.questionNumber);
                                    onSelectOption(q.questionNumber, optNumber);
                                  }}
                                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                                    readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                                  } ${
                                    isOptSelected
                                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-semibold'
                                      : 'border-border/60 bg-muted/20 hover:bg-muted/60 text-foreground'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-[11px] ${
                                      isOptSelected
                                        ? 'bg-emerald-600 text-white'
                                        : 'border border-border text-muted-foreground'
                                    }`}
                                  >
                                    {optNumber}
                                  </span>
                                  <span>{opt}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>

              {/* پاورقی صفحه دفترچه */}
              <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-muted-foreground text-center font-mono">
                کد آزمون: CL-101 • طراحی تخصصی بر مبنای سرفصل‌های بیولوژی کمپبل جلد ۱ و ۲
              </div>
            </div>
          </div>
        ) : (
          /* نمای متنی ساختاریافته وب تکی */
          <div className="max-w-2xl mx-auto py-2">
            {/* نوار بالایی سوال */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 text-sm font-mono font-bold bg-primary/10 text-primary border border-primary/20 rounded-xl">
                  سؤال {currentQuestion.questionNumber} از {totalQuestions}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-muted border border-border text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  {currentQuestion.topic} (فصل {currentQuestion.chapter})
                </span>
              </div>

              {/* دکمه نشان‌گذاری برای بازبینی */}
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  onToggleFlag(currentQuestion.questionNumber);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  readOnly ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  isFlagged
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-500' : ''}`} />
                {isFlagged ? 'نشان‌دار شده' : 'نشان‌گذاری برای بازبینی'}
              </button>
            </div>

            {/* صورت سؤال */}
            <div className="my-6">
              <h2 className="text-base sm:text-lg font-bold leading-relaxed text-foreground">
                {currentQuestion.stem}
              </h2>
            </div>

            {/* گزینه‌های تعاملی چندگزینه‌ای، گزاره‌های تحلیلی مرحله دو یا مسائل عددی */}
            {currentQuestion.type === 'numeric' ? (
              <div className="space-y-5 mt-6 p-6 rounded-3xl bg-card border border-border">
                <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary font-bold flex items-center justify-between">
                  <span>مسئله محاسباتی المپیاد: پاسخ این سؤال یک عدد صحیح ۲ رقمی بین ۰ تا ۹۹ است.</span>
                  <span className="text-[11px] font-mono opacity-80">دامنه ۰ الی ۹۹</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground font-semibold">پاسخ عددی شما:</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      disabled={readOnly}
                      value={numericValue !== null && numericValue !== undefined ? numericValue : ''}
                      onChange={(e) => {
                        if (readOnly) return;
                        const v = e.target.value.trim();
                        if (v === '') {
                          onSelectNumeric?.(currentQuestion.questionNumber, null);
                        } else {
                          const n = parseInt(v, 10);
                          if (!isNaN(n)) {
                            onSelectNumeric?.(currentQuestion.questionNumber, Math.max(0, Math.min(99, n)));
                          }
                        }
                      }}
                      placeholder="۰-۹۹"
                      className="w-24 h-12 text-center text-xl font-mono font-bold rounded-2xl bg-muted border-2 border-primary/40 focus:border-primary focus:outline-none text-foreground"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={readOnly || numericValue === null || numericValue === undefined}
                      onClick={() => onSelectNumeric?.(currentQuestion.questionNumber, null)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground border border-border disabled:opacity-40 transition-colors"
                    >
                      پاک کردن
                    </button>
                  </div>
                </div>

                {/* دکمه‌های سریع برای ارقام متداول در پاسخ‌برگ */}
                <div className="pt-3 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground block mb-2 font-medium">تنظیم سریع مقادیر:</span>
                  <div className="flex flex-wrap gap-2">
                    {[0, 12, 18, 24, 25, 36, 42, 50, 64, 75, 84, 95].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={readOnly}
                        onClick={() => onSelectNumeric?.(currentQuestion.questionNumber, preset)}
                        className={`px-3 py-1 text-xs font-mono font-bold rounded-xl border transition-all ${
                          numericValue === preset
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-muted/70 text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : currentQuestion.type === 'stage2_statements' || (currentQuestion.statements && currentQuestion.statements.length > 0) ? (
              <div className="space-y-3.5 mt-6">
                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary font-bold flex items-center justify-between">
                  <span>سیستم گزاره‌ای مرحله دوم (المپیاد زیست‌شناسی): برای هر گزاره وضعیت صحیح یا غلط را تعیین نمایید.</span>
                  <span className="text-[11px] font-mono opacity-80">۵ گزاره تحلیلی</span>
                </div>

                {currentQuestion.statements?.map((stmt, sIdx) => {
                  const stmtNum = sIdx + 1;
                  const currentVal = selectedStatements ? selectedStatements[stmtNum] : null;

                  return (
                    <div
                      key={stmt.id || sIdx}
                      className="p-4 rounded-2xl border border-border bg-card/80 hover:bg-muted/40 transition-all space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0 font-bold text-xs">
                          {stmt.label || ['الف', 'ب', 'ج', 'د', 'هـ'][sIdx]}
                        </span>
                        <p className="text-sm leading-relaxed text-foreground flex-1">
                          {stmt.text}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-border/50">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            if (readOnly) return;
                            onSelectStatement?.(currentQuestion.questionNumber, stmtNum, currentVal === true ? null : true);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            readOnly ? 'cursor-not-allowed opacity-60' : ''
                          } ${
                            currentVal === true
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/40 scale-105'
                              : 'bg-muted/80 hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground border border-border'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>صحیح (ص / T)</span>
                        </button>

                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            if (readOnly) return;
                            onSelectStatement?.(currentQuestion.questionNumber, stmtNum, currentVal === false ? null : false);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            readOnly ? 'cursor-not-allowed opacity-60' : ''
                          } ${
                            currentVal === false
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-500/40 scale-105'
                              : 'bg-muted/80 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground border border-border'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>غلط (غ / F)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 mt-6">
                {currentQuestion.options?.map((optionText, idx) => {
                  const optNumber = idx + 1;
                  const isSelected = selectedOption === optNumber;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (readOnly) return;
                        onSelectOption(currentQuestion.questionNumber, optNumber);
                      }}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-50 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                          : 'border-border bg-card hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-xs transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'border border-border text-muted-foreground bg-muted'
                        }`}
                      >
                        {optNumber}
                      </div>
                      <span className="text-sm leading-relaxed mt-0.5">{optionText}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* نوار فوتر فیکس و دائمی در پایین سوال (شامل ناوبری بعدی/قبلی و پاک کردن پاسخ بدون انتخاب گزینه) */}
      <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur-md p-2.5 sm:p-3.5 px-3 sm:px-6 flex items-center justify-between gap-2 z-20 shadow-lg">
        <div className="flex items-center gap-2">
          {selectedOption || (selectedStatements && Object.values(selectedStatements).some((v) => v !== null && v !== undefined)) ? (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => {
                if (readOnly) return;
                onClearOption(currentQuestion.questionNumber);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs text-destructive hover:bg-destructive/10 rounded-xl transition-colors font-medium border border-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title="پاک کردن گزینه یا گزاره‌های انتخابی این سوال"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاک کردن پاسخ</span>
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              پاسخی انتخاب نشده است
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevQuestion}
            disabled={activeQuestionNumber <= 1}
            className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold border border-border rounded-xl disabled:opacity-40 hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="hidden xs:inline">سوال</span> قبلی
          </button>
          <button
            type="button"
            onClick={handleNextQuestion}
            disabled={activeQuestionNumber >= totalQuestions}
            className="flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-bold text-black bg-[#FFCC00] hover:bg-[#E6B800] rounded-xl disabled:opacity-40 transition-colors shadow-sm shadow-[#FFCC00]/20"
          >
            <span className="hidden xs:inline">سوال</span> بعدی
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
