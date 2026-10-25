'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExamSummary, messagesFa } from '@condorlab/shared';
import { BookOpen, Users, Flame, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [exam, setExam] = useState<
    (ExamSummary & { isCapacityFull: boolean; remainingSeats?: number }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchExam = async () => {
      try {
        const res = await fetch(`/api/exams/${slug}`);
        const data = await res.json();
        if (data.success) {
          setExam(data.data);
        } else {
          setError(data.message || 'آزمون یافت نشد.');
        }
      } catch {
        setError('خطا در بارگذاری جزئیات آزمون.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExam();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto flex items-center justify-center">
        <div className="text-center text-gray-400 text-sm">
          <div className="w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <span>در حال فراخوانی مشخصات آزمون...</span>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen p-6 max-w-lg mx-auto flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <h1 className="text-xl font-bold text-white mb-2">خطا در بارگذاری آزمون</h1>
        <p className="text-sm text-gray-400 mb-6">{error || 'آزمون مورد نظر یافت نشد.'}</p>
        <Link href="/exams">
          <Button variant="secondary">بازگشت به کاتالوگ آزمون‌ها</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-6xl mx-auto text-right">
      {/* ناوبری و Breadcrumb */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-6 border-b border-[#262626] pb-4">
        <Link href="/" className="hover:text-white">
          خانه
        </Link>
        <span>/</span>
        <Link href="/exams" className="hover:text-white">
          کاتالوگ آزمون‌ها
        </Link>
        <span>/</span>
        <span className="text-[#FFCC00] font-medium truncate max-w-[200px] sm:max-w-none">{exam.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ستون اصلی: جزئیات علمی و سرفصل‌ها (۲ ستون) */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {exam.campbellVolumes.map((v) => (
                <span
                  key={v}
                  className="px-3 py-1 rounded-md bg-[#222222] border border-[#3A3A3A] text-xs text-[#FFCC00] font-bold"
                >
                  جلد {v} بیولوژی کمپبل
                </span>
              ))}
              <span className="px-3 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
                استاندارد مرحله اول و دوم المپیاد
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-4">{exam.title}</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              طراحی شده توسط کمیته علمی دپارتمان المپیاد زیست‌شناسی کندرلب با سؤالات تألیفی عمیق، کارنامه تحلیلی داده‌محور متصل به فصول کمپبل و سامانه فعال ضدتقلب.
            </p>
          </div>

          {/* سرفصل‌های آزمون */}
          <div className="p-6 rounded-2xl bg-[#181818] border border-[#2E2E2E]">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#FFCC00]" />
              <span>سرفصل‌ها و بودجه‌بندی مباحث آزمون</span>
            </h3>
            <ul className="space-y-3 text-xs sm:text-sm text-gray-300">
              <li className="flex items-start gap-2.5">
                <span className="text-[#FFCC00] font-bold">•</span>
                <span>
                  <strong>جلد اول (شیمی حیات):</strong> آب و کربن، درشت‌مولکول‌ها، ساختار پروتئین‌ها، اسیدهای نوکلئیک و لیپیدها.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#FFCC00] font-bold">•</span>
                <span>
                  <strong>جلد دوم (سلول و ژنتیک):</strong> ساختار سلول و غشا، تنفس سلولی و گلیکولیز، فتوسنتز، ارتباط سلولی و چرخه سلولی.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#FFCC00] font-bold">•</span>
                <span>
                  <strong>استاندارد نمره‌دهی:</strong> ۶۰ سؤال تستی چهارگزینه‌ای با نمره منفی رسمی (یک‌سوم) و ۱۲۰ دقیقه زمان پاسخگویی.
                </span>
              </li>
            </ul>
          </div>

          {/* طراحان آزمون */}
          <div className="p-6 rounded-2xl bg-[#181818] border border-[#2E2E2E]">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FFCC00]" />
              <span>کادر علمی و طراحان سؤالات</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-[#202020] border border-[#333333]">
                <div className="font-bold text-white mb-1">استاد متین موسوی</div>
                <div className="text-gray-400 text-xs">مدال المپیاد کشوری زیست‌شناسی • طراح سلولی و مولکولی</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#202020] border border-[#333333]">
                <div className="font-bold text-white mb-1">استاد نیما رضایی</div>
                <div className="text-gray-400 text-xs">مدرس المپیاد کشوری • طراح فیزیولوژی و بیوشیمی</div>
              </div>
            </div>
          </div>
        </div>

        {/* ستون کناری: کارت ثبت‌نام و ظرفیت (۱ ستون) */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#1A1A1A] border border-[#333333] shadow-2xl sticky top-6">
            {/* قیمت */}
            <div className="border-b border-[#2C2C2C] pb-4 mb-5">
              <span className="text-xs text-gray-400 block mb-1">هزینه شرکت در آزمون</span>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {exam.price === 0 ? (
                  <span className="text-green-400">رایگان (پایلوت ۱)</span>
                ) : (
                  `${exam.price.toLocaleString('fa-IR')} تومان`
                )}
              </div>
            </div>

            {/* بنر تخفیف شکاری (Hunter Coupon) */}
            {exam.price > 0 && (
              <div className="p-3.5 rounded-xl bg-[#2B2305] border border-[#FFCC00]/40 text-xs mb-5">
                <div className="flex items-center justify-between font-bold text-[#FFCC00] mb-1">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-[#FFCC00]" />
                    <span>کد تخفیف شکاری:</span>
                  </div>
                  <span className="font-mono text-sm bg-black/40 px-2 py-0.5 rounded">CAMPBELL50</span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  ۵۰٪ تخفیف ویژه برای ۵۰ نفر اول ثبت‌نام‌کننده با اعمال خودکار در سبد خرید.
                </p>
              </div>
            )}

            {/* وضعیت ظرفیت رسمی و دوره آزاد Open (قاعده R-58) */}
            <div className="mb-6 p-4 rounded-xl bg-[#222222] border border-[#383838] text-xs">
              <span className="text-gray-400 block mb-1.5 font-medium">وضعیت ظرفیت و رتبه‌بندی:</span>
              {exam.isCapacityFull ? (
                <div className="text-amber-400 font-medium leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    سقف صندلی‌های رسمی تکمیل شده است؛ ثبت‌نام شما به‌صورت <strong>آزاد (Open)</strong> بدون رتبه لیدربورد انجام خواهد شد.
                  </span>
                </div>
              ) : (
                <div className="text-green-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>
                    صندلی رسمی دارای رتبه فعال است
                    {exam.remainingSeats !== undefined && ` (${exam.remainingSeats} صندلی باقی‌مانده)`}
                  </span>
                </div>
              )}
            </div>

            {/* دکمه اقدام اصلی CTA */}
            <Button
              variant="primary"
              onClick={() => router.push(`/checkout?examId=${exam.id}`)}
              className="w-full text-sm font-bold min-h-[48px] shadow-lg shadow-[#FFCC00]/10"
            >
              {exam.price === 0 ? 'رزرو صندلی در آزمون رایگان' : 'ورود به ثبت‌نام و دریافت صندلی'}
            </Button>

            <p className="mt-4 text-center text-[11px] text-gray-500 leading-normal">
              کارنامه جامع و پاسخ‌نامه تشریحی بلافاصله پس از اتمام پنجره آزمون صادر می‌گردد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
