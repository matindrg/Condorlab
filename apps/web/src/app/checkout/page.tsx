'use client';

import * as React from 'react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
  Lock,
  UserCheck,
  Clock,
  Tag,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get('examId') || 'exm-campbell-p2';
  const { isEnrolled, markExamAsEnrolled } = useAuth();
  const [redirectingToDashboard, setRedirectingToDashboard] = useState(false);

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercent: number;
    discountAmount: number;
    isHunter?: boolean;
    remainingUses?: number;
  } | null>(null);

  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState<{
    orderNumber: string;
    message: string;
    accessType: string;
  } | null>(null);

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // فرم تکمیل مشخصات
  const [profileData, setProfileData] = useState({
    phoneNumber: '',
    city: '',
    school: '',
    grade: '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const fetchAuth = async () => {
        try {
          const authRes = await fetch('/api/auth/me', { cache: 'no-store' });
          if (authRes.ok) {
            const authJson = await authRes.json();
            if (authJson.success && authJson.user) {
              const loggedUser = authJson.user;
              setCurrentUser(loggedUser);
              try {
                localStorage.setItem('condor_user', JSON.stringify(loggedUser));
              } catch {}

              if (loggedUser.profile) {
                setProfileData({
                  phoneNumber: loggedUser.profile.phoneNumber || '',
                  city: loggedUser.profile.city || '',
                  school: loggedUser.profile.school || '',
                  grade: loggedUser.profile.grade || '',
                });
                if (
                  loggedUser.profile.phoneNumber &&
                  loggedUser.profile.city &&
                  !/[a-zA-Z]/.test(loggedUser.profile.city) &&
                  loggedUser.profile.school &&
                  !/[a-zA-Z]/.test(loggedUser.profile.school) &&
                  loggedUser.profile.grade
                ) {
                  setProfileSuccess(true);
                }
              }
            } else {
              setCurrentUser(null);
              try {
                localStorage.removeItem('condor_user');
              } catch {}
            }
          } else {
            setCurrentUser(null);
            try {
              localStorage.removeItem('condor_user');
            } catch {}
          }
        } catch {
          // در صورت قطعی یا خطا در شبکه، به کش موجود بسنده می‌شود
        } finally {
          setIsCheckingAuth(false);
        }
      };

      const fetchCheckoutPreview = async () => {
        try {
          const res = await fetch(`/api/checkout/preview?examId=${encodeURIComponent(examId)}`);
          const json = await res.json();
          if (json.success && json.data) {
            setPreview(json.data);
            if (json.data.alreadyPurchased || isEnrolled(examId) || isEnrolled(json.data.exam?.slug)) {
              setRedirectingToDashboard(true);
              setTimeout(() => {
                router.replace('/student/dashboard');
              }, 1200);
              return;
            }
            if (json.data.isProfileComplete) {
              setProfileSuccess(true);
            }
          }
        } catch (err) {
          console.error('Failed to load checkout preview:', err);
        } finally {
          setIsLoadingPreview(false);
        }
      };

      await Promise.all([fetchAuth(), fetchCheckoutPreview()]);
    };

    fetchData();
  }, [examId]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const targetCode = (codeToApply || couponCode).trim();
    if (!targetCode) return;

    setIsApplyingCoupon(true);
    setCouponError(null);
    setCouponMessage(null);

    try {
      const res = await fetch('/api/checkout/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode, examId }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setCouponError(json.message || 'کد تخفیف نامعتبر یا منقضی است.');
        setAppliedCoupon(null);
        return;
      }

      setCouponMessage(json.data.message);
      setAppliedCoupon({
        code: targetCode.toUpperCase(),
        discountPercent: json.data.discountPercent,
        discountAmount: json.data.discountAmount,
        isHunter: json.data.isHunterCoupon,
        remainingUses: json.data.remainingUses,
      });
    } catch {
      setCouponError('خطا در برقراری ارتباط جهت بررسی کد تخفیف.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});

    // اعتبارسنجی اولیه کلاینت
    const cleanPhone = toEnglishDigits(profileData.phoneNumber).replace(/\s+/g, '');
    const fieldErrors: Record<string, string> = {};

    if (!cleanPhone || !/^(\+98|0)?9\d{9}$/.test(cleanPhone)) {
      fieldErrors.phoneNumber = 'شماره همراه معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)';
    }
    if (!profileData.city.trim() || profileData.city.trim().length < 2) {
      fieldErrors.city = 'نام شهر الزامی است.';
    } else if (/[a-zA-Z]/.test(profileData.city)) {
      fieldErrors.city = 'نام شهر نمی‌تواند به زبان انگلیسی وارد شود.';
    }

    if (!profileData.school.trim() || profileData.school.trim().length < 2) {
      fieldErrors.school = 'نام مدرسه الزامی است.';
    } else if (/[a-zA-Z]/.test(profileData.school)) {
      fieldErrors.school = 'نام مدرسه نمی‌تواند به زبان انگلیسی وارد شود.';
    }

    if (!profileData.grade) {
      fieldErrors.grade = 'انتخاب پایه تحصیلی الزامی است.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setProfileErrors(fieldErrors);
      return;
    }

    setIsSavingProfile(true);

    try {
      const res = await fetch('/api/checkout/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          city: profileData.city.trim(),
          school: profileData.school.trim(),
          grade: profileData.grade || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setProfileErrors({ form: json.message || 'خطا در ثبت مشخصات.' });
        return;
      }

      setProfileSuccess(true);
      setIsEditingProfile(false);

      const updatedUser = {
        ...(currentUser || {}),
        profile: {
          ...(currentUser?.profile || {}),
          phoneNumber: cleanPhone,
          city: profileData.city.trim(),
          school: profileData.school.trim(),
          grade: profileData.grade || currentUser?.profile?.grade,
        },
      };
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem('condor_user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('condor_auth_change'));
      } catch {}

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
        body: JSON.stringify({
          examId,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        markExamAsEnrolled(examId);
        if (json.data.examSlug) markExamAsEnrolled(json.data.examSlug);
        setOrderCompleted({
          orderNumber: json.data.orderNumber,
          message: json.data.message,
          accessType: json.data.accessType,
        });
      } else {
        alert(json.message || 'خطا در تکمیل فرآیند ثبت‌نام');
      }
    } catch {
      alert('خطا در ثبت سفارش');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderCompleted) {
    const isPurchased = preview?.alreadyPurchased || isEnrolled(examId);

  return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="min-h-screen p-4 sm:p-8 max-w-lg mx-auto flex flex-col items-center justify-center text-center"
      >
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/40 flex items-center justify-center shadow-lg shadow-green-500/10">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">صندلی آزمون با موفقیت صادر شد</h1>
        <p className="text-sm text-gray-300 mb-8 leading-relaxed max-w-md">{orderCompleted.message}</p>

        <div className="w-full bg-[#15171C] border border-[#272B35] rounded-2xl p-5 mb-8 text-xs text-right space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <span className="text-gray-400">شماره سفارش رسمی:</span>
            <span className="font-mono text-[#FFCC00] font-bold text-sm">{orderCompleted.orderNumber}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <span className="text-gray-400">نوع شرکت و رتبه‌بندی:</span>
            <span className="text-white font-semibold">
              {orderCompleted.accessType === AccessType.Official ? 'صندلی رسمی (دارای رتبه لیدربورد)' : 'دوره آزاد (Open)'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">وضعیت سند:</span>
            <span className="text-green-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              نهایی و ثبت‌شده در دفترکل
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3.5 w-full">
          <Link href="/student/dashboard" className="flex-1">
            <Button variant="primary" className="w-full min-h-[48px] shadow-lg shadow-[#FFCC00]/15">
              ورود به داشبورد و مشاهده آزمون
            </Button>
          </Link>
          <Link href="/exams" className="flex-1">
            <Button variant="secondary" className="w-full min-h-[48px]">
              کاتالوگ آزمون‌ها
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  const basePrice = preview?.totalPrice || 0;
  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalPayable = Math.max(0, basePrice - discount);
  const isProfileReady = preview?.isProfileComplete || profileSuccess;
  const isCapacityFull = preview?.exam.capacity
    ? preview.exam.officialEnrolledCount >= preview.exam.capacity
    : false;

  if (redirectingToDashboard) {
    const isPurchased = preview?.alreadyPurchased || isEnrolled(examId);

  return (
      <div className="min-h-screen p-6 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">شما قبلاً در این آزمون ثبت‌نام کرده‌اید</h2>
        <p className="text-xs text-gray-400 mb-4">صندلی آزمون شما فعال است. در حال انتقال به داشبورد داوطلب...</p>
        <div className="w-8 h-8 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isPurchased = preview?.alreadyPurchased || isEnrolled(examId);

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-6xl mx-auto text-right">
      {/* هدر و ناوبری */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-8 border-b border-white/10 pb-4">
        <Link href="/" className="hover:text-white transition-colors">
          خانه
        </Link>
        <span className="text-gray-600">/</span>
        <Link href="/exams" className="hover:text-white transition-colors">
          کاتالوگ آزمون‌ها
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-[#FFCC00] font-medium">تسویه‌حساب و رزرو صندلی</span>
      </div>

      {isPurchased && (
        <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">شما قبلاً در این آزمون ثبت‌نام کرده‌اید</span>
              <span className="text-gray-300">صندلی آزمون برای حساب شما فعال است و نیاز به پرداخت یا ثبت‌نام مجدد ندارید.</span>
            </div>
          </div>
          <Link href="/student/dashboard">
            <Button variant="primary" className="text-xs font-bold whitespace-nowrap min-h-[38px]">
              ورود به داشبورد
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ستون اصلی: مشخصات آزمون و پروفایل داوطلب (۷ ستون) */}
        <div className="lg:col-span-7 space-y-6">
          {/* کارت ۱: جزئیات صندلی آزمون انتخاب‌شده */}
          <div className="animate-stagger-1 p-6 rounded-2xl bg-gradient-to-br from-[#16181D] to-[#111216] border border-[#262A34] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFCC00]/5 rounded-full blur-3xl pointer-events-none"></div>

            {isLoadingPreview || !preview ? (
              <div className="skeleton-shimmer p-4 space-y-4">
                <div className="flex justify-between">
                  <div className="w-28 h-5 bg-white/10 rounded-lg"></div>
                  <div className="w-20 h-5 bg-white/10 rounded-lg"></div>
                </div>
                <div className="w-3/4 h-8 bg-white/10 rounded-lg"></div>
                <div className="w-full h-16 bg-white/5 rounded-xl border border-white/5"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-lg bg-[#FFCC00]/10 border border-[#FFCC00]/25 text-xs text-[#FFCC00] font-bold">
                    مشخصات آزمون المپیاد
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {preview.exam.durationMinutes} دقیقه
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-white mb-4 leading-snug">
                  {preview.exam.title}
                </h1>

                {/* وضعیت ظرفیت و رتبه‌بندی رسمی (قاعده R-58) */}
                <div className="p-4 rounded-xl bg-[#0D0E12] border border-[#1E222B] flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>وضعیت پذیرش:</span>
                      {preview.accessType === AccessType.Official ? (
                        <span className="text-green-400 font-black">صندلی رسمی (دارای رتبه لیدربورد کشوری)</span>
                      ) : (
                        <span className="text-amber-400 font-black">دوره آزاد Open (بدون تأثیر در لیدربورد)</span>
                      )}
                    </div>
                    <p className="text-gray-400 leading-relaxed text-[11px]">
                      بر اساس استاندارد کمیته المپیاد زیست‌شناسی کندرلب، نمره منفی یک‌سوم و صدور کارنامه بلافاصله پس از اتمام پنجره آزمون اعمال خواهد شد.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* کارت ۲: گیت احراز هویت یا تکمیل و ویرایش مشخصات پرونده داوطلب */}
          <div className="animate-stagger-2 rounded-2xl overflow-hidden">
            {isCheckingAuth && !currentUser ? (
              <div className="p-6 rounded-2xl bg-[#181A20] border border-[#262A34] shadow-xl skeleton-shimmer">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-5 h-5 rounded-full bg-white/10" />
                  <div className="h-5 w-48 rounded-lg bg-white/10" />
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-3.5 w-full rounded bg-white/5" />
                  <div className="h-3.5 w-3/4 rounded bg-white/5" />
                </div>
                <div className="flex gap-3">
                  <div className="h-11 flex-1 rounded-xl bg-white/10" />
                  <div className="h-11 flex-1 rounded-xl bg-white/10" />
                </div>
              </div>
            ) : !currentUser && !profileSuccess ? (
              <div className="animate-morph-in p-6 rounded-2xl bg-[#1C1A14] border border-[#FFCC00]/40 shadow-xl">
                <div className="flex items-center gap-2.5 mb-2 text-[#FFCC00]">
                  <UserCheck className="w-5 h-5 shrink-0" />
                  <h2 className="text-base font-bold text-white">ورود به حساب کاربری جهت صدور صندلی</h2>
                </div>
                <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                  برای رزرو صندلی رسمی و ثبت کارنامه تحلیلی المپیاد زیست‌شناسی، لطفاً وارد حساب خود شوید یا در کمتر از ۱ دقیقه ثبت‌نام نمایید (پس از ورود بلافاصله به این صفحه بازگردانده می‌شوید).
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href={`/login?redirect=${encodeURIComponent('/checkout?examId=' + examId)}`}
                    className="flex-1"
                  >
                    <Button variant="primary" className="w-full text-xs font-bold min-h-[44px]">
                      ورود به حساب کاربری
                    </Button>
                  </Link>
                  <Link
                    href={`/signup?redirect=${encodeURIComponent('/checkout?examId=' + examId)}`}
                    className="flex-1"
                  >
                    <Button variant="secondary" className="w-full text-xs font-bold min-h-[44px]">
                      ثبت‌نام جدید در کندرلب
                    </Button>
                  </Link>
                </div>
              </div>
            ) : !isProfileReady || isEditingProfile ? (
              <div className="animate-morph-in p-6 rounded-2xl bg-[#181A20] border border-[#303644] shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5 text-[#FFCC00]">
                    <UserCheck className="w-5 h-5 shrink-0" />
                    <h2 className="text-base font-bold text-white">
                      {isEditingProfile ? 'ویرایش مشخصات تحصیلی' : 'تکمیل مشخصات تحصیلی داوطلب'}
                    </h2>
                  </div>
                  {isEditingProfile && (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      انصراف
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  جهت صدور دقیق کارنامه رتبه‌بندی و دسترسی به نتایج، اطلاعات زیر در پروفایل شما ثبت می‌شود.
                </p>

                {profileErrors.form && (
                  <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2 animate-morph-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{profileErrors.form}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="شماره تماس همراه (جهت پیامک و اطلاع‌رسانی)"
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                        value={profileData.phoneNumber}
                        onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                        error={profileErrors.phoneNumber}
                        disabled={isSavingProfile}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Input
                        label="شهر محل سکونت"
                        placeholder="مثلاً: تهران، اصفهان، شیراز"
                        value={profileData.city}
                        onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                        error={profileErrors.city}
                        disabled={isSavingProfile}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="نام دبیرستان یا آموزشگاه"
                      placeholder="مثلاً: علامه حلی ۱ / فرزانگان / انرژی اتمی"
                      value={profileData.school}
                      onChange={(e) => setProfileData({ ...profileData, school: e.target.value })}
                      error={profileErrors.school}
                      disabled={isSavingProfile}
                    />

                    <Select
                      label="پایه تحصیلی (المپیاد زیست)"
                      value={profileData.grade}
                      onChange={(e) => setProfileData({ ...profileData, grade: e.target.value })}
                      error={profileErrors.grade}
                      disabled={isSavingProfile}
                    >
                      <option value="" className="bg-[#181818] text-gray-400">
                        انتخاب پایه تحصیلی...
                      </option>
                      <option value="10" className="bg-[#181818] text-white">
                        پایه دهم (کانون اصلی المپیاد)
                      </option>
                      <option value="11" className="bg-[#181818] text-white">
                        پایه یازدهم (کانون اصلی المپیاد)
                      </option>
                      <option value="9" className="bg-[#181818] text-white">
                        پایه نهم (مطالعه مقدماتی)
                      </option>
                      <option value="8" className="bg-[#181818] text-white">
                        پایه هشتم (آزمایشی)
                      </option>
                      <option value="7" className="bg-[#181818] text-white">
                        پایه هفتم (آزمایشی)
                      </option>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={isSavingProfile}
                    className="w-full text-xs font-bold min-h-[44px] bg-[#242833] hover:bg-[#2C313F] border-[#3C4355]"
                  >
                    ذخیره و تأیید مشخصات پرونده
                  </Button>
                </form>
              </div>
            ) : (
              <div className="animate-morph-in p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>
                        {currentUser?.profile?.firstName
                          ? `${currentUser.profile.firstName} ${currentUser.profile.lastName}`
                          : 'داوطلب المپیاد'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-mono">
                        پرونده تأییدشده
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{profileData.school || currentUser?.profile?.school || 'دبیرستان ثبت‌نشده'}</span>
                      <span>•</span>
                      <span>{profileData.city || currentUser?.profile?.city || 'شهر ثبت‌نشده'}</span>
                      <span>•</span>
                      <span>
                        {profileData.grade || currentUser?.profile?.grade
                          ? `پایه ${profileData.grade || currentUser?.profile?.grade}`
                          : 'پایه ثبت‌نشده'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="text-xs text-[#FFCC00] hover:underline font-bold px-3 py-1.5 rounded-lg bg-[#20242D] border border-white/5 transition-colors"
                >
                  ویرایش مشخصات
                </button>
              </div>
            )}
          </div>

          {/* کارت ۳: روش پرداخت */}
          <div className="animate-stagger-3 p-6 rounded-2xl bg-[#16181D] border border-[#262A34] shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#FFCC00]" />
              <span>روش و بستر پرداخت</span>
            </h3>

            {finalPayable === 0 ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-400 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  مبلغ قابل پرداخت <strong>صفر تومان</strong> است؛ صندلی مستقیماً بدون ورود به درگاه بانکی فعال می‌گردد.
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#111216] border border-[#242833] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#1D2029] border border-white/5 flex items-center justify-center font-black text-[#FFCC00] text-sm">
                    ZP
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">درگاه شتابی زرین‌پال (Sandbox)</div>
                    <div className="text-xs text-gray-400">پرداخت امن با کلیه کارت‌های عضو شبکه بانکی شتاب</div>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full border-2 border-[#FFCC00] flex items-center justify-center p-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFCC00]"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ستون کناری: فاکتور و کد تخفیف (۵ ستون) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="animate-stagger-4 p-6 rounded-2xl bg-[#16181D] border border-[#282C38] shadow-2xl sticky top-6">
            <h3 className="text-base font-black text-white mb-5 tracking-tight">خلاصه پیش‌فاکتور سفارش</h3>

            {/* بخش کد تخفیف با کدهای آماده و انیمیشن Morph */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-[#FFCC00]" />
                  <span>کد تخفیف المپیاد</span>
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثلاً: CAMPBELL50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={isApplyingCoupon}
                  dir="ltr"
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#101115] border border-[#2D313D] text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00]/20 transition-all uppercase"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleApplyCoupon()}
                  isLoading={isApplyingCoupon}
                  disabled={!couponCode.trim()}
                  className="px-5 text-xs font-bold bg-[#242833] hover:bg-[#2C313F] border-[#3C4355]"
                >
                  اعمال کد
                </Button>
              </div>

              {/* کدهای پیشنهادی جهت تست سریع */}
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-500">کدهای لانچ:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode('CAMPBELL50');
                    handleApplyCoupon('CAMPBELL50');
                  }}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#242215] border border-[#FFCC00]/30 text-[#FFCC00] hover:bg-[#2F2C1A] transition-colors flex items-center gap-1"
                >
                  <Flame className="w-3 h-3 text-[#FFCC00]" />
                  <span>CAMPBELL50 (۵۰٪)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode('CONDOR20');
                    handleApplyCoupon('CONDOR20');
                  }}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1C1F26] border border-white/10 text-gray-300 hover:text-white transition-colors"
                >
                  CONDOR20 (۲۰٪)
                </button>
              </div>

              {/* وضعیت پیام و خطای کوپن */}
              <AnimatePresence>
                {couponMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-400 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{couponMessage}</span>
                  </motion.div>
                )}
                {couponError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{couponError}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ردیف‌های محاسباتی قیمت با Layout Morph */}
            <motion.div layout className="space-y-3.5 border-t border-white/10 pt-5 text-xs">
              <div className="flex justify-between items-center text-gray-400">
                <span>هزینه پایه آزمون:</span>
                <span className="text-white font-medium text-sm">
                  {basePrice === 0 ? 'رایگان' : `${formatPersianNumber(basePrice)} تومان`}
                </span>
              </div>

              <AnimatePresence>
                {discount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex justify-between items-center text-green-400 font-bold"
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>تخفیف اعمال‌شده ({appliedCoupon?.code}):</span>
                    </span>
                    <span>- {formatPersianNumber(discount)} تومان</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* مبلغ نهایی با انیمیشن برجسته */}
              <div className="flex justify-between items-center text-sm font-black text-white border-t border-white/10 pt-4">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <motion.span
                  key={finalPayable}
                  initial={{ scale: 1.1, color: '#FFCC00' }}
                  animate={{ scale: 1, color: '#FFCC00' }}
                  className="text-lg font-black"
                >
                  {finalPayable === 0 ? 'رایگان (۰ تومان)' : `${formatPersianNumber(finalPayable)} تومان`}
                </motion.span>
              </div>
            </motion.div>

            {/* دکمه اقدام نهایی با قفل‌گذاری هوشمند بر اساس پرونده و ظرفیت و خرید قبلی */}
            {isPurchased ? (
              <Link href="/student/dashboard" className="w-full block mt-6">
                <Button
                  variant="secondary"
                  className="w-full min-h-[50px] text-sm font-bold bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>آزمون قبلاً خریداری شده (مشاهده در داشبورد)</span>
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                onClick={handleFinalEnrollment}
                isLoading={isProcessing}
                disabled={!isProfileReady || isCapacityFull}
                className="w-full mt-6 min-h-[50px] text-sm font-bold shadow-xl shadow-[#FFCC00]/15 flex items-center justify-center gap-2 tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isCapacityFull
                    ? 'تکمیل ظرفیت صندلی‌های آزمون'
                    : finalPayable === 0
                    ? 'تأیید نهایی و رزرو صندلی رایگان'
                    : 'پرداخت امن و دریافت صندلی'}
                </span>
              </Button>
            )}

            {isPurchased ? (
              <p className="mt-3 text-center text-[11px] text-green-400 leading-normal">
                این آزمون در پرونده شما ثبت شده و نیازی به پرداخت مجدد نیست.
              </p>
            ) : isCapacityFull ? (
              <p className="mt-3 text-center text-[11px] text-red-400 leading-normal">
                سقف صندلی‌های این آزمون تکمیل شده است و ثبت‌نام جدید امکان‌پذیر نمی‌باشد.
              </p>
            ) : !isProfileReady ? (
              <p className="mt-3 text-center text-[11px] text-amber-400 leading-normal">
                لطفاً ابتدا مشخصات تحصیلی خود را در فرم مقابل ثبت فرمایید.
              </p>
            ) : null}

            <div className="mt-5 pt-4 border-t border-white/5 text-center text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
              <span>سامانه امن سنجش و کارنامه داده‌محور کندرلب</span>
            </div>
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
