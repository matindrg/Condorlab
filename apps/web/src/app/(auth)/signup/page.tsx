'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { messagesFa, RegisterSchema, StudentGrade } from '@condorlab/shared';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    grade: StudentGrade.Grade10,
    termsAccepted: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setErrors({});

    const result = RegisterSchema.safeParse(formData);
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setGeneralError(data.message || 'خطا در ثبت‌نام. لطفاً مجدداً تلاش فرمایید.');
        return;
      }

      router.push('/student/dashboard');
    } catch {
      setGeneralError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 py-10">
      <div className="w-full max-w-lg bg-[#181818] border border-[#2E2E2E] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-2xl">🧬</span>
            <span className="text-xl font-black text-white tracking-tight">{messagesFa.common.brandName}</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{messagesFa.auth.signup}</h1>
          <p className="text-xs sm:text-sm text-gray-400">عضویت در پلتفرم سنجش تحلیلی المپیاد زیست‌شناسی</p>
        </div>

        {generalError && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium text-right">
            ⚠️ {generalError}
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

          {/* انتخاب پایه تحصیلی با ممانعت از پایه دوازدهم */}
          <div className="text-right">
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">
              پایه تحصیلی (المپیاد زیست)
            </label>
            <select
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value as StudentGrade })}
              disabled={isLoading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#181818] border border-[#333333] focus:border-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00]/20 text-white text-sm focus:outline-none transition-all"
            >
              <option value={StudentGrade.Grade10}>پایه دهم (کانون اصلی المپیاد)</option>
              <option value={StudentGrade.Grade11}>پایه یازدهم (کانون اصلی المپیاد)</option>
              <option value={StudentGrade.Grade9}>پایه نهم (مطالعه مقدماتی)</option>
              <option value={StudentGrade.Grade8}>پایه هشتم (آزمایشی)</option>
              <option value={StudentGrade.Grade7}>پایه هفتم (آزمایشی)</option>
            </select>
            {errors.grade && <p className="mt-1.5 text-xs text-red-400">{errors.grade}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Link href="/login" className="text-[#FFCC00] font-bold hover:underline">
            {messagesFa.auth.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
