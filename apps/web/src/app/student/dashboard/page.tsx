'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useAppCache, PurchasedProduct, UserProfile } from '@/context/app-cache-context';
import { INITIAL_CATALOG_EXAMS } from '@/lib/catalog';
import { formatGrade } from '@condorlab/shared';
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  School,
  MapPin,
  Calendar,
  Clock,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Edit3,
  Save,
  X,
  ArrowLeft,
  AlertCircle,
  PackageCheck,
  LogIn,
  HelpCircle,
  ExternalLink,
  Laptop,
  FileCheck2,
} from 'lucide-react';

interface ExamCardState {
  state: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  statusBadge: { text: string; className: string };
  ctaButton: { text: string; href: string; className: string } | null;
  waitingBadge?: { text: string; className: string };
  windowText: string;
}

function getExamCardState(item: PurchasedProduct): ExamCardState {
  const now = Date.now();
  const startTime = item.startTime ? new Date(item.startTime).getTime() : null;
  const endTime = item.endTime ? new Date(item.endTime).getTime() : null;

  const isBefore = startTime ? now < startTime : false;
  const isAfter = endTime ? now > endTime : false;
  const isDuring = !isBefore && !isAfter;

  const hasParticipated =
    item.status === 'in_progress' ||
    item.status === 'submitted' ||
    item.status === 'completed' ||
    item.status === 'expired' ||
    item.status === 'missed';
  const isSubmitted =
    item.status === 'submitted' ||
    item.status === 'completed' ||
    (item.remainingSeconds !== undefined && item.remainingSeconds <= 0);
  const isInProgress = item.status === 'in_progress';
  const isReportPublished = (item as any).isReportPublished === true;

  const startFmt = startTime
    ? new Date(startTime).toLocaleString('fa-IR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'اعلام خواهد شد';
  const endFmt = endTime
    ? new Date(endTime).toLocaleString('fa-IR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'اعلام خواهد شد';
  const windowText = `بازه برگزاری: ${startFmt} تا ${endFmt}`;

  // ۱. قبل از شروع بازه رسمی: فقط بج، بدون دکمه ورود به لابی (Rule C.1)
  if (isBefore) {
    return {
      state: 1,
      windowText,
      statusBadge: {
        text: `شروع در ${startFmt}`,
        className: 'bg-[#FFCC00]/15 text-[#FFCC00] border border-[#FFCC00]/30',
      },
      ctaButton: null,
    };
  }

  // ۲. در بازه رسمی (شروع‌نشده): ورود به لابی آزمون / شروع آزمون (Rule C.2)
  if (isDuring && !hasParticipated) {
    return {
      state: 2,
      windowText,
      statusBadge: {
        text: 'آماده شروع',
        className: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      },
      ctaButton: {
        text: 'ورود به لابی آزمون / شروع آزمون',
        href: `/exam/${item.slug}/room`,
        className: 'bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs shadow-md shadow-[#FFCC00]/15',
      },
    };
  }

  // ۳. در بازه رسمی (در حال برگزاری): بازگشت به اتاق آزمون (Rule C.3)
  if (isDuring && isInProgress) {
    return {
      state: 3,
      windowText,
      statusBadge: {
        text: 'در حال برگزاری و شرکت',
        className: 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse',
      },
      ctaButton: {
        text: 'بازگشت به اتاق آزمون',
        href: `/exam/${item.slug}/room`,
        className: 'bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg shadow-amber-500/20 animate-pulse',
      },
    };
  }

  // ۴. کاربر شرکت کرده و ارسال شده، ولی هنوز کارنامه منتشر نشده: مشاهده خلاصه پاسخبرگ (Rule C.4)
  if (isSubmitted && !isReportPublished) {
    return {
      state: 4,
      windowText,
      statusBadge: {
        text: 'آزمون پایان‌یافته و ثبت شد',
        className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      },
      waitingBadge: {
        text: 'در انتظار انتشار کارنامه',
        className: 'bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px]',
      },
      ctaButton: {
        text: 'مشاهده خلاصه پاسخ‌برگ',
        href: `/exam/${item.slug}/summary`,
        className: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20',
      },
    };
  }

  // ۵. کاربر شرکت کرده، مهلت تمام شده و کارنامه و پاسخنامه منتشر شده: مشاهده کارنامه و پاسخنامه (Rule C.5)
  if (isSubmitted && isReportPublished) {
    return {
      state: 5,
      windowText,
      statusBadge: {
        text: 'کارنامه صادر شد',
        className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      },
      ctaButton: {
        text: 'مشاهده کارنامه و پاسخنامه تشریحی',
        href: `/student/report-card?attemptId=${item.id}&slug=${item.slug}`,
        className: 'bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs shadow-lg shadow-[#FFCC00]/20',
      },
    };
  }

  // ۶. بعد از پایان بازه، داوطلب شرکت نکرده و کارنامه/پاسخنامه هم هنوز منتشر نشده: فقط بج مات بدون دکمه (Rule C.6)
  if (isAfter && !hasParticipated && !isReportPublished) {
    return {
      state: 6,
      windowText,
      statusBadge: {
        text: 'غایب — آزمون پایان یافته',
        className: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      },
      ctaButton: null,
    };
  }

  // ۷. بعد از پایان بازه، داوطلب شرکت نکرده ولی پاسخنامه تشریحی منتشر شده: مشاهده دفترچه و پاسخنامه (Rule C.7)
  if (isAfter && !hasParticipated && isReportPublished) {
    return {
      state: 7,
      windowText,
      statusBadge: {
        text: 'غایب — آزمون پایان یافته',
        className: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
      },
      ctaButton: {
        text: 'مشاهده دفترچه و پاسخنامه تشریحی',
        href: `/exams/${item.slug}/solutions`,
        className: 'bg-white/10 hover:bg-white/15 text-gray-200 font-bold text-xs border border-white/10',
      },
    };
  }

  // فال‌بک پیش‌فرض
  return {
    state: 2,
    windowText,
    statusBadge: {
      text: 'آماده شروع',
      className: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    },
    ctaButton: {
      text: 'ورود به لابی آزمون / شروع آزمون',
      href: `/exam/${item.slug}/room`,
      className: 'bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs shadow-md shadow-[#FFCC00]/15',
    },
  };
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user: authUser, enrolledExamIds, isLoading: authLoading, refreshAuth } = useAuth();
  const {
    profile,
    purchasedProducts: products,
    isLoading: cacheLoading,
    refetchDashboard,
    mutateProfile,
  } = useAppCache();

  const loading = cacheLoading && products.length === 0;

  // به‌روزرسانی عنوان تب مرورگر به صورت «پنل کاربری {نام کاربر} | کندرلب»
  useEffect(() => {
    const nameParts = [
      profile?.firstName?.trim() || authUser?.profile?.firstName?.trim(),
      profile?.lastName?.trim() || authUser?.profile?.lastName?.trim(),
    ].filter(Boolean);

    let displayName = '';
    if (nameParts.length > 0) {
      displayName = nameParts.join(' ');
    } else if (profile?.fullName && profile.fullName !== 'داوطلب المپیاد' && profile.fullName !== 'داوطلب گرامی') {
      displayName = profile.fullName.trim();
    } else if (authUser?.profile?.fullName && authUser.profile.fullName !== 'داوطلب المپیاد' && authUser.profile.fullName !== 'داوطلب گرامی') {
      displayName = authUser.profile.fullName.trim();
    } else if (authUser?.name?.trim()) {
      displayName = authUser.name.trim();
    }

    if (displayName) {
      document.title = `پنل کاربری ${displayName} | کندرلب`;
    } else {
      document.title = 'پنل کاربری | کندرلب';
    }
  }, [
    profile?.firstName,
    profile?.lastName,
    profile?.fullName,
    authUser?.profile?.firstName,
    authUser?.profile?.lastName,
    authUser?.profile?.fullName,
    authUser?.name,
  ]);

  // استیت‌های ویرایش مشخصات
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    grade: '10',
    school: '',
    city: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // تنظیم مقادیر اولیه فرم ویرایش مشخصات
  const handleStartEdit = () => {
    if (profile) {
      setEditForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phoneNumber: profile.phoneNumber || '',
        grade: profile.grade || '10',
        school: profile.school === 'نامشخص' ? '' : profile.school || '',
        city: profile.city === 'نامشخص' ? '' : profile.city || '',
      });
      setIsEditing(true);
      setSaveMessage(null);
    }
  };

  // ارسال فرم ویرایش مشخصات
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/dashboard/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        mutateProfile({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          fullName: `${editForm.firstName} ${editForm.lastName}`.trim() || 'داوطلب المپیاد',
          phoneNumber: editForm.phoneNumber,
          grade: editForm.grade,
          school: editForm.school || 'نامشخص',
          city: editForm.city || 'نامشخص',
        });

        // همگام‌سازی با کش کلاینت
        try {
          const cached = localStorage.getItem('condor_user');
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.profile = {
              ...parsed.profile,
              firstName: editForm.firstName,
              lastName: editForm.lastName,
              phoneNumber: editForm.phoneNumber,
              grade: editForm.grade,
              school: editForm.school,
              city: editForm.city,
            };
            localStorage.setItem('condor_user', JSON.stringify(parsed));
          }
        } catch {}

        window.dispatchEvent(new Event('condor_auth_change'));
        window.dispatchEvent(new CustomEvent('condor:invalidate:user'));
        await refreshAuth();

        setSaveMessage({ text: 'مشخصات شما با موفقیت ذخیره و به‌روزرسانی شد.', type: 'success' });
        setTimeout(() => {
          setIsEditing(false);
          setSaveMessage(null);
        }, 1200);
      } else {
        setSaveMessage({ text: data.message || 'خطا در ثبت مشخصات.', type: 'error' });
      }
    } catch {
      setSaveMessage({ text: 'خطا در برقراری ارتباط با سرور.', type: 'error' });
    } finally {
      setSaveLoading(false);
    }
  };

  // حالت در حال بارگذاری اولیه
  if (authLoading || (loading && !profile)) {
    return (
      <div className="min-h-screen p-4 sm:p-8 max-w-6xl mx-auto flex flex-col gap-6">
        <div className="h-28 bg-[#181818] rounded-2xl animate-pulse border border-[#2E3340]"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-[#181818] rounded-2xl animate-pulse border border-[#2E3340] md:col-span-1"></div>
          <div className="h-64 bg-[#181818] rounded-2xl animate-pulse border border-[#2E3340] md:col-span-2"></div>
        </div>
      </div>
    );
  }

  // در صورتی که کاربر وارد نشده باشد
  if (!authUser && !profile) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#181818] border border-[#2E3340] rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-[#FFCC00] via-[#FFE066] to-[#E6B800]"></div>
          <div className="w-16 h-16 rounded-2xl bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] flex items-center justify-center mx-auto mb-5 shadow-lg">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mb-2">ورود به پیشخوان داوطلب</h1>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            برای مشاهده پرونده ثبت‌شده و محصولات و آزمون‌های خریداری‌شده، لطفاً ابتدا وارد حساب کاربری خود شوید.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/login?redirect=/student/dashboard"
              className="w-full py-3.5 px-4 rounded-xl bg-[#FFCC00] text-black font-bold hover:bg-[#E6B800] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#FFCC00]/15"
            >
              <LogIn className="w-4 h-4" />
              ورود به حساب کاربری
            </Link>
            <Link
              href="/signup?redirect=/student/dashboard"
              className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
            >
              ثبت‌نام جدید داوطلب
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* بردکرامب و عنوان */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-5">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            خانه
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-[#FFCC00] font-bold">داشبورد کاربری</span>
        </div>

        <Link
          href="/exams"
          className="text-xs sm:text-sm text-gray-300 hover:text-[#FFCC00] flex items-center gap-1.5 transition-colors group"
        >
          <span>مشاهده کاتالوگ آزمون‌ها</span>
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* بنر خوش‌آمدگویی و اطلاعات سریع */}
      <div className="bg-gradient-to-r from-[#1C1F26] to-[#15171C] border border-[#2B303D] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#FFCC00] via-[#FFD700] to-transparent"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-black font-black text-2xl flex items-center justify-center shrink-0 shadow-lg shadow-[#FFCC00]/20">
              {profile?.firstName?.[0] || 'د'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {profile?.fullName || 'داوطلب گرامی'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFCC00]/15 text-[#FFCC00] border border-[#FFCC00]/30">
                  {profile?.grade ? formatGrade(profile.grade) : 'داوطلب المپیاد'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  حساب فعال
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-400">
                پیشخوان رسمی داوطلب سنجش تحلیلی المپیاد زیست‌شناسی کندرلب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="px-4 py-3 rounded-2xl bg-black/40 border border-white/5 flex-1 sm:flex-initial text-center sm:text-right">
              <span className="text-[11px] text-gray-400 block mb-0.5">محصولات و آزمون‌ها</span>
              {loading ? (
                <div className="h-6 w-20 skeleton-shimmer mt-0.5 backdrop-blur-md"></div>
              ) : (
                <span className="text-lg font-black text-[#FFCC00]">
                  {products.length}{' '}
                  <span className="text-xs font-normal text-gray-300">مورد فعال</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* شبکه اصلی: دو بخش مشخصات و محصولات */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ========================================== */}
        {/* بخش ۱: مشخصات ثبت‌شده کاربر (Profile Details) */}
        {/* ========================================== */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#181818] border border-[#2E3340] rounded-3xl p-6 shadow-xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFCC00]/10 text-[#FFCC00] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">مشخصات ثبت‌شده شما</h2>
                  <p className="text-[11px] text-gray-400">اطلاعات پرونده تحصیلی داوطلب</p>
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-[#FFCC00] border border-white/10 transition-colors text-xs font-medium flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  ویرایش
                </button>
              )}
            </div>

            {/* پیام وضعیت ذخیره */}
            {saveMessage && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  saveMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {saveMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{saveMessage.text}</span>
              </div>
            )}

            {isEditing ? (
              /* فرم ویرایش مشخصات */
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1.5">نام</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      placeholder="نام"
                      className="w-full bg-[#121212] border border-[#333333] focus:border-[#FFCC00] rounded-xl px-3 py-2 text-white outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1.5">نام خانوادگی</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      placeholder="نام خانوادگی"
                      className="w-full bg-[#121212] border border-[#333333] focus:border-[#FFCC00] rounded-xl px-3 py-2 text-white outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1.5">شماره موبایل</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    placeholder="09123456789"
                    className="w-full bg-[#121212] border border-[#333333] focus:border-[#FFCC00] rounded-xl px-3 py-2 text-white outline-none text-left font-mono transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1.5">پایه تحصیلی</label>
                    <select
                      value={editForm.grade}
                      onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                      className="w-full bg-[#121212] border border-[#333333] focus:border-[#FFCC00] rounded-xl px-3 py-2 text-white outline-none transition-colors"
                    >
                      <option value="7">پایه هفتم</option>
                      <option value="8">پایه هشتم</option>
                      <option value="9">پایه نهم</option>
                      <option value="10">پایه دهم</option>
                      <option value="11">پایه یازدهم</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1.5">شهر محل سکونت</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="مثال: تهران"
                      className="w-full bg-[#121212] border border-[#333333] focus:border-[#FFCC00] rounded-xl px-3 py-2 text-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1.5">نام مدرسه / مرکز آموزشی</label>
                  <input
                    type="text"
                    value={editForm.school}
                    onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                    placeholder="مثال: دبیرستان علامه حلی ۱"
                    className="w-full bg-[#121212] border border-[#333333] focus:border-[#FFCC00] rounded-xl px-3 py-2 text-white outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#FFCC00] text-black font-bold hover:bg-[#E6B800] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saveLoading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={saveLoading}
                    className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            ) : (
              /* کارت‌های نمایش اطلاعات */
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    نام و نام خانوادگی
                  </span>
                  <span className="text-xs font-bold text-white">
                    {profile?.fullName || 'ثبت نشده'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-[#FFCC00]" />
                    پایه تحصیلی
                  </span>
                  <span className="text-xs font-bold text-[#FFCC00]">
                    {profile?.grade ? formatGrade(profile.grade) : 'تعیین نشده'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    شماره موبایل
                  </span>
                  <span className="text-xs font-mono text-gray-200" dir="ltr">
                    {profile?.phoneNumber || 'ثبت نشده'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    نشانی ایمیل
                  </span>
                  <span className="text-xs font-mono text-gray-200 truncate max-w-[190px]" dir="ltr">
                    {profile?.email || 'حساب مهمان'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <School className="w-3.5 h-3.5 text-gray-500" />
                    مدرسه
                  </span>
                  <span className="text-xs font-medium text-gray-200 truncate max-w-[190px]">
                    {profile?.school && profile.school !== 'نامشخص' ? profile.school : 'ثبت نشده'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    شهر
                  </span>
                  <span className="text-xs font-medium text-gray-200">
                    {profile?.city && profile.city !== 'نامشخص' ? profile.city : 'ثبت نشده'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-gray-400 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    وضعیت اشتراک
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    عضو رسمی کندرلب
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================= */}
        {/* بخش ۲: محصولات و آزمون‌های خریداری‌شده (Purchased Products) */}
        {/* ======================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FFCC00]/10 text-[#FFCC00] flex items-center justify-center">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">محصولات و آزمون‌های خریداری‌شده</h2>
                <p className="text-[11px] text-gray-400">
                  صندلی‌های فعال و آزمون‌های رزرو شده در حساب شما
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white/5 text-gray-300 border border-white/10 min-w-[70px] inline-flex items-center justify-center">
              {loading ? (
                <span className="w-12 h-4 skeleton-shimmer inline-block"></span>
              ) : (
                `${products.length} محصول`
              )}
            </span>
          </div>

          {loading ? (
            /* حالت بلوری شیمر در حال بارگذاری آزمون‌ها و محصولات (Strict Data Loading) */
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-3xl bg-[#16181D]/80 border border-[#2A2E39] p-5 sm:p-6 skeleton-shimmer backdrop-blur-md flex flex-col justify-between min-h-[175px]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-5 bg-white/10 rounded-md"></div>
                        <div className="w-20 h-5 bg-white/10 rounded-md"></div>
                        <div className="w-28 h-5 bg-white/10 rounded-md"></div>
                      </div>
                      <div className="w-52 sm:w-72 h-6 bg-white/10 rounded-lg"></div>
                    </div>
                    <div className="w-24 h-6 bg-white/10 rounded-lg"></div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/5 mb-4">
                    <div className="w-24 h-4 bg-white/5 rounded"></div>
                    <div className="w-24 h-4 bg-white/5 rounded"></div>
                    <div className="w-32 h-4 bg-white/5 rounded"></div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                    <div className="w-32 h-4 bg-white/5 rounded"></div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-8 bg-white/10 rounded-xl"></div>
                      <div className="w-28 h-8 bg-white/10 rounded-xl"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            /* وضعیت خالی بدون خرید (فقط و فقط پس از اتمام واکشی از سرور دیتابیس) */
            <div className="bg-[#181818] border border-[#2E3340] rounded-3xl p-8 text-center shadow-xl space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-gray-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  هنوز محصول یا آزمونی خریداری نکرده‌اید
                </h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  می‌توانید برای شروع سنجش تحلیلی المپیاد زیست‌شناسی، در شبیه‌سازهای جامع بیولوژی کمپبل پایلوت ۱ (رایگان) یا آزمون‌های مرحله اول ثبت‌نام نمایید.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/exams"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFCC00] text-black font-bold hover:bg-[#E6B800] transition-colors text-xs shadow-lg shadow-[#FFCC00]/15"
                >
                  <BookOpen className="w-4 h-4" />
                  مشاهده کاتالوگ آزمون‌ها و ثبت‌نام
                </Link>
              </div>
            </div>
          ) : (
            /* لیست کارت‌های محصولات خریداری‌شده با وضعیت‌های بصری تفکیک‌شده */
            <div className="space-y-4">
              {products.map((item) => {
                const cardState = getExamCardState(item);
                const isLive = cardState.state === 3;
                const isSubmitted = cardState.state === 4 || cardState.state === 5;

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl p-5 sm:p-6 transition-all duration-200 shadow-xl group relative overflow-hidden border ${
                      isLive
                        ? 'bg-gradient-to-br from-[#1F1C14] to-[#16171B] border-amber-500/70 shadow-amber-500/10'
                        : isSubmitted
                        ? 'bg-[#181818] border-emerald-500/30'
                        : cardState.state === 6 || cardState.state === 7
                        ? 'bg-[#141518] border-white/5 opacity-85'
                        : 'bg-[#181818] border-[#2E3340] hover:border-[#FFCC00]/50'
                    }`}
                  >
                    <div
                      className={`absolute top-0 right-0 w-2 h-full ${
                        isLive
                          ? 'bg-amber-500 animate-pulse'
                          : isSubmitted
                          ? 'bg-emerald-500'
                          : cardState.state === 6 || cardState.state === 7
                          ? 'bg-gray-600'
                          : 'bg-[#FFCC00]'
                      }`}
                    ></div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="pr-3">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#FFCC00]/15 text-[#FFCC00] border border-[#FFCC00]/30">
                            {item.type || 'آزمون شبیه‌ساز'}
                          </span>

                          {/* بج وضعیت قطعی کارت بر اساس ماتریس ۷ وضعیتی Rule C */}
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${cardState.statusBadge.className}`}
                          >
                            {cardState.statusBadge.text}
                          </span>

                          {/* بج تکمیلی در انتظار انتشار کارنامه در صورت لزوم */}
                          {cardState.waitingBadge && (
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${cardState.waitingBadge.className}`}
                            >
                              {cardState.waitingBadge.text}
                            </span>
                          )}

                          {item.lockedDeviceId && (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Laptop className="w-3 h-3 text-amber-400" />
                              <span>قفل نشست: <span className="font-mono">{item.lockedDeviceId}</span></span>
                            </span>
                          )}

                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            {item.accessType || 'صندلی رسمی'}
                          </span>

                          <span className="text-[11px] font-mono text-gray-400">
                            سفارش: {item.orderNumber}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#FFCC00] transition-colors">
                          {item.title}
                        </h3>
                      </div>

                      <div className="text-left shrink-0 pr-3 sm:pr-0">
                        <div className="text-sm font-black text-white">
                          {item.price === 0 ? (
                            <span className="text-emerald-400">رایگان (بورسیه پایلوت)</span>
                          ) : (
                            <span>
                              {item.payableAmount?.toLocaleString('fa-IR') || item.price.toLocaleString('fa-IR')}{' '}
                              <span className="text-[10px] font-normal text-gray-400">تومان</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-emerald-400 font-medium block mt-0.5">
                          پرداخت قطعی و تایید شده
                        </span>
                      </div>
                    </div>

                    {/* ویژگی‌های آزمون و نمایش صریح بازه برگزاری آزمون (Rule C) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/5 text-xs text-gray-300 pr-3 mb-4">
                      <div className="flex items-center gap-1.5 col-span-1 sm:col-span-1">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span>مدت آزمون: {item.durationMinutes} دقیقه</span>
                      </div>

                      <div className="flex items-center gap-1.5 col-span-1 sm:col-span-1">
                        <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                        <span>{item.totalQuestions} سوال تحلیلی</span>
                      </div>

                      <div className="flex items-center gap-1.5 col-span-1 sm:col-span-1 text-[#FFCC00]">
                        <Calendar className="w-3.5 h-3.5 text-[#FFCC00]" />
                        <span className="font-medium text-[11px]">{cardState.windowText}</span>
                      </div>
                    </div>

                    {/* دکمه‌های اکشن بر اساس ماتریس ۷ وضعیتی */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 pr-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-500" />
                          {isLive ? 'نشست آزمون فعال روی حساب شما' : 'صندلی فعال و رزرو شده'}
                        </span>

                        {item.lockedDeviceId && (
                          <span className="text-[11px] text-amber-400/90 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            <Laptop className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>آخرین دیوایس قفل‌شده: <span className="font-mono font-bold text-amber-300">{item.lockedDeviceId}</span></span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/exams/${item.slug}`}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-xs transition-colors border border-white/10"
                        >
                          جزئیات
                        </Link>

                        {/* اکشن اختصاصی بر اساس ماتریس ۷ وضعیتی */}
                        {cardState.ctaButton ? (
                          <Link
                            href={cardState.ctaButton.href}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${cardState.ctaButton.className}`}
                          >
                            <span>{cardState.ctaButton.text}</span>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </Link>
                        ) : cardState.state === 1 ? (
                          /* حالت قبل از بازه: بدون دکمه ورود، فقط بج */
                          <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-400 text-xs font-medium border border-white/10">
                            در انتظار شروع بازه آزمون
                          </span>
                        ) : cardState.state === 6 ? (
                          /* حالت غایب بعد از پایان آزمون بدون کارنامه: بج مات خنثی */
                          <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20">
                            غایب — آزمون پایان یافته
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
