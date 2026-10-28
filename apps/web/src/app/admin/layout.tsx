'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  LayoutDashboard,
  GraduationCap,
  PackageCheck,
  Users,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  Sparkles,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isMounted } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // بستن خودکار دراور موبایل هنگام تغییر مسیر
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // بستن دراور با کلید Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // در صورت عدم احراز هویت اولیه یا لودینگ
  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-[#0E0F12] text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium">در حال بررسی سطح دسترسی مدیریت...</p>
        </div>
      </div>
    );
  }

  // گیت امنیت دسترسی: کاربران عادی (Student) اجازه ورود به پنل ادمین را ندارند
  const isAdmin = user && user.role !== 'Student';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0E0F12] text-white flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-[#16181D] border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-rose-400 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 inline-block mb-2">
              خطای دسترسی ۴۰۳
            </span>
            <h1 className="text-xl font-black text-white">دسترسی غیرمجاز به پنل مدیریت</h1>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              این بخش منحصراً برای مدیران ارشد، مسئولان آزمون و کادر علمی کندرلب در دسترس است. حساب شما با نقش{' '}
              <strong className="text-white font-mono">({user?.role || 'Guest'})</strong> مجاز به مشاهده این اطلاعات نیست.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="flex-1 py-3 px-5 text-xs font-bold text-black bg-[#FFCC00] hover:bg-[#FFD633] rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>بازگشت به صفحه اصلی</span>
            </Link>
            <Link
              href="/student/dashboard"
              className="px-5 py-3 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 flex items-center justify-center"
            >
              داشبورد دانش‌آموزی
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      title: 'پیشخوان مدیریت',
      href: '/admin',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      title: 'مدیریت آزمون‌ها',
      href: '/admin/exams',
      icon: GraduationCap,
      exact: false,
    },
    {
      title: 'محصولات و فروشگاه',
      href: '/admin/products',
      icon: PackageCheck,
      exact: false,
    },
    {
      title: 'کاربران و تلاش‌ها',
      href: '/admin/users',
      icon: Users,
      exact: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0E0F12] text-foreground font-sans flex flex-col md:flex-row" dir="rtl">
      {/* ۱. هدر اختصاصی موبایل (بر اساس استاندارد UI/UX Pro Max) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#14161C]/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FFCC00] text-black font-black flex items-center justify-center text-xs shadow-md shadow-[#FFCC00]/20">
            CL
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white">کندرلب</span>
              <span className="text-[9px] text-amber-400 font-mono px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                ADMIN
              </span>
            </div>
            <div className="text-[9px] text-gray-400 font-medium">پنل مدیریت</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="باز کردن منو"
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          <Menu className="w-5 h-5 text-gray-200" />
        </button>
      </header>

      {/* ۲. بک‌دراپ و دراور کشویی موبایل (Off-canvas Drawer) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 animate-fadeIn"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-[#14161C] border-l border-white/10 shadow-2xl flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="منوی مدیریت کندرلب"
      >
        {/* هدر دراور موبایل */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFCC00] text-black font-black flex items-center justify-center text-xs shadow-md shadow-[#FFCC00]/20">
              CL
            </div>
            <span className="text-xs font-black text-white">منوی مدیریت کندرلب</span>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="بستن منو"
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* مشخصات کاربر در دراور */}
        <div className="p-4 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">
                {user?.profile?.fullName || user?.phoneNumber || 'مدیر سامانه'}
              </div>
              <div className="text-[10px] font-mono text-amber-400">{user?.role}</div>
            </div>
          </div>
        </div>

        {/* لینک‌های ناوبری دراور موبایل */}
        <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-[#FFCC00] text-black shadow-md shadow-[#FFCC00]/15 font-black'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.title}</span>
                </div>
                {isActive && <ChevronLeft className="w-4 h-4" />}
              </Link>
            );
          })}
        </nav>

        {/* فوتر دراور */}
        <div className="p-3 border-t border-white/5">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors min-h-[44px]"
          >
            <ExternalLink className="w-4 h-4" />
            <span>مشاهده پلتفرم کندرلب</span>
          </Link>
        </div>
      </div>

      {/* ۳. سایدبار دسکتاپ (دسترسی دسکتاپ MD و بالاتر) */}
      <aside className="hidden md:flex md:w-64 bg-[#14161C] border-l border-white/5 flex-col shrink-0 min-h-screen sticky top-0 h-screen">
        {/* برند و عنوان پنل دسکتاپ */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFCC00] text-black font-black flex items-center justify-center shadow-lg shadow-[#FFCC00]/20">
              CL
            </div>
            <div>
              <div className="text-sm font-black text-white flex items-center gap-1.5">
                <span>کندرلب</span>
                <span className="text-[10px] text-amber-400 font-mono px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                  ADMIN
                </span>
              </div>
              <div className="text-[10px] text-gray-400 font-medium">سامانه مدیریت و ارزیابی</div>
            </div>
          </div>
        </div>

        {/* مشخصات کاربر ادمین */}
        <div className="p-4 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">
                {user?.profile?.fullName || user?.phoneNumber || 'مدیر سامانه'}
              </div>
              <div className="text-[10px] font-mono text-amber-400">{user?.role}</div>
            </div>
          </div>
        </div>

        {/* منوهای اصلی دسکتاپ */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#FFCC00] text-black shadow-md shadow-[#FFCC00]/15 font-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.title}</span>
                </div>
                {isActive && <ChevronLeft className="w-3.5 h-3.5" />}
              </Link>
            );
          })}
        </nav>

        {/* فوتر سایدبار با لینک بازگشت به پلتفرم */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>مشاهده پلتفرم کندرلب</span>
          </Link>
        </div>
      </aside>

      {/* ۴. محتوای صفحات پنل مدیریت */}
      <main className="flex-1 overflow-x-hidden min-h-screen bg-[#0E0F12]">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
