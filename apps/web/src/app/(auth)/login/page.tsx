'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { messagesFa, LoginSchema } from '@condorlab/shared';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setErrors({});

    // اعتبارسنجی فرانت‌اند با Zod
    const result = LoginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGeneralError(data.message || messagesFa.auth.invalidCredentials);
        return;
      }

      // هدایت به داشبورد پس از لاگین موفق
      router.push('/student/dashboard');
    } catch {
      setGeneralError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت را بررسی فرمایید.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[#181818] border border-[#2E2E2E] rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* نشان و هدر فرم */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/favicon.svg" alt="کندرلب" width={32} height={32} className="w-8 h-8 rounded-lg shadow-sm shrink-0" />
            <span className="text-xl font-black text-white tracking-tight">{messagesFa.common.brandName}</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{messagesFa.auth.login}</h1>
          <p className="text-xs sm:text-sm text-gray-400">به جامعه نخبگان المپیاد زیست‌شناسی خوش آمدید</p>
        </div>

        {/* دکمه ورود سریع با گوگل */}
        <button
          type="button"
          onClick={() => alert('ورود با گوگل در فاز تست فعال است')}
          className="w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2C2C2C] border border-[#3A3A3A] text-sm text-white font-medium transition-colors mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{messagesFa.auth.googleLogin}</span>
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-[#333333] w-full"></div>
          <span className="bg-[#181818] px-3 text-xs text-gray-500 font-medium">یا با ایمیل</span>
        </div>

        {/* پیام خطای کلی */}
        {generalError && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium text-right flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* فرم لاگین */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={messagesFa.auth.emailLabel}
            type="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={isLoading}
            dir="ltr"
            autoComplete="email"
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Link href="/forgot-password" className="text-xs text-[#FFCC00] hover:underline">
                {messagesFa.auth.forgotPassword}
              </Link>
              <label className="text-xs sm:text-sm font-medium text-gray-300">
                {messagesFa.auth.passwordLabel}
              </label>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={isLoading}
              dir="ltr"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" variant="primary" isLoading={isLoading} className="w-full mt-6">
            {messagesFa.auth.login}
          </Button>
        </form>

        {/* فوتر فرم و لینک به ثبت‌نام */}
        <p className="mt-8 text-center text-xs text-gray-400">
          حساب کاربری ندارید؟{' '}
          <Link href="/signup" className="text-[#FFCC00] font-bold hover:underline">
            {messagesFa.auth.signup}
          </Link>
        </p>
      </div>
    </div>
  );
}
