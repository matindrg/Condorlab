'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExamSummary, messagesFa } from '@condorlab/shared';

const CAMPBELL_FILTERS = [
  { id: 0, label: 'همه آزمون‌ها' },
  { id: 1, label: 'جلد ۱: شیمی حیات' },
  { id: 2, label: 'جلد ۲: سلول و متابولیسم' },
  { id: 3, label: 'جلد ۳: ژنتیک' },
  { id: 4, label: 'جلد ۴: سازوکار تکامل' },
  { id: 5, label: 'جلد ۵: فیزیولوژی گیاهی' },
];

export default function ExamsCatalogPage() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedVolume > 0) queryParams.append('volume', selectedVolume.toString());
        if (search.trim()) queryParams.append('search', search.trim());

        const res = await fetch(`/api/exams?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
          setExams(data.data);
        }
      } catch (err) {
        console.error('Failed to load exams catalog:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExams();
  }, [selectedVolume, search]);

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

        {/* جستجو */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="جستجو در آزمون‌های کمپبل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] px-4 rounded-xl bg-[#181818] border border-[#333333] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00]/20 transition-all"
          />
        </div>
      </div>

      {/* فیلترهای سرفصل کمپبل */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
        {CAMPBELL_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedVolume(f.id)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 select-none ${
              selectedVolume === f.id
                ? 'bg-[#FFCC00] text-black font-bold shadow-md shadow-[#FFCC00]/10'
                : 'bg-[#181818] text-gray-400 hover:text-white border border-[#2E2E2E]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* لیست و کارت‌های آزمون */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-h-[280px] rounded-2xl bg-[#181818] border border-[#2A2A2A] p-6 animate-pulse">
              <div className="w-24 h-5 bg-white/10 rounded-md mb-4"></div>
              <div className="w-3/4 h-7 bg-white/10 rounded-md mb-3"></div>
              <div className="w-1/2 h-4 bg-white/10 rounded-md mb-8"></div>
              <div className="w-full h-10 bg-white/10 rounded-xl mt-auto"></div>
            </div>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-20 bg-[#161616] rounded-2xl border border-[#262626]">
          <span className="text-4xl mb-3 block">🔍</span>
          <h3 className="text-lg font-bold text-white mb-2">آزمونی با مشخصات انتخابی یافت نشد</h3>
          <p className="text-sm text-gray-400">لطفاً فیلتر جلد کمپبل را تغییر داده یا عبارت دیگری جستجو فرمایید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col rounded-2xl bg-[#181818] border border-[#2E2E2E] hover:border-[#FFCC00]/50 p-6 transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-[#FFCC00]/5 text-right"
            >
              {/* نشان جلدها و وضعیت */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {exam.campbellVolumes.map((v) => (
                    <span
                      key={v}
                      className="px-2.5 py-1 rounded-md bg-[#252525] border border-[#3A3A3A] text-[11px] text-[#FFCC00] font-medium"
                    >
                      جلد {v} کمپبل
                    </span>
                  ))}
                </div>
                {exam.price === 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold">
                    پایلوت رایگان
                  </span>
                )}
              </div>

              {/* عنوان آزمون */}
              <h2 className="text-lg font-bold text-white leading-snug mb-3">{exam.title}</h2>

              {/* متادیتا */}
              <div className="space-y-2 text-xs text-gray-400 mb-6 font-medium">
                <div className="flex items-center gap-2">
                  <span>⏱️ مدت پاسخگویی:</span>
                  <span className="text-gray-200">{exam.durationMinutes} دقیقه ({exam.totalQuestions} سؤال تستی)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📅 تاریخ برگزاری:</span>
                  <span className="text-gray-200">{new Date(exam.startTime).toLocaleDateString('fa-IR')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🛡️ وضعیت پذیرش:</span>
                  <span className="text-green-400 font-semibold">صندلی رسمی دارای رتبه فعال</span>
                </div>
              </div>

              {/* قیمت و دکمه ورود */}
              <div className="mt-auto pt-4 border-t border-[#262626] flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">هزینه آزمون</span>
                  <span className="text-base font-black text-white">
                    {exam.price === 0 ? 'رایگان' : `${exam.price.toLocaleString('fa-IR')} تومان`}
                  </span>
                </div>
                <Link
                  href={`/exams/${exam.slug}`}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black font-bold text-xs hover:bg-[#E6B800] transition-colors flex items-center gap-1.5"
                >
                  <span>مشاهده و ثبت‌نام</span>
                  <span>←</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
