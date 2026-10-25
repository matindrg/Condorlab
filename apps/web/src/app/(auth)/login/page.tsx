'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { messagesFa, LoginSchema } from '@condorlab/shared';

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
            <span className="text-2xl">🧬</span>
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
          <span className="text-base">🌐</span>
          <span>{messagesFa.auth.googleLogin}</span>
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-[#333333] w-full"></div>
          <span className="bg-[#181818] px-3 text-xs text-gray-500 font-medium">یا با ایمیل</span>
        </div>

        {/* پیام خطای کلی */}
        {generalError && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium text-right">
            ⚠️ {generalError}
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
