'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RotateCcw,
  ShieldCheck,
  GraduationCap,
  School,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatGrade } from '@condorlab/shared';
import { toast } from '@/components/ui/toast';

interface AdminUser {
  id: string;
  role: string;
  email?: string;
  phoneNumber: string;
  fullName: string;
  grade: string;
  school: string;
  city: string;
  attemptsCount: number;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setUsers(json.data);
        }
      }
    } catch {
      toast.error('خطا در دریافت لیست کاربران');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleResetAttempt = async (user: AdminUser) => {
    if (!confirm(`آیا از بازنشانی و ریست تمام تلاش‌های آزمون برای «${user.fullName}» اطمینان دارید؟`)) {
      return;
    }

    try {
      setResettingId(user.id);
      const res = await fetch('/api/admin/attempts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`تلاش‌های آزمون کاربر ${user.fullName} با موفقیت ریست شد.`);
        fetchUsers();
      } else {
        toast.error(data.message || 'خطا در ریست تلاش آزمون.');
      }
    } catch {
      toast.error('خطای شبکه در ارتباط با سرور.');
    } finally {
      setResettingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phoneNumber.includes(searchQuery) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* هدر بخش کاربران */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">مدیریت کاربران و تلاش‌های آزمون</h1>
          <p className="text-xs text-gray-400 mt-1">
            مشاهده جامعه آماری داوطلبان، وضعیت پایه‌های تحصیلی (R-66) و امکان بازنشانی صندلی آزمون جهت آزمون مجدد
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-bold text-xs transition-colors"
        >
          بروزرسانی لیست
        </button>
      </div>

      {/* جستجو */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی نام داوطلب، شماره موبایل یا ایمیل..."
          className="w-full bg-[#14161C] border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50"
        />
      </div>

      {/* جدول کاربران */}
      <div className="bg-[#14161C] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400">
                <th className="p-4 font-bold">نام و مشخصات داوطلب</th>
                <th className="p-4 font-bold">نقش کاربری</th>
                <th className="p-4 font-bold">پایه تحصیلی</th>
                <th className="p-4 font-bold">مدرسه و شهر</th>
                <th className="p-4 font-bold">تعداد تلاش‌ها</th>
                <th className="p-4 font-bold">تاریخ عضویت</th>
                <th className="p-4 font-bold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    در حال بارگذاری لیست کاربران...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    هیچ کاربری مطابق جستجو یافت نشد.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{u.fullName}</div>
                      <div className="font-mono text-[11px] text-gray-400 mt-0.5" dir="ltr">
                        {u.phoneNumber || u.email || 'ثبت نشده'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          u.role === 'MasterAdmin'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : u.role === 'ExamOfficer'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : 'bg-white/5 text-gray-300 border-white/10'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-[#FFCC00]">
                      {/* استاندارد نمایش پایه‌های تحصیلی الزاماً حروفی فارسی - فکت عمومی R-66 */}
                      {formatGrade(u.grade)}
                    </td>
                    <td className="p-4">
                      <div className="text-gray-200">{u.school}</div>
                      <div className="text-[11px] text-gray-500">{u.city}</div>
                    </td>
                    <td className="p-4 font-mono font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/10">
                        {u.attemptsCount} آزمون
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[11px] text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleResetAttempt(u)}
                        disabled={resettingId === u.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50"
                        title="ریست تلاش آزمون و آزاد کردن صندلی برای شرکت دوباره"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${resettingId === u.id ? 'animate-spin' : ''}`} />
                        <span>ریست تلاش</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
