import { messagesFa } from '@condorlab/shared';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 text-center max-w-5xl mx-auto">
      {/* نشان بازگشت برند */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1E1E1E] border border-[#3A3A3A] text-xs text-[#FFCC00] mb-6 font-medium">
        <span>🧬 بازگشت قدرتمند کندرلب</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-pulse"></span>
        <span>پایلوت ۱ رایگان به‌زودی</span>
      </div>

      {/* عنوان اصلی هیرو */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-6">
        آزمایشگاه سنجش نخبگان <br className="hidden sm:inline" />
        <span className="text-[#FFCC00]">المپیاد زیست‌شناسی ایران</span>
      </h1>

      {/* زیرعنوان */}
      <p className="text-base sm:text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
        سنجش جلد‌به‌جلد بیولوژی کمپبل با سؤالات استاندارد مرحله اول و دوم، کارنامه داده‌محور متصل به بانک دانش و شبیه‌ساز حرفه‌ای با سامانه ضدتقلب اختصاصی.
      </p>

      {/* دکمه‌های اقدام اصلی (CTA) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        <a
          href="/exams"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#FFCC00] text-black font-bold text-sm hover:bg-[#E6B800] transition-colors shadow-lg shadow-[#FFCC00]/10"
        >
          🚀 شرکت رایگان در اولین شبیه‌ساز کمپبل
        </a>
        <a
          href="/resources"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#1E1E1E] text-white font-medium text-sm border border-[#3A3A3A] hover:bg-[#2A2A2A] transition-colors"
        >
          📚 کتابخانه و جزوات طلایی اساتید
        </a>
      </div>

      {/* باکس وضعیت مونوپکیج */}
      <div className="mt-20 p-5 rounded-2xl bg-[#181818] border border-[#2E2E2E] text-right w-full max-w-md text-xs text-gray-400">
        <div className="flex items-center justify-between mb-3 border-b border-[#2A2A2A] pb-2 font-mono">
          <span className="text-green-400">✓ Monorepo Ready</span>
          <span className="text-gray-500">v1.0.0 (Sprint 1)</span>
        </div>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="text-[#FFCC00]">•</span>
            <span>Next.js 15 App Router (@condorlab/web)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FFCC00]">•</span>
            <span>NestJS API Engine (@condorlab/api)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FFCC00]">•</span>
            <span>Prisma Database Ledger (@condorlab/database)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#FFCC00]">•</span>
            <span>Externalized Strings Dictionary (R-63 Active)</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
