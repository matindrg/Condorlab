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
  Layers,
  BookOpen,
} from 'lucide-react';

export interface ExamQuestionView {
  id: number;
  questionNumber: number;
  chapter: number;
  topic: string;
  stem: string;
  options: [string, string, string, string];
  pdfPage: number;
}

interface DualViewContainerProps {
  questions: ExamQuestionView[];
  activeQuestionNumber: number;
  selectedOption: number | null;
  isFlagged: boolean;
  onSelectQuestion: (qNum: number) => void;
  onSelectOption: (qNum: number, opt: number) => void;
  onClearOption: (qNum: number) => void;
  onToggleFlag: (qNum: number) => void;
}

export function DualViewContainer({
  questions,
  activeQuestionNumber,
  selectedOption,
  isFlagged,
  onSelectQuestion,
  onSelectOption,
  onClearOption,
  onToggleFlag,
}: DualViewContainerProps) {
  const [viewMode, setViewMode] = useState<'pdf' | 'web'>('pdf');
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
    <div className="flex flex-col h-full bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
      {/* سوییچر بالای ناحیه محتوا */}
      <div className="p-3 border-b border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3">
        {/* انتخابگر دوحالته PDF / وب تکی */}
        <div className="inline-flex p-1 bg-muted rounded-2xl border border-border">
          <button
            type="button"
            onClick={() => {
              setViewMode('pdf');
              if (currentQuestion?.pdfPage) setPdfPage(currentQuestion.pdfPage);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'pdf'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            فایل PDF آزمون (دفترچه)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('web')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'web'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5 text-primary" />
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

      {/* محتوای بدنه (دو حالته) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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

                        {/* گزینه‌های چهارگانه */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                          {q.options.map((opt, optIdx) => {
                            const optNumber = optIdx + 1;
                            const isOptSelected = selectedOption === optNumber && isCurrent;
                            return (
                              <div
                                key={optIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectQuestion(q.questionNumber);
                                  onSelectOption(q.questionNumber, optNumber);
                                }}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed transition-all cursor-pointer ${
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
                onClick={() => onToggleFlag(currentQuestion.questionNumber)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
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

            {/* گزینه‌های تعاملی ۴ گانه */}
            <div className="space-y-3 mt-6">
              {currentQuestion.options.map((optionText, idx) => {
                const optNumber = idx + 1;
                const isSelected = selectedOption === optNumber;

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectOption(currentQuestion.questionNumber, optNumber)}
                    className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-50 shadow-md shadow-emerald-500/10'
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

            {/* کلیدهای پاک کردن و ناوبری */}
            <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
              <div>
                {selectedOption && (
                  <button
                    type="button"
                    onClick={() => onClearOption(currentQuestion.questionNumber)}
                    className="flex items-center gap-1.5 text-xs text-destructive hover:underline font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    پاک کردن گزینه انتخابی
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevQuestion}
                  disabled={activeQuestionNumber <= 1}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-border rounded-xl disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  سؤال قبلی
                </button>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={activeQuestionNumber >= totalQuestions}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-sm"
                >
                  سؤال بعدی
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
