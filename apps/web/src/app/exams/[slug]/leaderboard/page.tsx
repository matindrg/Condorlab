'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { LeaderboardResponse, LeaderboardEntry, formatGrade } from '@condorlab/shared';
import {
  Trophy,
  Medal,
  Award,
  Users,
  ShieldCheck,
  ArrowRight,
  Filter,
  CheckCircle2,
  Sparkles,
  School,
  MapPin,
  GraduationCap,
  Percent,
  Clock,
} from 'lucide-react';

export default function ExamLeaderboardPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  useEffect(() => {
    if (leaderboard?.examTitle) {
      document.title = `اسکوربورد رسمی ${leaderboard.examTitle} | کندرلب`;
    }
  }, [leaderboard?.examTitle]);

  useEffect(() => {
    if (!slug) return;

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const query = gradeFilter !== 'all' ? `?grade=${gradeFilter}` : '';
        const res = await fetch(`/api/leaderboard/${slug}${query}`, { cache: 'no-store' });
        const json = await res.json();

        if (res.ok && json.success) {
          setLeaderboard(json.data);
        } else {
          setError(json.message || 'خطا در بارگذاری جدول رتبه‌بندی.');
        }
      } catch (e: any) {
        setError('خطا در برقراری ارتباط با سرور.');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [slug, gradeFilter]);

  const gradeOptions = useMemo(
    () => [
      { id: 'all', label: 'همه پایه‌ها' },
      { id: '10', label: formatGrade('10') },
      { id: '11', label: formatGrade('11') },
      { id: '9', label: formatGrade('9') },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[#0E0F12] text-foreground font-sans pb-16">
      {/* هدر بالای صفحه لیدربورد */}
      <div className="border-b border-white/5 bg-gradient-to-b from-[#18191E] to-[#0E0F12] pt-8 pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link href="/exams" className="hover:text-white transition-colors">
              آزمون‌ها
            </Link>
            <span>/</span>
            <Link href={`/exams/${slug}`} className="hover:text-white transition-colors">
              {leaderboard?.examTitle || 'جزئیات آزمون'}
            </Link>
            <span>/</span>
            <span className="text-[#FFCC00]">اسکوربورد رسمی</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#FFCC00]/15 text-[#FFCC00] text-xs font-bold border border-[#FFCC00]/30 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  اسکوربورد رسمی
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  رتبه‌بندی استاندارد المپیاد (۱، ۲، ۲، ۴)
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight">
                {leaderboard?.examTitle || 'جدول رتبه‌بندی آزمون المپیاد'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-2">
                رتبه‌بندی جامعه‌ی رسمی داوطلبان • تصحیح خودکار با کلید نسخه {leaderboard?.keyVersionNumber || 1}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/exams/${slug}`}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
              >
                <span>بازگشت به صفحه آزمون</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* کارت وضعیت کاربر جاری در صورت شرکت در آزمون */}
          {leaderboard?.currentUserEntry && (
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-[#FFCC00]/10 to-transparent border border-[#FFCC00]/40 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFCC00] text-black font-black text-sm flex items-center justify-center shadow-md">
                  #{leaderboard.currentUserEntry.rank}
                </div>
                <div>
                  <div className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    جایگاه شما در اسکوربورد رسمی
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">
                    {leaderboard.currentUserEntry.displayName} • {leaderboard.currentUserEntry.grade}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="text-left">
                  <div className="text-[10px] text-gray-400 font-sans">درصد رسمی</div>
                  <div className="text-base font-black text-emerald-400">
                    {leaderboard.currentUserEntry.percentage.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* محتوای اصلی و جدول */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {/* فیلتر پایه تحصیلی (فکت عمومی R-66) - استیکی با ترنسپرنسی و بلور بدون گلیچ مشکی */}
        <div className="sticky top-16 z-30 bg-[#0E0F12]/85 backdrop-blur-md border-b border-white/10 py-3.5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mb-6 transition-all shadow-md shadow-black/20">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs text-gray-400 flex items-center gap-1.5 pl-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              پایه:
            </span>
            {gradeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setGradeFilter(opt.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                  gradeFilter === opt.id
                    ? 'bg-[#FFCC00] text-black border-[#FFCC00] shadow-md shadow-[#FFCC00]/20 font-black'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span>مجموع داوطلبان رسمی: <strong className="text-white font-mono">{leaderboard?.totalOfficialParticipants || 0}</strong> نفر</span>
          </div>
        </div>

        {/* خط‌مشی حریم خصوصی طبق PRD ۵٫۳٫۹ */}
        <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            سیاست حریم خصوصی کندرلب: اطلاعات تماس داوطلبان هرگز منتشر نمی‌شود. در صورت انتخاب داوطلب، نام به‌صورت ناشناس نمایش می‌یابد.
          </span>
        </div>

        {/* وضعیت لودینگ یا خطا */}
        {loading ? (
          <div className="p-16 text-center text-gray-400 space-y-3 rounded-3xl bg-[#141519] border border-white/5">
            <div className="w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">در حال بارگذاری اسکوربورد و محاسبه رتبه‌های رسمی...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-400 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-2">
            <p>{error}</p>
            <button
              onClick={() => setGradeFilter('all')}
              className="text-white underline text-xs font-bold"
            >
              نمایش همه پایه‌ها
            </button>
          </div>
        ) : !leaderboard || leaderboard.entries.length === 0 ? (
          <div className="p-16 text-center text-gray-400 space-y-3 rounded-3xl bg-[#141519] border border-white/5">
            <Trophy className="w-10 h-10 text-gray-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">هنوز داوطلبی در این آزمون ثبت نهایی نکرده است</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              به‌محض پایان بازه رسمی و ثبت پاسخ‌برگ‌ها، نتایج و رتبه‌بندی‌های رسمی در این جدول منتشر می‌گردد.
            </p>
          </div>
        ) : (
          /* جدول اسکوربورد رسمی */
          <div className="rounded-3xl bg-[#141519] border border-white/5 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 font-bold">
                    <th className="py-3.5 px-4 text-center w-16">رتبه</th>
                    <th className="py-3.5 px-4">داوطلب</th>
                    <th className="py-3.5 px-4">پایه تحصیلی</th>
                    <th className="py-3.5 px-4">شهر و مدرسه</th>
                    <th className="py-3.5 px-4 text-left">درصد رسمی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaderboard.entries.map((entry) => {
                    const isTop1 = entry.rank === 1;
                    const isTop2 = entry.rank === 2;
                    const isTop3 = entry.rank === 3;

                    return (
                      <tr
                        key={entry.userId}
                        className={`transition-colors ${
                          entry.isCurrentUser
                            ? 'bg-[#FFCC00]/10 font-bold border-l-4 border-[#FFCC00]'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* رتبه با مدال */}
                        <td className="py-3.5 px-4 text-center font-black">
                          {isTop1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-black font-black text-xs shadow-md shadow-amber-400/20">
                              🥇 ۱
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-black font-black text-xs shadow-md">
                              🥈 ۲
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs shadow-md">
                              🥉 ۳
                            </span>
                          ) : (
                            <span className="font-mono text-gray-400 font-bold">
                              {entry.rank}
                            </span>
                          )}
                        </td>

                        {/* نام داوطلب */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">
                              {entry.displayName}
                            </span>
                            {entry.isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFCC00] text-black font-black">
                                شما
                              </span>
                            )}
                          </div>
                        </td>

                        {/* پایه تحصیلی */}
                        <td className="py-3.5 px-4 text-gray-300 font-medium">
                          {entry.grade}
                        </td>

                        {/* شهر و مدرسه */}
                        <td className="py-3.5 px-4 text-gray-400">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{entry.city}</span>
                            {entry.school && entry.school !== 'نامشخص' && (
                              <span className="text-gray-500">• {entry.school}</span>
                            )}
                          </div>
                        </td>

                        {/* درصد رسمی */}
                        <td className="py-3.5 px-4 text-left">
                          <span
                            className={`font-mono font-black text-sm ${
                              entry.percentage > 50
                                ? 'text-emerald-400'
                                : entry.percentage > 0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {entry.percentage.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
