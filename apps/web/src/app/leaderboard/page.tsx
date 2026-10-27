'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Medal,
  Award,
  Users,
  ShieldCheck,
  ArrowLeft,
  Search,
  Sparkles,
  BookOpen,
  ChevronLeft,
  Flame,
} from 'lucide-react';
import { formatPersianNumber } from '@condorlab/shared';

interface ExamLeaderboardSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  categoryTitle: string;
  campbellVolumes?: number[];
  totalQuestions: number;
  durationMinutes: number;
  totalOfficialParticipants: number;
  topScorePercentage: number;
  topParticipantName: string;
  status: string;
}

export default function LeaderboardDirectoryPage() {
  const [exams, setExams] = useState<ExamLeaderboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'لیدربورد کشوری و اسکوربورد المپیاد زیست‌شناسی | کندرلب';

    async function fetchLeaderboardList() {
      try {
        setLoading(true);
        const res = await fetch('/api/leaderboard', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) {
          setExams(json.data);
        }
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboardList();
  }, []);

  const categories = [
    { id: 'all', label: 'همه آزمون‌ها' },
    { id: 'campbell', label: 'بیولوژی کمپبل' },
    { id: 'stage1', label: 'مرحله اول المپیاد' },
    { id: 'stage2', label: 'مرحله دوم و مسئله‌محور' },
  ];

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesCategory = selectedCategory === 'all' || exam.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        exam.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        exam.categoryTitle.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesCategory && matchesSearch;
    });
  }, [exams, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0E0F12] text-foreground font-sans pb-24">
      {/* هدر باشکوه بخش لیدربورد کشوری */}
      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#18191E] via-[#121318] to-[#0E0F12] pt-12 pb-14">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FFCC00]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FFCC00]/10 border border-[#FFCC00]/25 text-[#FFCC00] text-xs font-bold mb-4 shadow-sm">
            <Trophy className="w-4 h-4 text-[#FFCC00]" />
            <span>اسکوربورد رسمی المپیاد زیست‌شناسی ایران</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-3">
            جدول رتبه‌بندی و لیدربورد کشوری آزمون‌ها
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-2xl leading-relaxed">
            مشاهده رتبه‌های رسمی، اسامی نفرات برتر، تفکیک شهر و مدارس داوطلبان المپیاد زیست‌شناسی کشور،
            با سیستم نمره‌دهی رسمی و رتبه‌بندی استاندارد المپیادی ($۱، ۲، ۲، ۴$).
          </p>

          {/* نوار جستجو و فیلتر دسته‌بندی */}
          <div className="mt-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-[#FFCC00] text-black shadow-md shadow-[#FFCC00]/20'
                      : 'bg-[#181A20] text-gray-300 hover:text-white hover:bg-[#20232B] border border-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-gray-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام آزمون..."
                className="w-full bg-[#181A20] border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/60 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* محتوای کارت‌های آزمون */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-3xl bg-[#14161C] border border-white/5 p-6 animate-pulse space-y-4">
                <div className="h-5 bg-white/10 rounded-lg w-3/4" />
                <div className="h-4 bg-white/5 rounded-lg w-1/2" />
                <div className="h-20 bg-white/5 rounded-2xl" />
                <div className="h-10 bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-16 bg-[#14161C] border border-white/5 rounded-3xl p-8 space-y-4">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto" />
            <h3 className="text-base font-bold text-white">هیچ آزمونی مطابق جستجو یافت نشد</h3>
            <p className="text-xs text-gray-400">لطفاً فیلتر دسته‌بندی یا عبارت جستجوی خود را تغییر دهید.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <div
                key={exam.slug}
                className="group relative rounded-3xl bg-[#14161C] border border-white/5 hover:border-[#FFCC00]/40 transition-all duration-300 p-6 flex flex-col justify-between shadow-xl hover:shadow-[#FFCC00]/5 flex-1"
              >
                <div>
                  {/* برچسب‌های متادیتا */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-[11px] font-medium border border-white/5">
                      {exam.categoryTitle}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#FFCC00]/10 text-[#FFCC00] text-[11px] font-bold border border-[#FFCC00]/20 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{formatPersianNumber(exam.totalOfficialParticipants)} داوطلب</span>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-[#FFCC00] transition-colors leading-snug mb-3">
                    {exam.title}
                  </h3>

                  {/* جلد‌های کمپبل */}
                  {exam.campbellVolumes && exam.campbellVolumes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-4">
                      {exam.campbellVolumes.map((vol) => (
                        <span
                          key={vol}
                          className="px-2 py-0.5 rounded-md bg-[#222632] text-gray-300 text-[10px] font-mono border border-white/5"
                        >
                          جلد {vol}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-500 mr-1">
                        • {formatPersianNumber(exam.totalQuestions)} سؤال • {formatPersianNumber(exam.durationMinutes)} دقیقه
                      </span>
                    </div>
                  )}

                  {/* پیش‌نمایش رتبه برتر */}
                  <div className="p-3.5 rounded-2xl bg-[#1B1E26] border border-white/5 mb-6 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-gray-400 text-[11px]">
                      <span className="flex items-center gap-1 text-[#FFCC00]">
                        <Medal className="w-3.5 h-3.5" />
                        نفر اول اسکوربورد:
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {exam.topScorePercentage}%
                      </span>
                    </div>
                    <div className="text-white font-bold truncate">
                      {exam.topParticipantName}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/leaderboard/${exam.slug}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#E6B800] text-black text-xs font-bold transition-all shadow-md shadow-[#FFCC00]/15"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>مشاهده جدول رتبه‌بندی آزمون</span>
                  <ArrowLeft className="w-3.5 h-3.5 mr-auto" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
