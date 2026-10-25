'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExamSummary, messagesFa } from '@condorlab/shared';
import { Search, Clock, Calendar, ShieldCheck, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'همه آزمون‌ها' },
  { id: 'stage1', label: 'شبیه‌ساز مرحله اول' },
  { id: 'stage2', label: 'مرحله دوم و پیشرفته' },
  { id: 'campbell', label: 'سرفصلی بیولوژی کمپبل' },
  { id: 'topical', label: 'موضوعی و تخصصی' },
];

export default function ExamsCatalogPage() {
  const { isEnrolled } = useAuth();
  const [allExams, setAllExams] = useState<ExamSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMac, setIsMac] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const platform = (window.navigator as any)?.userAgentData?.platform || window.navigator.platform || window.navigator.userAgent || '';
      setIsMac(/mac/i.test(platform));
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // واکشی آزمون‌ها از سرور: فقط یک‌بار در بارگذاری صفحه یا رفرش مرورگر
  const fetchExams = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/exams');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAllExams(data.data);
      }
    } catch (err) {
      console.error('Failed to load exams catalog:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // فیلتر آنی کلاینت‌ساید بر اساس دسته‌بندی و عبارت جستجو (بدون درخواست مجدد شبکه یا لودینگ)
  const filteredExams = React.useMemo(() => {
    return allExams.filter((exam) => {
      // ۱. فیلتر دسته‌بندی و برچسب‌ها
      if (selectedCategory !== 'all') {
        const cat = exam.category || '';
        const labels = exam.labels || [];
        const hasVol = exam.campbellVolumes && exam.campbellVolumes.length > 0;

        let matches = false;
        if (selectedCategory === 'stage1') {
          matches = cat === 'stage1' || labels.some((l) => l.includes('مرحله اول'));
        } else if (selectedCategory === 'stage2') {
          matches = cat === 'stage2' || labels.some((l) => l.includes('مرحله دوم') || l.includes('پیشرفته'));
        } else if (selectedCategory === 'campbell') {
          matches = cat === 'campbell' || hasVol || labels.some((l) => l.includes('کمپبل') || l.includes('سرفصلی'));
        } else if (selectedCategory === 'topical') {
          matches =
            cat === 'topical' ||
            labels.some((l) => l.includes('تخصصی') || l.includes('موضوعی') || l.includes('VIP') || l.includes('کارگاه'));
        } else {
          matches = cat === selectedCategory;
        }

        if (!matches) return false;
      }

      // ۲. فیلتر متنی جستجو
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesTitle = exam.title.toLowerCase().includes(q);
        const matchesLabels = exam.labels?.some((l) => l.toLowerCase().includes(q));
        const matchesVolumes = exam.campbellVolumes?.some(
          (v) => v.toString().includes(q) || `جلد ${v}`.includes(q),
        );
        if (!matchesTitle && !matchesLabels && !matchesVolumes) {
          return false;
        }
      }

      return true;
    });
  }, [allExams, selectedCategory, search]);

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-7xl mx-auto">
      {/* هدر کاتالوگ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#2A2A2A] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/" className="text-gray-400 hover:text-white text-xs sm:text-sm">
              خانه
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-[#FFCC00] text-xs sm:text-sm font-medium">کاتالوگ آزمون‌ها</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">کاتالوگ جامع آزمون‌های المپیاد زیست‌شناسی</h1>
        </div>

        {/* جستجو با شورتکات */}
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="w-full md:w-80 relative flex items-center cursor-text group"
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="جستجو در نام آزمون یا برچسب‌ها..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] pr-10 pl-16 rounded-xl bg-[#181818] border border-[#333333] group-hover:border-[#FFCC00]/50 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00]/20 transition-all"
          />
          <Search className="w-4 h-4 text-gray-500 group-hover:text-[#FFCC00] absolute right-3.5 pointer-events-none transition-colors" />
          <kbd
            onClick={(e) => {
              e.stopPropagation();
              searchInputRef.current?.focus();
            }}
            className="absolute left-2.5 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded cursor-pointer hover:text-[#FFCC00] hover:border-[#FFCC00]/30 transition-colors select-none"
            title="کلید میانبر فوکوس جستجو"
          >
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </div>
      </div>

      {/* فیلترهای دسته‌بندی هوشمند */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedCategory(f.id)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 select-none ${
              selectedCategory === f.id
                ? 'bg-[#FFCC00] text-black font-bold shadow-md shadow-[#FFCC00]/10'
                : 'bg-[#181818] text-gray-400 hover:text-white border border-[#2E2E2E]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* لیست و کارت‌های آزمون با بلور کامل و لودینگ دقیق (عدم نمایش دیفالت) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="min-h-[290px] rounded-2xl bg-[#16181D]/80 border border-[#2A2E39] p-6 skeleton-shimmer backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-2 mb-4">
                  <div className="w-20 h-6 bg-white/10 rounded-md"></div>
                  <div className="w-16 h-6 bg-white/10 rounded-md"></div>
                </div>
                <div className="w-4/5 h-6 bg-white/10 rounded-lg mb-4"></div>
                <div className="space-y-2.5">
                  <div className="w-2/3 h-4 bg-white/5 rounded"></div>
                  <div className="w-1/2 h-4 bg-white/5 rounded"></div>
                </div>
              </div>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="w-24 h-6 bg-white/10 rounded"></div>
                <div className="w-28 h-10 bg-white/10 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-20 bg-[#161616] rounded-2xl border border-[#262626]">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">آزمونی با مشخصات انتخابی یافت نشد</h3>
          <p className="text-sm text-gray-400">لطفاً فیلتر دسته‌بندی را تغییر داده یا عبارت دیگری جستجو فرمایید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam, index) => {
            const userHasEnrolled = exam.isEnrolled || isEnrolled(exam.id) || isEnrolled(exam.slug);
            return (
              <div
                key={exam.id}
                className={`flex flex-col rounded-2xl bg-[#181818] border ${
                  userHasEnrolled
                    ? 'border-green-500/40 bg-gradient-to-b from-[#18201A] to-[#141618]'
                    : 'border-[#2E2E2E] hover:border-[#FFCC00]/50'
                } p-6 transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-[#FFCC00]/5 text-right animate-stagger-${Math.min(index + 1, 4)}`}
              >
                {/* نشان‌ها، برچسب‌های دسته‌بندی و وضعیت صندلی */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {exam.labels && exam.labels.length > 0 ? (
                      exam.labels.map((lbl, lIdx) => (
                        <span
                          key={lIdx}
                          className="px-2.5 py-1 rounded-md bg-[#252525] border border-[#3A3A3A] text-[11px] text-[#FFCC00] font-medium"
                        >
                          {lbl}
                        </span>
                      ))
                    ) : exam.campbellVolumes && exam.campbellVolumes.length > 0 ? (
                      exam.campbellVolumes.map((v) => (
                        <span
                          key={v}
                          className="px-2.5 py-1 rounded-md bg-[#252525] border border-[#3A3A3A] text-[11px] text-[#FFCC00] font-medium"
                        >
                          جلد {v} کمپبل
                        </span>
                      ))
                    ) : null}
                  </div>
                  {userHasEnrolled ? (
                    <span className="px-2.5 py-1 rounded-md bg-green-500/15 border border-green-500/40 text-green-400 text-xs font-black flex items-center gap-1 shadow-sm shadow-green-500/10">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>صندلی شما فعال است</span>
                    </span>
                  ) : exam.price === 0 ? (
                    <span className="px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold">
                      پایلوت رایگان
                    </span>
                  ) : null}
                </div>

                {/* عنوان آزمون */}
                <h2 className="text-lg font-bold text-white leading-snug mb-3">{exam.title}</h2>

                {/* متادیتا */}
                <div className="space-y-2 text-xs text-gray-400 mb-6 font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span>مدت پاسخگویی:</span>
                    <span className="text-gray-200">{exam.durationMinutes} دقیقه ({exam.totalQuestions} سؤال تستی)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span>تاریخ برگزاری:</span>
                    <span className="text-gray-200">{new Date(exam.startTime).toLocaleDateString('fa-IR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {userHasEnrolled ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        <span>وضعیت دسترسی:</span>
                        <span className="text-green-400 font-bold">ثبت‌نام شده (صندلی رسمی محفوظ)</span>
                      </>
                    ) : exam.isCapacityFull ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span>وضعیت پذیرش:</span>
                        <span className="text-red-400 font-semibold">تکمیل ظرفیت صندلی‌ها</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        <span>وضعیت پذیرش:</span>
                        <span className="text-green-400 font-semibold">صندلی رسمی دارای رتبه فعال</span>
                      </>
                    )}
                  </div>
                </div>

                {/* قیمت و دکمه ورود */}
                <div className="mt-auto pt-4 border-t border-[#262626] flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 block">هزینه آزمون</span>
                    {userHasEnrolled ? (
                      <span className="text-sm font-black text-green-400">
                        در دارایی‌های شما
                      </span>
                    ) : (
                      <span className="text-base font-black text-white">
                        {exam.price === 0 ? 'رایگان' : `${exam.price.toLocaleString('fa-IR')} تومان`}
                      </span>
                    )}
                  </div>
                  {userHasEnrolled ? (
                    <Link
                      href={`/exams/${exam.slug}`}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-green-500/15 border border-green-500/40 text-green-400 font-bold text-xs hover:bg-green-500/25 transition-all flex items-center gap-1.5 shadow-sm shadow-green-500/10"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>مشاهده جزئیات صندلی</span>
                    </Link>
                  ) : exam.isCapacityFull ? (
                    <span className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gray-800 text-gray-400 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed select-none">
                      <span>تکمیل ظرفیت</span>
                    </span>
                  ) : (
                    <Link
                      href={`/exams/${exam.slug}`}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black font-bold text-xs hover:bg-[#E6B800] transition-colors flex items-center gap-1.5"
                    >
                      <span>مشاهده و ثبت‌نام</span>
                      <ArrowLeft className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
