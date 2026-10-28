'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  PackageCheck,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Save,
  Search,
  Check,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface ProductItem {
  id: string;
  slug: string;
  title: string;
  price: number;
  status: 'active' | 'inactive';
  category: string;
  capacity?: number;
  enrolledCount: number;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // استیت ویرایش درون‌خطی قیمت
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [savingPrice, setSavingPrice] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/products', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setProducts(json.data);
        }
      }
    } catch {
      toast.error('خطا در دریافت لیست محصولات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ابطال دستی کش تگ‌خورده سرور و کلاینت
  const handleRevalidateCache = async () => {
    try {
      setRevalidating(true);
      const res = await fetch('/api/revalidate?tag=store-products', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('کش محصولات فروشگاه با موفقیت ابطال و نوسازی شد.');
        window.dispatchEvent(new CustomEvent('condor:invalidate:store'));
      } else {
        toast.error('خطا در ابطال کش فروشگاه.');
      }
    } catch {
      toast.error('خطای شبکه در ابطال کش.');
    } finally {
      setRevalidating(false);
    }
  };

  const handleStartEdit = (p: ProductItem) => {
    setEditingId(p.id || p.slug);
    setEditPrice(p.price);
  };

  const handleSavePrice = async (p: ProductItem) => {
    try {
      setSavingPrice(true);
      const res = await fetch(`/api/admin/products/${p.id || p.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: editPrice }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`قیمت ${p.title} با موفقیت بروزرسانی شد.`);
        setEditingId(null);
        fetchProducts();
        // ابطال خودکار کش فروشگاه
        fetch('/api/revalidate?tag=store-products', { method: 'POST' }).catch(() => null);
        window.dispatchEvent(new CustomEvent('condor:invalidate:store'));
      } else {
        toast.error(data.message || 'خطا در ثبت قیمت');
      }
    } catch {
      toast.error('خطای شبکه.');
    } finally {
      setSavingPrice(false);
    }
  };

  const handleToggleActive = async (p: ProductItem) => {
    const newActive = p.status !== 'active';
    try {
      const res = await fetch(`/api/admin/products/${p.id || p.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: p.price, isActive: newActive }),
      });
      if (res.ok) {
        toast.success(`وضعیت به ${newActive ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
        fetchProducts();
        fetch('/api/revalidate?tag=store-products', { method: 'POST' }).catch(() => null);
      }
    } catch {
      toast.error('خطا در تغییر وضعیت محصول.');
    }
  };

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* هدر بخش محصولات */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">محصولات و قیمت‌گذاری فروشگاه</h1>
          <p className="text-xs text-gray-400 mt-1">
            تنظیم قیمت صندلی‌های آزمون، فعال/غیرفعال‌سازی در کاتالوگ و کنترل ابطال کش (On-Demand Cache Revalidation)
          </p>
        </div>

        <button
          onClick={handleRevalidateCache}
          disabled={revalidating}
          className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${revalidating ? 'animate-spin' : ''}`} />
          <span>{revalidating ? 'در حال ابطال کش...' : 'ابطال بلادرنگ کش فروشگاه (Revalidate)'}</span>
        </button>
      </div>

      {/* جستجو */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی نام آزمون و محصول..."
          className="w-full bg-[#14161C] border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50"
        />
      </div>

      {/* جدول محصولات */}
      <div className="bg-[#14161C] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400">
                <th className="p-4 font-bold">نام محصول / آزمون</th>
                <th className="p-4 font-bold">دسته‌بندی</th>
                <th className="p-4 font-bold">ظرفیت صندلی</th>
                <th className="p-4 font-bold">تعداد ثبت‌نامی</th>
                <th className="p-4 font-bold">قیمت جاری (تومان)</th>
                <th className="p-4 font-bold">وضعیت کاتالوگ</th>
                <th className="p-4 font-bold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    در حال دریافت داده‌های فروشگاه...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    محصولی یافت نشد.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isEditingThis = editingId === (p.id || p.slug);

                  return (
                    <tr key={p.id || p.slug} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{p.title}</div>
                        <div className="font-mono text-[11px] text-gray-500 mt-0.5">{p.slug}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-bold">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        {p.capacity ? `${p.capacity} نفر` : 'نامحدود'}
                      </td>
                      <td className="p-4 font-mono font-bold text-[#FFCC00]">
                        {p.enrolledCount} نفر
                      </td>
                      <td className="p-4">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(Number(e.target.value))}
                              min={0}
                              step={1000}
                              className="w-24 bg-[#181A20] border border-[#FFCC00] rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none"
                            />
                            <button
                              onClick={() => handleSavePrice(p)}
                              disabled={savingPrice}
                              className="p-1 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
                              title="ذخیره قیمت"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded-lg bg-white/10 text-gray-300 hover:text-white transition-colors"
                              title="انصراف"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-sm">
                              {p.price === 0 ? (
                                <span className="text-emerald-400">رایگان</span>
                              ) : (
                                p.price.toLocaleString('fa-IR')
                              )}
                            </span>
                            <button
                              onClick={() => handleStartEdit(p)}
                              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                              title="ویرایش قیمت"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                            p.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                          }`}
                        >
                          {p.status === 'active' ? 'فعال در فروشگاه' : 'غیرفعال'}
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleStartEdit(p)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-bold transition-colors"
                        >
                          تغییر قیمت
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
