'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  PackageCheck,
  Users,
  Activity,
  Plus,
  RefreshCw,
  ExternalLink,
  Clock,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{
    totalExams: number;
    totalUsers: number;
    totalAttempts: number;
    publishedExams: number;
  }>({
    totalExams: 0,
    totalUsers: 0,
    totalAttempts: 0,
    publishedExams: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const [examsRes, usersRes] = await Promise.all([
          fetch('/api/admin/exams').catch(() => null),
          fetch('/api/admin/users').catch(() => null),
        ]);

        let exams = [];
        let users = [];

        if (examsRes && examsRes.ok) {
          const exData = await examsRes.json();
          if (exData.success && Array.isArray(exData.data)) {
            exams = exData.data;
          }
        }

        if (usersRes && usersRes.ok) {
          const usData = await usersRes.json();
          if (usData.success && Array.isArray(usData.data)) {
            users = usData.data;
          }
        }

        const published = exams.filter((e: any) => e.status === 'Published').length;
        const attemptsCount = exams.reduce((acc: number, e: any) => acc + (e.attemptsCount || 0), 0);

        setStats({
          totalExams: exams.length,
          totalUsers: users.length,
          totalAttempts: attemptsCount,
          publishedExams: published,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8" dir="rtl">
      {/* هدر صفحه پیشخوان */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>مرکز پایش و کنترل آزمون‌ها</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">پیشخوان مدیریت کندرلب</h1>
          <p className="text-xs text-gray-400 mt-1">
            پایش بلادرنگ وضعیت آزمون‌ها، ظرفیت صندلی‌ها، مدیریت بانک سؤال و تسویه‌حساب‌ها
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/exams"
            className="px-4 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs transition-all shadow-lg shadow-[#FFCC00]/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف آزمون جدید</span>
          </Link>
        </div>
      </div>

      {/* کارت‌های آماری کلیدی */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#14161C] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">کل آزمون‌های رسمی</span>
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {loading ? '...' : stats.totalExams}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <span>{stats.publishedExams} آزمون منتشر شده و فعال</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#14161C] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">داوطلبان ثبت‌نام‌شده</span>
            <div className="p-2 rounded-xl bg-blue-400/10 text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {loading ? '...' : stats.totalUsers}
          </div>
          <div className="text-[11px] text-gray-400">
            شامل پایه‌های دهم، یازدهم و داوطلبان آزاد
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#14161C] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">تلاش‌های آزمون (Attempts)</span>
            <div className="p-2 rounded-xl bg-purple-400/10 text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {loading ? '...' : stats.totalAttempts}
          </div>
          <div className="text-[11px] text-gray-400">
            تلاش‌های ثبت‌شده در پایلوت ۱ و ۲
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#14161C] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">وضعیت پایگاه‌داده</span>
            <div className="p-2 rounded-xl bg-emerald-400/10 text-emerald-400">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-400">
            متصل و همگام
          </div>
          <div className="text-[11px] text-gray-400">
            کش دولایه Stale-While-Revalidate فعال
          </div>
        </div>
      </div>

      {/* بخش دسترسی‌های سریع */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white">دسترسی‌های سریع مدیریتی</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/exams"
            className="p-5 rounded-3xl bg-[#14161C] border border-white/5 hover:border-amber-500/40 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center border border-amber-400/20 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                مدیریت آزمون‌ها و زمان‌بندی
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                تنظیم بازه برگزاری (Time-Window)، مدت زمان آزمون برای داوطلب، سقف ظرفیت صندلی و وضعیت انتشار.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 pt-2">
              <span>ورود به مدیریت آزمون‌ها</span>
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/products"
            className="p-5 rounded-3xl bg-[#14161C] border border-white/5 hover:border-amber-500/40 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center border border-emerald-400/20 group-hover:scale-110 transition-transform">
                <PackageCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                محصولات و ابطال کش فروشگاه
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                ویرایش قیمت آزمون‌ها، مدیریت تخفیف‌ها و دکمه ابطال دستی کش سمت سرور و کلاینت.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 pt-2">
              <span>ورود به فروشگاه و قیمت‌گذاری</span>
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="p-5 rounded-3xl bg-[#14161C] border border-white/5 hover:border-amber-500/40 transition-all group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-blue-400/10 text-blue-400 flex items-center justify-center border border-blue-400/20 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                مدیریت کاربران و ریست تلاش‌ها
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                مشاهده نقش‌ها و پایه‌های تحصیلی داوطلبان و بازنشانی تلاش آزمون برای تست مجدد.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 pt-2">
              <span>ورود به مدیریت کاربران</span>
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
