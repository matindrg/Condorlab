'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShieldAlert, ShoppingBag, LayoutDashboard, ArrowRight, Home, HelpCircle } from 'lucide-react';

export function ForbiddenView({ message }: { message?: string }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#121212] flex items-center justify-center p-4 sm:p-6 text-right selection:bg-[#FFCC00] selection:text-black">
      <div className="relative max-w-lg w-full bg-[#1A1D24] border border-[#2B303D] rounded-3xl p-8 sm:p-10 shadow-2xl overflow-hidden text-center">
        {/* هاله نور پس‌زمینه */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          {/* آیکون و کد وضعیت */}
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-400 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-xs font-black text-rose-400 tracking-widest px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 inline-block">
              خطای ۴۰۳ • دسترسی غیرمجاز
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              اجازه دسترسی به این بخش را ندارید
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
              {message ||
                'شما در این آزمون ثبت‌نام نکرده‌اید یا سطح کاربری شما مجاز به مشاهده این بخش یا پنل مدیریت نمی‌باشد.'}
            </p>
          </div>

          {/* دکمه‌های اقدام و هدایت */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4 text-gray-400" />
              <span>صفحه اصلی</span>
            </Link>

            <Link
              href="/exams"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#222733] hover:bg-[#2A3140] border border-[#343D4F] text-xs font-bold text-gray-200 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4 text-[#FFCC00]" />
              <span>کاتالوگ آزمون‌ها</span>
            </Link>

            <Link
              href="/student/dashboard"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black text-xs font-black transition-all shadow-lg shadow-[#FFCC00]/20 flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>داشبورد من</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
