'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  UserCheck,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  Search,
} from 'lucide-react';
import { LogoutDialog } from '@/components/logout-dialog';
import { toast } from '@/components/ui/toast';

export interface AuthUser {
  id: string;
  role: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    grade?: string;
    school?: string;
    city?: string;
    phoneNumber?: string;
  };
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLDivElement>(null);

  // پس از ماونت شدن کلاینت، وضعیت کش محلی را بخوانیم
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const platform = (window.navigator as any)?.userAgentData?.platform || window.navigator.platform || window.navigator.userAgent || '';
      setIsMac(/mac/i.test(platform));
    }
    try {
      const cached = localStorage.getItem('condor_user');
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch {
      // ignore
    }
  }, []);

  // بررسی وضعیت احراز هویت با بک‌اند و همگام‌سازی کش
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          try {
            localStorage.setItem('condor_user', JSON.stringify(data.user));
          } catch {}
          return;
        }
      }

      // اگر سرور صراحتاً ۴۰۱ داد و کاربر معتبری وجود نداشت
      if (res.status === 401) {
        // اگر لوکال استوریج قبلی منقضی شده بود
        setUser(null);
        try {
          localStorage.removeItem('condor_user');
        } catch {}
      }
    } catch {
      // در صورت خطای شبکه، دیتای کش‌شده در استیت حفظ می‌شود
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // شنود رویداد تغییر وضعیت لاگین در کل اپلیکیشن (صفحه لاگین، ثبت‌نام، تسویه‌حساب)
    const handleAuthChange = () => {
      try {
        const cached = localStorage.getItem('condor_user');
        setUser(cached ? JSON.parse(cached) : null);
      } catch {
        setUser(null);
      }
      setIsLoading(false);
    };

    window.addEventListener('condor_auth_change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('condor_auth_change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [pathname, checkAuth]);

  // بستن خودکار منوها هنگام تغییر مسیر (Navigation)
  useEffect(() => {
    setIsDropdownOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  // تشخیص کلیک در هر جای صفحه بیرون از دراپ‌داون جهت بستن آنی (Outside Click)
  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;

      // بستن منوی بازشونده پروفایل دسکتاپ در صورت کلیک در هر نقطه دیگر
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }

      // بستن کشوی منوی موبایل در صورت کلیک در خارج از کشو و دکمه تاگل
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        mobileToggleRef.current &&
        !mobileToggleRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMenuOpen(false);
      }
    }

    if (isDropdownOpen || isMenuOpen) {
      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('touchstart', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen, isMenuOpen]);

  const handleLogoutConfirmed = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }

    try {
      localStorage.removeItem('condor_user');
      localStorage.removeItem('condor_enrolled_exams');
    } catch {}

    window.dispatchEvent(new Event('condor_auth_change'));
    setUser(null);
    setIsLogoutDialogOpen(false);
    setIsLoggingOut(false);
    setIsDropdownOpen(false);
    setIsMenuOpen(false);

    toast.success('با موفقیت خارج شدید', 'از همراهی شما با کندرلب سپاسگزاریم.');

    // اگر کاربر داخل داشبورد یا تسویه‌حساب باشد، به صفحه اصلی هدایت می‌شود
    if (pathname?.startsWith('/student') || pathname?.startsWith('/checkout')) {
      router.push('/');
    } else {
      router.refresh();
    }
  };

  const navLinks = [
    { href: '/', label: 'خانه' },
    { href: '/exams', label: 'کاتالوگ آزمون‌ها' },
    ...(user ? [{ href: '/student/dashboard', label: 'داشبورد من' }] : []),
  ];

  // عدم نمایش هدر در صفحات اختصاصی ورود و ثبت‌نام
  if (pathname === '/login' || pathname === '/signup' || pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-[#121418]/90 backdrop-blur-md border-b border-white/10 text-right">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* سمت راست (RTL): نشان برند و پیوندهای ناوبری اصلی */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/favicon.svg"
              alt="کندرلب"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="text-xl font-black text-white tracking-tight">
              کندر<span className="text-[#FFCC00]">لب</span>
            </span>
          </Link>

          {/* پیوندهای دسکتاپ */}
          <nav className="hidden md:flex items-center gap-1 text-xs sm:text-sm font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'text-[#FFCC00] bg-[#FFCC00]/10 font-bold'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* سمت چپ (RTL): وضعیت احراز هویت دسکتاپ */}
        <div className="hidden md:flex items-center gap-3">
          {!mounted || (isLoading && !user) ? (
            <div className="w-28 h-9 bg-white/5 rounded-xl skeleton-pulse"></div>
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#1A1D24] border transition-all text-right select-none ${
                  isDropdownOpen
                    ? 'border-[#FFCC00] ring-2 ring-[#FFCC00]/20'
                    : 'border-[#2E3340] hover:border-[#FFCC00]/50'
                }`}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-black font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {user.profile?.firstName?.[0] || 'د'}
                </div>
                <div className="text-xs">
                  <span className="text-white font-bold block leading-none mb-1">
                    {user.profile?.firstName
                      ? `${user.profile.firstName} ${user.profile.lastName || ''}`
                      : 'داوطلب المپیاد'}
                  </span>
                  <span className="text-[10px] text-[#FFCC00] font-mono leading-none">
                    {user.profile?.grade ? `پایه ${user.profile.grade}` : 'عضو رسمی'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 mr-1 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-[#FFCC00]' : ''
                  }`}
                />
              </button>

              {/* منوی بازشونده کشویی پروفایل کاربر با محو شدن آنی هنگام کلیک در هر کجای صفحه */}
              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-[#16181F] border border-[#2B303D] shadow-2xl p-2 z-50 text-xs">
                  <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 mb-1.5 text-right">
                    <div className="text-[11px] text-gray-400 mb-0.5">مشخصات پرونده داوطلب:</div>
                    <div className="text-white font-bold text-xs truncate">
                      {user.profile?.firstName
                        ? `${user.profile.firstName} ${user.profile.lastName || ''}`
                        : 'کاربر رسمی کندرلب'}
                    </div>
                    <div className="text-[11px] text-[#FFCC00] mt-0.5 font-medium">
                      {user.profile?.grade ? `پایه ${user.profile.grade}` : 'پایه نامشخص'}
                      {user.profile?.school ? ` • ${user.profile.school}` : ''}
                      {user.profile?.city ? ` (${user.profile.city})` : ''}
                    </div>
                  </div>

                  <Link
                    href="/student/dashboard"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#FFCC00]" />
                    <span className="font-medium">داشبورد و آزمون‌های من</span>
                  </Link>

                  <div className="my-1 border-t border-white/5"></div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsLogoutDialogOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-medium text-right"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>خروج از حساب کاربری</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
              >
                ورود
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-xl bg-[#FFCC00] text-black font-bold hover:bg-[#E6B800] transition-colors shadow-sm shadow-[#FFCC00]/15"
              >
                ثبت‌نام سریع
              </Link>
            </div>
          )}
        </div>

        {/* دکمه‌های کنترل موبایل (آواتار کاربر + دکمه منو همبرگری) */}
        <div ref={mobileToggleRef} className="flex md:hidden items-center gap-1.5">
          {user && (
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="پروفایل کاربر"
              className="flex items-center gap-1.5 p-1 rounded-xl bg-[#1A1D24] border border-[#2E3340] hover:border-[#FFCC00]/50 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-black font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                {user.profile?.firstName?.[0] || 'د'}
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? 'بستن منو' : 'باز کردن منو'}
            className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5 text-[#FFCC00]" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* کشوی منوی موبایل */}
      {isMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden border-t border-white/10 bg-[#14161C]/95 backdrop-blur-xl px-4 py-4 space-y-4 shadow-2xl"
        >
          {/* وضعیت کاربر لاگین‌شده در نمای موبایل */}
          {user ? (
            <div className="p-3.5 rounded-2xl bg-[#1D2028] border border-[#2E3340] space-y-3 text-right">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCC00] to-[#E6B800] text-black font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                  {user.profile?.firstName?.[0] || 'د'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">
                    {user.profile?.firstName
                      ? `${user.profile.firstName} ${user.profile.lastName || ''}`
                      : 'کاربر کندرلب'}
                  </div>
                  <div className="text-[11px] text-[#FFCC00] mt-0.5 font-medium">
                    {user.profile?.grade ? `پایه ${user.profile.grade}` : 'عضو رسمی'}
                    {user.profile?.school ? ` • ${user.profile.school}` : ''}
                    {user.profile?.city ? ` (${user.profile.city})` : ''}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
                <Link
                  href="/student/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#242833] hover:bg-[#2A303D] text-xs font-bold text-white transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-[#FFCC00]" />
                  <span>ورود به داشبورد دانش‌آموز</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsLogoutDialogOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-right"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج از حساب کاربری</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/login"
                onClick={() => setIsMenuOpen(false)}
                className="py-2.5 text-center text-xs text-white bg-[#1E212A] hover:bg-[#262B36] rounded-xl font-bold border border-white/5 transition-colors"
              >
                ورود
              </Link>
              <Link
                href="/signup"
                onClick={() => setIsMenuOpen(false)}
                className="py-2.5 text-center text-xs text-black bg-[#FFCC00] hover:bg-[#E6B800] rounded-xl font-bold transition-colors shadow-sm shadow-[#FFCC00]/15"
              >
                ثبت‌نام سریع
              </Link>
            </div>
          )}

          {/* پیوندهای اصلی ناوبری در موبایل */}
          <nav className="flex flex-col space-y-1 pt-1 text-right">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-[#FFCC00] bg-[#FFCC00]/10 font-bold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <LogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoading={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={handleLogoutConfirmed}
      />
    </header>
  );
}
