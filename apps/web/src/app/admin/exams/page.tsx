'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Search,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface AdminExam {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: 'Draft' | 'Published';
  startTime: string;
  endTime: string;
  windowStartTime: string;
  windowEndTime: string;
  durationMinutes: number;
  price: number;
  capacity?: number;
  isCapacityVisible?: boolean;
  totalQuestions: number;
  attemptsCount: number;
}

export default function AdminExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // استیت‌های مودال ایجاد / ویرایش
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<AdminExam | null>(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    category: 'campbell',
    durationMinutes: 120,
    price: 0,
    capacity: 200,
    isCapacityVisible: true,
    startTime: '',
    endTime: '',
    status: 'Published' as 'Draft' | 'Published',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/exams', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setExams(json.data);
        }
      }
    } catch {
      toast.error('خطا در دریافت لیست آزمون‌ها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleOpenCreate = () => {
    setEditingExam(null);
    const now = new Date();
    const futureStart = new Date(now.getTime() + 24 * 3600 * 1000);
    const futureEnd = new Date(now.getTime() + 48 * 3600 * 1000);

    setForm({
      title: '',
      slug: '',
      category: 'campbell',
      durationMinutes: 120,
      price: 0,
      capacity: 200,
      isCapacityVisible: true,
      startTime: futureStart.toISOString().slice(0, 16),
      endTime: futureEnd.toISOString().slice(0, 16),
      status: 'Published',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exam: AdminExam) => {
    setEditingExam(exam);
    setForm({
      title: exam.title,
      slug: exam.slug,
      category: exam.category || 'campbell',
      durationMinutes: exam.durationMinutes,
      price: exam.price || 0,
      capacity: exam.capacity || 200,
      isCapacityVisible: exam.isCapacityVisible ?? true,
      startTime: exam.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '',
      endTime: exam.endTime ? new Date(exam.endTime).toISOString().slice(0, 16) : '',
      status: exam.status,
    });
    setIsModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingExam) {
        // بروزرسانی
        const res = await fetch(`/api/admin/exams/${editingExam.id || editingExam.slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success('آزمون با موفقیت ویرایش شد.');
          setIsModalOpen(false);
          fetchExams();
        } else {
          toast.error(data.message || 'خطا در ویرایش آزمون');
        }
      } else {
        // ایجاد جدید
        const res = await fetch('/api/admin/exams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success('آزمون جدید با موفقیت ایجاد شد.');
          setIsModalOpen(false);
          fetchExams();
        } else {
          toast.error(data.message || 'خطا در ایجاد آزمون');
        }
      }
    } catch {
      toast.error('خطای شبکه در ارتباط با سرور.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (idOrSlug: string) => {
    if (!confirm('آیا از حذف این آزمون اطمینان دارید؟')) return;

    try {
      const res = await fetch(`/api/admin/exams/${idOrSlug}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('آزمون با موفقیت حذف شد.');
        fetchExams();
      }
    } catch {
      toast.error('خطا در حذف آزمون.');
    }
  };

  const filteredExams = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* هدر بخش مدیریت آزمون‌ها */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">مدیریت آزمون‌ها و زمان‌بندی</h1>
          <p className="text-xs text-gray-400 mt-1">
            تعریف آزمون‌های شبیه‌ساز، تنظیم پنجره‌های زمانی برگزاری، ظرفیت و اتصال به بانک سؤالات
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black text-xs transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>تعریف آزمون جدید</span>
        </button>
      </div>

      {/* جستجو و فیلتر */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی عنوان یا اسلاگ آزمون..."
          className="w-full bg-[#14161C] border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50"
        />
      </div>

      {/* جدول آزمون‌ها */}
      <div className="bg-[#14161C] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400">
                <th className="p-4 font-bold">عنوان و اسلاگ آزمون</th>
                <th className="p-4 font-bold">دسته‌بندی</th>
                <th className="p-4 font-bold">بازه زمانی برگزاری</th>
                <th className="p-4 font-bold">مدت داوطلب</th>
                <th className="p-4 font-bold">سؤالات</th>
                <th className="p-4 font-bold">قیمت (تومان)</th>
                <th className="p-4 font-bold">وضعیت</th>
                <th className="p-4 font-bold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    در حال بارگذاری اطلاعات آزمون‌ها...
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    هیچ آزمونی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => (
                  <tr key={exam.id || exam.slug} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{exam.title}</div>
                      <div className="font-mono text-[11px] text-gray-500 mt-0.5">{exam.slug}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-bold">
                        {exam.category === 'campbell'
                          ? 'کمپبل'
                          : exam.category === 'stage1'
                          ? 'مرحله اول'
                          : exam.category === 'stage2'
                          ? 'مرحله دوم'
                          : exam.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-[11px] font-mono text-gray-300">
                        {new Date(exam.startTime).toLocaleDateString('fa-IR')}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        تا {new Date(exam.endTime).toLocaleDateString('fa-IR')}
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-white">
                      {exam.durationMinutes} دقیقه
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/admin/exams/${exam.slug}/questions`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFCC00]/10 text-[#FFCC00] hover:bg-[#FFCC00]/20 font-bold border border-[#FFCC00]/20 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{exam.totalQuestions} سؤال</span>
                      </Link>
                    </td>
                    <td className="p-4 font-mono font-bold">
                      {exam.price === 0 ? (
                        <span className="text-emerald-400">رایگان</span>
                      ) : (
                        `${exam.price.toLocaleString('fa-IR')}`
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          exam.status === 'Published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {exam.status === 'Published' ? 'منتشر شده' : 'پیش‌نویس'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(exam)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                          title="ویرایش زمان‌بندی و متادیتا"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exam.id || exam.slug)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="حذف آزمون"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال ایجاد یا ویرایش آزمون */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161C] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h2 className="text-base font-bold text-white">
                {editingExam ? 'ویرایش مشخصات آزمون' : 'تعریف آزمون شبیه‌ساز جدید'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1.5 font-bold">عنوان کامل آزمون:</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: شبیه‌ساز مرحله اول المپیاد کشوری"
                  required
                  className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#FFCC00]/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">شناسه یکتا (Slug):</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="campbell-test-1"
                    required
                    disabled={!!editingExam}
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">دسته‌بندی:</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#FFCC00]/60"
                  >
                    <option value="campbell">سرفصلی بیولوژی کمپبل</option>
                    <option value="stage1">مرحله اول المپیاد</option>
                    <option value="stage2">مرحله دوم و مسئله‌محور</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">مدت آزمون داوطلب (دقیقه):</label>
                  <input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    min={1}
                    required
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">قیمت صندلی (تومان):</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    min={0}
                    step={1000}
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">شروع بازه زمانی (StartTime):</label>
                  <input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60 text-left"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">پایان بازه زمانی (EndTime):</label>
                  <input
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    required
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60 text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">ظرفیت صندلی:</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    min={1}
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#FFCC00]/60"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1.5 font-bold">وضعیت انتشار:</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full bg-[#181A20] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#FFCC00]/60"
                  >
                    <option value="Published">منتشر شده (فعال برای خرید و شرکت)</option>
                    <option value="Draft">پیش‌نویس (غیرفعال)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#FFCC00] hover:bg-[#FFD633] text-black font-black transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'در حال ثبت...' : 'ذخیره مشخصات آزمون'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
