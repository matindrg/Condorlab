'use client';

import * as React from 'react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CheckoutPreview,
  AccessType,
  formatPersianNumber,
  toEnglishDigits,
} from '@condorlab/shared';
import {
  CreditCard,
  ShieldCheck,
  Ticket,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  UserCheck,
} from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get('examId') || 'mock-pilot-id';

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState<{
    orderNumber: string;
    message: string;
  } | null>(null);

  // فرم تکمیل مشخصات (در صورت نیاز)
  const [profileData, setProfileData] = useState({
    phoneNumber: '',
    city: '',
    school: '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/checkout/preview?examId=${examId}`);
        const data = await res.json();
        if (data.success) {
          setPreview(data.data);
          setDiscountAmount(data.data.discountAmount || 0);
        }
      } catch (err) {
        console.error('Failed to load checkout preview:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [examId]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    setCouponError(null);
    setCouponMessage(null);

    try {
      const res = await fetch('/api/checkout/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, examId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCouponError(data.message || 'کد تخفیف نامعتبر است.');
        return;
      }

      setCouponMessage(data.data.message);
      if (preview && data.data.discountPercent) {
        const discount = Math.floor((preview.totalPrice * data.data.discountPercent) / 100);
        setDiscountAmount(discount);
      }
    } catch {
      setCouponError('خطا در بررسی کد تخفیف.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    setIsSavingProfile(true);

    try {
      const res = await fetch('/api/checkout/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileErrors({ form: data.message || 'خطا در ثبت مشخصات.' });
        return;
      }

      setProfileSuccess(true);
      if (preview) {
        setPreview({
          ...preview,
          isProfileComplete: true,
          missingProfileFields: [],
        });
      }
    } catch {
      setProfileErrors({ form: 'خطا در برقراری ارتباط با سرور.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFinalEnrollment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/checkout/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, couponCode: couponCode.trim() || undefined }),
      });
      const data = await res.json();

      if (data.success) {
        setOrderCompleted({
          orderNumber: data.data.orderNumber,
          message: data.data.message,
        });
      } else {
        alert(data.message || 'خطا در ثبت سفارش');
      }
    } catch {
      alert('خطا در تکمیل فرآیند ثبت‌نام');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto flex items-center justify-center">
        <div className="text-center text-gray-400 text-sm">
          <div className="w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <span>در حال آماده‌سازی سبد ثبت‌نام...</span>
        </div>
      </div>
    );
  }

  if (orderCompleted) {
    return (
      <div className="min-h-screen p-4 sm:p-8 max-w-lg mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">ثبت‌نام با موفقیت انجام شد</h1>
        <p className="text-sm text-gray-300 mb-6 leading-relaxed">{orderCompleted.message}</p>

        <div className="w-full bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-4 mb-8 text-xs text-right space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">شماره سفارش:</span>
            <span className="font-mono text-white">{orderCompleted.orderNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">وضعیت پرداخت:</span>
            <span className="text-green-400 font-bold">تأییدشده و نهایی</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link href="/student/dashboard" className="flex-1">
            <Button variant="primary" className="w-full">
              ورود به داشبورد و مشاهده آزمون
            </Button>
          </Link>
          <Link href="/exams" className="flex-1">
            <Button variant="secondary" className="w-full">
              کاتالوگ آزمون‌ها
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const finalPayable = Math.max(0, (preview?.totalPrice || 0) - discountAmount);

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-5xl mx-auto text-right">
      {/* ناوبری */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-8 border-b border-[#262626] pb-4">
        <Link href="/" className="hover:text-white">
          خانه
        </Link>
        <span>/</span>
        <Link href="/exams" className="hover:text-white">
          کاتالوگ
        </Link>
        <span>/</span>
        <span className="text-[#FFCC00] font-medium">تسویه‌حساب و رزرو صندلی</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ستون اصلی: مشخصات و اطلاعات کاربر (۲ ستون) */}
        <div className="lg:col-span-2 space-y-6">
          {/* کارت مشخصات آزمون انتخابی */}
          <div className="p-6 rounded-2xl bg-[#181818] border border-[#2E2E2E]">
            <span className="text-xs text-[#FFCC00] font-bold block mb-1">آزمون انتخاب‌شده</span>
            <h2 className="text-xl font-bold text-white mb-3">{preview?.exam.title}</h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span>
                  نوع صندلی:{' '}
                  {preview?.accessType === AccessType.Official ? (
                    <strong className="text-green-400">رسمی (دارای رتبه لیدربورد)</strong>
                  ) : (
                    <strong className="text-amber-400">آزاد Open (سنجش تحلیلی)</strong>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>مدت پاسخگویی:</span>
                <span className="text-white font-medium">{preview?.exam.durationMinutes} دقیقه</span>
              </div>
            </div>
          </div>

          {/* مرحله شرطی: تکمیل مشخصات داوطلب */}
          {!preview?.isProfileComplete && !profileSuccess && (
            <div className="p-6 rounded-2xl bg-[#1C1A14] border border-[#FFCC00]/40">
              <div className="flex items-center gap-2 mb-2 text-[#FFCC00]">
                <UserCheck className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-white">تکمیل مشخصات تحصیلی داوطلب</h3>
              </div>
              <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                جهت صدور دقیق کارنامه رتبه‌بندی، لطفاً اطلاعات تکمیلی زیر را ثبت فرمایید (این مرحله فقط یک‌بار
                انجام می‌شود).
              </p>

              {profileErrors.form && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileErrors.form}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="شماره تماس (جهت پیامک اضطراری)"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={profileData.phoneNumber}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phoneNumber: e.target.value })
                    }
                    error={profileErrors.phoneNumber}
                    disabled={isSavingProfile}
                    dir="ltr"
                  />
                  <Input
                    label="شهر محل سکونت"
                    placeholder="مثلاً: تهران، شیراز"
                    value={profileData.city}
                    onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                    error={profileErrors.city}
                    disabled={isSavingProfile}
                  />
                </div>
                <Input
                  label="نام مدرسه یا آموزشگاه"
                  placeholder="مثلاً: شهید اژه‌ای ۱ / فرزانگان"
                  value={profileData.school}
                  onChange={(e) => setProfileData({ ...profileData, school: e.target.value })}
                  error={profileErrors.school}
                  disabled={isSavingProfile}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  isLoading={isSavingProfile}
                  className="w-full text-xs font-bold min-h-[42px]"
                >
                  ثبت مشخصات و ادامه
                </Button>
              </form>
            </div>
          )}

          {/* درگاه و نحوه پرداخت */}
          <div className="p-6 rounded-2xl bg-[#181818] border border-[#2E2E2E]">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#FFCC00]" />
              <span>روش پرداخت و صدور صندلی</span>
            </h3>

            {finalPayable === 0 ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  مبلغ قابل پرداخت صفر تومان است. نیازی به ورود به درگاه بانکی نبوده و صندلی مستقیماً صادر می‌شود.
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#222222] border border-[#3A3A3A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2A2A2A] flex items-center justify-center font-black text-amber-400 text-sm">
                    ZP
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">درگاه شتابی زرین‌پال (Sandbox)</div>
                    <div className="text-xs text-gray-400">کلیه کارت‌های عضو شبکه شتاب بانکی کشور</div>
                  </div>
                </div>
                <span className="w-4 h-4 rounded-full border-2 border-[#FFCC00] flex items-center justify-center p-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#FFCC00]"></span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ستون کناری: خلاصه فاکتور و کوپن تخفیف (۱ ستون) */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#1A1A1A] border border-[#333333] shadow-2xl sticky top-6">
            <h3 className="text-base font-bold text-white mb-4">خلاصه پیش‌فاکتور</h3>

            {/* وارد کردن کد تخفیف */}
            <form onSubmit={handleApplyCoupon} className="mb-6">
              <label className="block text-xs text-gray-400 mb-1.5">کد تخفیف یا کارت هدیه</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="CAMPBELL50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={isApplyingCoupon}
                  dir="ltr"
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#141414] border border-[#333333] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FFCC00]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  isLoading={isApplyingCoupon}
                  disabled={!couponCode.trim()}
                  className="px-4 text-xs font-bold"
                >
                  اعمال
                </Button>
              </div>

              {couponMessage && (
                <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{couponMessage}</span>
                </p>
              )}
              {couponError && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{couponError}</span>
                </p>
              )}
            </form>

            {/* ردیف‌های قیمت */}
            <div className="space-y-3 border-t border-[#2A2A2A] pt-4 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>هزینه پایه آزمون:</span>
                <span className="text-white font-medium">
                  {preview?.totalPrice === 0
                    ? 'رایگان'
                    : `${formatPersianNumber(preview?.totalPrice || 0)} تومان`}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-green-400 font-medium">
                  <span>تخفیف اعمال‌شده:</span>
                  <span>- {formatPersianNumber(discountAmount)} تومان</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-bold text-white border-t border-[#2A2A2A] pt-3">
                <span>مبلغ قابل پرداخت:</span>
                <span className="text-base text-[#FFCC00]">
                  {finalPayable === 0 ? 'رایگان (۰ تومان)' : `${formatPersianNumber(finalPayable)} تومان`}
                </span>
              </div>
            </div>

            {/* دکمه اقدام نهایی */}
            <Button
              variant="primary"
              onClick={handleFinalEnrollment}
              isLoading={isProcessing}
              disabled={!preview?.isProfileComplete && !profileSuccess}
              className="w-full mt-6 min-h-[48px] text-sm font-bold shadow-lg shadow-[#FFCC00]/10 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {finalPayable === 0 ? 'تأیید و صدور صندلی رایگان' : 'پرداخت امن و ثبت‌نام نهایی'}
              </span>
            </Button>

            {!preview?.isProfileComplete && !profileSuccess && (
              <p className="mt-2 text-center text-[11px] text-amber-400">
                لطفاً ابتدا مشخصات تحصیلی خود را در فرم بالا تکمیل فرمایید.
              </p>
            )}

            <p className="mt-4 text-center text-[11px] text-gray-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
              <span>تضمین امنیت تبادلات و انطباق با قواعد المپیاد</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-6 max-w-4xl mx-auto flex items-center justify-center text-gray-400 text-sm">
          در حال بارگذاری...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
