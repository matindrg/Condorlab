import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, ShieldCheck } from 'lucide-react';
import { messagesFa } from '@condorlab/shared';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6 text-center max-w-5xl mx-auto">
      {/* نشان بازگشت برند با آیکون وکتور واقعی */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] text-xs text-[#FFCC00] mb-8 font-medium">
        <img src="/favicon.svg" alt="کندرلب" width={16} height={16} className="w-4 h-4 shrink-0" />
        <span>بازگشت کندرلب</span>
        <span className="w-1 h-1 rounded-full bg-[#FFCC00]"></span>
        <span className="text-gray-300">پایلوت ۱ رایگان</span>
      </div>

      {/* عنوان اصلی هیرو */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-6 text-white">
        سنجش تحلیلی و تخصصی <br className="hidden sm:inline" />
        <span className="text-[#FFCC00]">المپیاد زیست‌شناسی ایران</span>
      </h1>

      {/* زیرعنوان */}
      <p className="text-sm sm:text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed font-normal">
        شبیه‌ساز جامع جلد‌به‌جلد بیولوژی کمپبل، کارنامه داده‌محور متصل به بانک دانش، و ارزیابی استاندارد با سامانه یکپارچگی آزمون.
      </p>

      {/* دکمه‌های اقدام اصلی (CTA) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        <Link
          href="/exams"
          className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#FFCC00] text-black font-bold text-sm hover:bg-[#E6B800] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FFCC00]/10"
        >
          <span>مشاهده و ثبت‌نام آزمون پایلوت</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Link
          href="/resources"
          className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#1C1C1C] text-white font-medium text-sm border border-[#333333] hover:bg-[#252525] transition-all flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4 text-gray-400" />
          <span>کتابخانه و منابع آموزشی</span>
        </Link>
      </div>

      {/* باکس وضعیت مونوپکیج */}
      <div className="mt-20 p-5 rounded-2xl bg-[#161616] border border-[#262626] text-right w-full max-w-md text-xs text-gray-400">
        <div className="flex items-center justify-between mb-3 border-b border-[#242424] pb-2 font-mono">
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Monorepo Active</span>
          </span>
          <span className="text-gray-500">v1.0.0</span>
        </div>
        <ul className="space-y-2">
          <li className="flex items-center justify-between text-gray-300">
            <span>Next.js 15 App Router</span>
            <span className="text-gray-500 font-mono">apps/web</span>
          </li>
          <li className="flex items-center justify-between text-gray-300">
            <span>NestJS 10 API Engine</span>
            <span className="text-gray-500 font-mono">apps/api</span>
          </li>
          <li className="flex items-center justify-between text-gray-300">
            <span>Prisma ORM & PostgreSQL 16</span>
            <span className="text-gray-500 font-mono">packages/database</span>
          </li>
          <li className="flex items-center justify-between text-gray-300">
            <span>Externalized Strings (R-63)</span>
            <span className="text-gray-500 font-mono">packages/shared</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
