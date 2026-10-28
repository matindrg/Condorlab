'use client';

import * as React from 'react';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { messagesFa, RegisterSchema, StudentGrade, toPersianDigits } from '@condorlab/shared';
import { AlertCircle, Check, X } from 'lucide-react';

function getPasswordStrength(password: string) {
  if (!password) {
    return { score: 0, label: '', color: '', percent: 0, checks: [] };
  }

  const checks = [
    { label: 'حداقل ۸ نویسه', pass: password.length >= 8 },
    { label: 'شامل حروف کوچک و بزرگ (a-z, A-Z)', pass: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'شامل اعداد (۰-۹)', pass: /\d/.test(password) },
    { label: 'شامل نمادها یا کاراکتر ویژه (!@#$%...)', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { score: 1, label: 'خیلی ضعیف', color: 'bg-red-500 text-red-400', percent: 20, checks };
  } else if (score === 2) {
    return { score: 2, label: 'ضعیف', color: 'bg-orange-500 text-orange-400', percent: 40, checks };
  } else if (score === 3) {
    return { score: 3, label: 'متوسط', color: 'bg-amber-500 text-amber-400', percent: 65, checks };
  } else if (score === 4) {
    return { score: 4, label: 'قوی', color: 'bg-emerald-500 text-emerald-400', percent: 85, checks };
  } else {
    return { score: 5, label: 'بسیار قوی', color: 'bg-green-500 text-green-400', percent: 100, checks };
  }
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/student/dashboard';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    grade: '' as string,
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setErrors({});

    const payload = {
      ...formData,
      grade: formData.grade ? (formData.grade as StudentGrade) : undefined,
    };

    const result = RegisterSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setGeneralError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status >= 500 || res.status === 408 || res.status === 502 || res.status === 503 || res.status === 504) {
          setGeneralError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
          return;
        }

        setGeneralError(data?.message || 'خطا در ثبت‌نام. لطفاً مجدداً تلاش فرمایید.');
        return;
      }

      if (!data?.success) {
        setGeneralError(data?.message || 'خطا در ثبت‌نام. لطفاً مجدداً تلاش فرمایید.');
        return;
      }

      if (data.user) {
        try {
          localStorage.setItem('condor_user', JSON.stringify(data.user));
          window.dispatchEvent(new Event('condor_auth_change'));
        } catch {}
      }

      router.push(redirect);
    } catch {
      setGeneralError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 py-10">
      <div className="w-full max-w-lg bg-[#181818] border border-[#2E2E2E] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/favicon.svg" alt="کندرلب" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="text-xl font-black text-white tracking-tight">{messagesFa.common.brandName}</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{messagesFa.auth.signup}</h1>
          <p className="text-xs sm:text-sm text-gray-400">عضویت در پلتفرم سنجش تحلیلی المپیاد زیست‌شناسی</p>
        </div>

        {/* دکمه ورود و ثبت‌نام سریع با گوگل */}
        <button
          type="button"
          onClick={() => alert('ورود با گوگل در فاز تست فعال است')}
          className="w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2C2C2C] border border-[#3A3A3A] text-sm text-white font-medium transition-colors mb-6"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
          <span className="bg-[#181818] px-3 text-xs text-gray-500 font-medium">یا تکمیل فرم ثبت‌نام</span>
        </div>

        {generalError && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium text-right flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="نام"
              placeholder="مثلاً: آرتین"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              error={errors.firstName}
              disabled={isLoading}
            />
            <Input
              label="نام خانوادگی"
              placeholder="مثلاً: رضایی"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              error={errors.lastName}
              disabled={isLoading}
            />
          </div>

          <Input
            label={messagesFa.auth.emailLabel}
            type="email"
            placeholder="student@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
            disabled={isLoading}
            dir="ltr"
            autoComplete="email"
          />

          {/* انتخاب پایه تحصیلی - اختیاری */}
          <Select
            label="پایه تحصیلی (اختیاری — قابل تکمیل در مراحل بعد)"
            value={formData.grade}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            disabled={isLoading}
            error={errors.grade}
          >
            <option value="" className="bg-[#181818] text-gray-400">
              انتخاب بعداً (اختیاری)
            </option>
            <option value={StudentGrade.Grade10} className="bg-[#181818] text-white">
              پایه دهم (کانون اصلی المپیاد)
            </option>
            <option value={StudentGrade.Grade11} className="bg-[#181818] text-white">
              پایه یازدهم (کانون اصلی المپیاد)
            </option>
            <option value={StudentGrade.Grade9} className="bg-[#181818] text-white">
              پایه نهم (مطالعه مقدماتی)
            </option>
            <option value={StudentGrade.Grade8} className="bg-[#181818] text-white">
              پایه هشتم (آزمایشی)
            </option>
            <option value={StudentGrade.Grade7} className="bg-[#181818] text-white">
              پایه هفتم (آزمایشی)
            </option>
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label={messagesFa.auth.passwordLabel}
                type="password"
                placeholder="حداقل ۸ نویسه"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={errors.password}
                disabled={isLoading}
                dir="ltr"
                autoComplete="new-password"
              />
              {formData.password && (
                <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-[#222222] border border-[#2E2E2E] text-right">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      طول رمز: <span className="font-bold text-white">{toPersianDigits(formData.password.length)}</span> کاراکتر
                    </span>
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="text-gray-400">قدرت:</span>
                      <span className={passwordStrength.color.split(' ')[1]}>{passwordStrength.label}</span>
                    </span>
                  </div>

                  {/* نوار قدرت رمز عبور */}
                  <div className="h-1.5 w-full bg-[#181818] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${passwordStrength.color.split(' ')[0]}`}
                      style={{ width: `${passwordStrength.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <Input
                label="تکرار رمز عبور"
                type="password"
                placeholder="تکرار دقیق رمز"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                error={errors.confirmPassword}
                disabled={isLoading}
                dir="ltr"
                autoComplete="new-password"
              />
              {formData.confirmPassword && (
                <div className="mt-2 text-xs text-right">
                  {formData.password === formData.confirmPassword ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 inline" /> تکرار رمز عبور مطابقت دارد
                    </span>
                  ) : (
                    <span className="text-amber-400/90 flex items-center gap-1">
                      <X className="w-3.5 h-3.5 inline" /> هنوز با رمز عبور اصلی یکسان نیست
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* تیک واحد پذیرش قوانین و رضایت سرپرست */}
          <div className="pt-2 text-right">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                className="mt-1 w-4 h-4 rounded text-[#FFCC00] bg-[#181818] border-[#3A3A3A] focus:ring-[#FFCC00]"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                قوانین آزمون، سیاست‌های حریم خصوصی و رضایت والد/سرپرست قانونی جهت عضویت در کندرلب را می‌پذیرم.
              </span>
            </label>
            {errors.termsAccepted && <p className="mt-1 text-xs text-red-400">{errors.termsAccepted}</p>}
          </div>

          <Button type="submit" variant="primary" isLoading={isLoading} className="w-full mt-6">
            {messagesFa.auth.signup}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link
            href={`/login${redirect !== '/student/dashboard' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="text-[#FFCC00] font-bold hover:underline"
          >
            {messagesFa.auth.login}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">در حال بارگذاری...</div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
