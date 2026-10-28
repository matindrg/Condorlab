'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  AlertCircle,
  Bookmark,
  Printer,
  LayoutDashboard,
  Trophy,
  ArrowRight,
  Filter,
  Check,
  X,
  Hash,
} from 'lucide-react';
import { ExamQuestionView } from './dual-view-container';

export interface PostExamSummaryProps {
  examTitle: string;
  examSlug: string;
  submittedAt?: string;
  questions: ExamQuestionView[];
  answers: Record<
    number,
    {
      selectedOption: number | null;
      selectedStatements?: Record<number, boolean | null> | null;
      numericValue?: number | null;
      isFlagged: boolean;
    }
  >;
  summary: {
    totalQuestions: number;
    answeredCount: number;
    unansweredCount: number;
    flaggedCount: number;
  };
  studentName?: string;
}

export function PostExamSummary({
  examTitle,
  examSlug,
  submittedAt,
  questions,
  answers,
  summary,
  studentName,
}: PostExamSummaryProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<'all' | 'answered' | 'unanswered' | 'flagged'>('all');

  // قالب‌بندی زمان ثبت نهایی
  const formattedDate = useMemo(() => {
    if (!submittedAt) return 'هم‌اکنون';
    try {
      const d = new Date(submittedAt);
      return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return submittedAt;
    }
  }, [submittedAt]);

  const total = summary.totalQuestions || questions.length || 60;
  const answered = summary.answeredCount;
  const unanswered = summary.unansweredCount;
  const flagged = summary.flaggedCount;
  const completionPercentage = Math.round((answered / (total || 1)) * 100);

  // پالایش سوالات بر اساس تب انتخابی
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const ans = answers[q.questionNumber];
      const hasOption = ans?.selectedOption !== null && ans?.selectedOption !== undefined && ans.selectedOption > 0;
      const hasStatements =
        ans?.selectedStatements &&
        Object.values(ans.selectedStatements).some((v) => v !== null && v !== undefined);
      const hasNumeric = ans?.numericValue !== null && ans?.numericValue !== undefined;
      const isAnswered = hasOption || hasStatements || hasNumeric;
      const isFlagged = ans?.isFlagged;

      if (filterMode === 'answered') return isAnswered;
      if (filterMode === 'unanswered') return !isAnswered;
      if (filterMode === 'flagged') return isFlagged;
      return true;
    });
  }, [questions, answers, filterMode]);

  return (
    <div className="min-h-screen bg-[#121212] text-gray-100 p-4 sm:p-6 lg:p-10 font-sans selection:bg-[#FFCC00] selection:text-black">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ۱. نشان وضعیت و هدر اصلی */}
        <div className="relative overflow-hidden rounded-3xl bg-[#1A1D24] border border-[#2B303D] p-6 sm:p-8 shadow-2xl text-right">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#FFCC00]/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>پاسخ‌برگ شما با موفقیت در سرور مرکزی ثبت نهایی شد</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                {examTitle || 'شبیه‌ساز تحلیلی المپیاد زیست‌شناسی'}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-4 h-4 text-[#FFCC00]" />
                  زمان ثبت نهایی: <strong className="text-gray-200">{formattedDate}</strong>
                </span>
                {studentName && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    داوطلب: <strong className="text-white">{studentName}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* دکمه‌های اقدام سریع بالا */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ پاسخ‌برگ</span>
              </button>
              <Link
                href={`/exams/${examSlug}/leaderboard`}
                className="px-5 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-bold text-xs transition-all shadow-lg shadow-[#FFCC00]/20 flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                <span>مشاهده لیدربورد و کارنامه</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ۲. کارت‌های آماری کلیدی */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#181B22] border border-[#2E3340] text-right space-y-1">
            <span className="text-xs text-gray-400 font-medium">کل سؤالات آزمون</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">{total}</div>
            <div className="text-[11px] text-gray-500">سؤالات مصوب دفترچه</div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#181B22] border border-emerald-500/30 text-right space-y-1">
            <span className="text-xs text-emerald-400 font-medium">پاسخ‌داده‌شده</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">{answered}</div>
            <div className="text-[11px] text-emerald-500/80 font-mono">
              پوشش {completionPercentage}٪ دفترچه
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#181B22] border border-[#2E3340] text-right space-y-1">
            <span className="text-xs text-gray-400 font-medium">نزده (سفید)</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-gray-300">{unanswered}</div>
            <div className="text-[11px] text-gray-500">بدون نمره منفی</div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#181B22] border border-amber-500/30 text-right space-y-1">
            <span className="text-xs text-amber-400 font-medium">نشان‌دار برای مرور</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{flagged}</div>
            <div className="text-[11px] text-amber-500/80">علامت‌گذاری حین آزمون</div>
          </div>
        </div>

        {/* ۳. نوار فیلتر و ابزار نمایش پاسخ‌برگ */}
        <div className="p-4 rounded-2xl bg-[#181B22] border border-[#2B303D] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-300 w-full sm:w-auto">
            <FileCheck2 className="w-4 h-4 text-[#FFCC00]" />
            <span>خلاصه تصویری گزینه‌های انتخابی شما در پاسخ‌برگ:</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#121418] p-1 rounded-xl border border-white/5 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-[#FFCC00] text-black shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              همه ({total})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('answered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'answered'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-gray-400 hover:text-emerald-400 hover:bg-white/5'
              }`}
            >
              پاسخ‌داده ({answered})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unanswered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'unanswered'
                  ? 'bg-gray-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              نزده ({unanswered})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('flagged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'flagged'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-gray-400 hover:text-amber-400 hover:bg-white/5'
              }`}
            >
              نشان‌دار ({flagged})
            </button>
          </div>
        </div>

        {/* ۴. شبکه بصری پاسخ‌برگ داوطلب (Visual Read-Only OMR Grid) */}
        <div className="rounded-3xl bg-[#16181F] border border-[#2B303D] p-4 sm:p-6 shadow-xl">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              هیچ سؤالی با فیلتر انتخابی شما یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredQuestions.map((q) => {
                const ans = answers[q.questionNumber];
                const isFlagged = Boolean(ans?.isFlagged);
                const isStage2Statements = q.type === 'stage2_statements' || Boolean(q.statements && q.statements.length > 0);
                const isNumeric = q.type === 'numeric';

                return (
                  <div
                    key={q.questionNumber}
                    className={`p-3.5 rounded-2xl bg-[#1D2028] border transition-all text-right ${
                      isFlagged
                        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                        : 'border-[#2E3340] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-white font-mono font-bold text-xs flex items-center justify-center">
                          {q.questionNumber}
                        </span>
                        <span className="text-[11px] text-gray-400 truncate max-w-[150px]">
                          {isStage2Statements
                            ? '۵ گزاره‌ای (ص / غ)'
                            : isNumeric
                            ? 'محاسباتی (۰ تا ۹۹)'
                            : 'چهار گزینه‌ای'}
                        </span>
                      </div>
                      {isFlagged && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Bookmark className="w-3 h-3 fill-amber-400" />
                          نشان‌دار
                        </span>
                      )}
                    </div>

                    {/* حالت ۱: سؤال گزاره‌ای ۵‌تایی مرحله دو المپیاد (صحیح / غلط استاندارد) */}
                    {isStage2Statements ? (
                      <div className="grid grid-cols-5 gap-1 pt-1">
                        {['الف', 'ب', 'ج', 'د', 'هـ'].map((lbl, idx) => {
                          const val = ans?.selectedStatements?.[idx];
                          const hasVal = val !== null && val !== undefined;
                          return (
                            <div
                              key={lbl}
                              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-[11px] font-bold ${
                                hasVal
                                  ? val === true
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                    : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                                  : 'bg-white/5 border-white/5 text-gray-500'
                              }`}
                            >
                              <span className="text-[9px] text-gray-400 mb-0.5">{lbl}</span>
                              <span className="font-bold">
                                {hasVal ? (val === true ? 'ص' : 'غ') : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : isNumeric ? (
                      /* حالت ۲: سؤال محاسباتی کوتاه‌پاسخ عددی ۰ تا ۹۹ */
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#14161C] border border-white/5">
                        <span className="text-xs text-gray-400 flex items-center gap-1.5 font-mono">
                          <Hash className="w-3.5 h-3.5 text-[#FFCC00]" />
                          مقدار عددی:
                        </span>
                        <span
                          className={`font-mono font-black text-sm px-3 py-0.5 rounded-lg ${
                            ans?.numericValue !== null && ans?.numericValue !== undefined
                              ? 'bg-[#FFCC00]/15 text-[#FFCC00] border border-[#FFCC00]/30'
                              : 'text-gray-500'
                          }`}
                        >
                          {ans?.numericValue !== null && ans?.numericValue !== undefined
                            ? ans.numericValue
                            : 'بدون پاسخ'}
                        </span>
                      </div>
                    ) : (
                      /* حالت ۳: سؤال تستی ۴ یا ۵ گزینه‌ای */
                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        {[1, 2, 3, 4].map((opt) => {
                          const isSelected = ans?.selectedOption === opt;
                          return (
                            <div
                              key={opt}
                              className={`flex-1 flex items-center justify-center py-1.5 rounded-xl border font-mono text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-[#FFCC00] text-black border-[#FFCC00] shadow-sm shadow-[#FFCC00]/20'
                                  : 'bg-[#14161C] border-white/5 text-gray-400'
                              }`}
                            >
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                        {ans?.selectedOption === null || ans?.selectedOption === undefined || ans.selectedOption === 0 ? (
                          <span className="text-[10px] text-gray-500 mr-1 whitespace-nowrap">نزده</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ۵. یادداشت نهایی و پیوندهای راهنما */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-right text-xs text-gray-400 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-2 text-gray-300 font-bold">
            <AlertCircle className="w-4 h-4 text-[#FFCC00]" />
            <span>زمان انتشار کارنامه تفصیلی و تحلیل مبحثی فصول کمپبل:</span>
          </div>
          <p>
            طبق پروتکل رسمی المپیاد زیست‌شناسی کندرلب، پس از بسته شدن سراسری پنجره آزمون و ثبت نهایی کلیه شرکت‌کنندگان،
            کارنامه کامل شما به همراه نمودار تسلط مبحثی، درصد انحراف از میانگین کشوری و پاسخ‌نامه تشریحی در داشبورد منتشر خواهد شد.
          </p>
        </div>

        {/* ۶. فوتر ناوبری و بازگشت */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push('/student/dashboard')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1E212A] hover:bg-[#262B36] text-gray-200 hover:text-white border border-white/10 font-bold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4 text-[#FFCC00]" />
            <span>بازگشت به داشبورد داوطلب</span>
          </button>

          <Link
            href={`/exams/${examSlug}/leaderboard`}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs transition-all shadow-lg shadow-[#FFCC00]/20 flex items-center justify-center gap-2"
          >
            <span>ورود به اسکوربورد و رتبه‌بندی کشوری</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
