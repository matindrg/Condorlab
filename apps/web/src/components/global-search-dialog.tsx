'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X, BookOpen, ExternalLink, ArrowRight, CornerDownLeft } from 'lucide-react';
import { ExamSummary, formatToman, toPersianDigits } from '@condorlab/shared';

interface SearchItem {
  id: string;
  title: string;
  category: 'آزمون' | 'صفحه' | 'بخش';
  href: string;
  badge?: string;
  subtitle?: string;
}

const STATIC_NAV_ITEMS: SearchItem[] = [
  { id: 'nav-home', title: 'صفحه اصلی کندرلب', category: 'صفحه', href: '/', subtitle: 'معرفی پلتفرم، ویژگی‌ها و نقشه راه المپیاد' },
  { id: 'nav-exams', title: 'کاتالوگ آزمون‌ها', category: 'صفحه', href: '/exams', subtitle: 'مشاهده تمام آزمون‌های فعال و سرفصل‌های بیولوژی کمپبل' },
  { id: 'nav-login', title: 'ورود به حساب کاربری', category: 'صفحه', href: '/login', subtitle: 'ورود داوطلبان با شماره موبایل و رمز عبور' },
  { id: 'nav-signup', title: 'ثبت‌نام داوطلب جدید', category: 'صفحه', href: '/signup', subtitle: 'ایجاد حساب کاربری و تعیین پایه تحصیلی و مدرسه' },
  { id: 'nav-vol1', title: 'جلد ۱ بیولوژی کمپبل (شیمی حیات)', category: 'بخش', href: '/exams?volume=1', subtitle: 'آب، کربن، مولکول‌های زیستی و درشت‌مولکول‌ها' },
  { id: 'nav-vol2', title: 'جلد ۲ بیولوژی کمپبل (سلول و متابولیسم)', category: 'بخش', href: '/exams?volume=2', subtitle: 'ساختار غشا، تنفس سلولی، فتوسنتز و پیام‌رسانی' },
  { id: 'nav-vol3', title: 'جلد ۳ بیولوژی کمپبل (ژنتیک)', category: 'بخش', href: '/exams?volume=3', subtitle: 'میوز، مندل، کروموزوم‌ها و بیان ژن' },
  { id: 'nav-vol4', title: 'جلد ۴ بیولوژی کمپبل (سازوکار تکامل)', category: 'بخش', href: '/exams?volume=4', subtitle: 'تغییر گونه‌ها، فیلوژنی و تاریخ حیات' },
  { id: 'nav-vol5', title: 'جلد ۵ بیولوژی کمپبل (فیزیولوژی گیاهی)', category: 'بخش', href: '/exams?volume=5', subtitle: 'ساختار گیاهان، انتقال مواد، هورمون‌ها و تولیدمثل' },
];

export function GlobalSearchDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // تشخیص سیستم عامل (Mac یا Windows/Linux)
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const platform = (window.navigator as any)?.userAgentData?.platform || window.navigator.platform || window.navigator.userAgent || '';
      setIsMac(/mac/i.test(platform));
    }
  }, []);

  // دریافت آزمون‌ها برای سرچ زنده
  useEffect(() => {
    setIsLoadingExams(true);
    fetch('/api/exams')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setExams(data.data);
        }
      })
      .catch(() => {
        // خطا در دریافت زنده
      })
      .finally(() => {
        setIsLoadingExams(false);
      });
  }, []);

  // هندلر شورتکات کیبورد Cmd+K و Ctrl+K (غیرفعال در اتاق آزمون جهت جلوگیری از حواس‌پرتی داوطلب)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pathname && (pathname.endsWith('/room') || pathname.includes('/room/'))) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pathname]);

  // رویداد باز شدن از طریق دکمه یا بقیه بخش‌های برنامه
  useEffect(() => {
    const handleOpenSearch = () => setIsOpen(true);
    window.addEventListener('open_global_search', handleOpenSearch);
    return () => window.removeEventListener('open_global_search', handleOpenSearch);
  }, []);

  // فوکوس خودکار روی اینپوت بعد از باز شدن
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ترکیب آیتم‌ها بر اساس آزمون‌ها + صفحات ثابت
  const allItems: SearchItem[] = React.useMemo(() => {
    const examItems: SearchItem[] = exams.map((exam) => ({
      id: `exam-${exam.id}`,
      title: exam.title,
      category: 'آزمون',
      href: `/exams/${exam.slug}`,
      badge: exam.price === 0 ? 'رایگان' : formatToman(exam.price),
      subtitle: `شامل جلد ${toPersianDigits(exam.campbellVolumes.join('، '))} کمپبل • ${toPersianDigits(exam.totalQuestions)} سوال`,
    }));

    return [...examItems, ...STATIC_NAV_ITEMS];
  }, [exams]);

  // فیلتر کردن آیتم‌ها بر اساس کوئری سرچ
  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 7);

    return allItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSubtitle = item.subtitle ? item.subtitle.toLowerCase().includes(q) : false;
      const matchCategory = item.category.toLowerCase().includes(q);
      return matchTitle || matchSubtitle || matchCategory;
    });
  }, [allItems, query]);

  // پیمایش با کلیدهای جهت‌نما و اینتر
  const handleItemSelect = useCallback(
    (href: string) => {
      setIsOpen(false);
      router.push(href);
    },
    [router]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleItemSelect(filteredItems[selectedIndex].href);
      }
    }
  };

  // اسکرول نرم هنگام جابه‌جایی ایندکس
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const isExamRoom = Boolean(pathname && (pathname.endsWith('/room') || pathname.includes('/room/')));
  if (!isOpen || isExamRoom) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl bg-[#16181F] border border-[#2E3340] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-right animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* جعبه ورودی سرچ */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-[#1D2029]">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="جستجو در آزمون‌ها، بخش‌های کمپبل و صفحات کندرلب..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none"
            dir="rtl"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="پاک کردن متن"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-gray-400 bg-black/40 border border-white/10 rounded-md">
              ESC
            </kbd>
          )}
        </div>

        {/* لیست نتایج */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              هیچ نتیجه‌ای برای <span className="text-[#FFCC00] font-bold">«{query}»</span> یافت نشد.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemSelect(item.href)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-white'
                      : 'hover:bg-white/5 border border-transparent text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        item.category === 'آزمون'
                          ? 'bg-[#FFCC00]/20 text-[#FFCC00]'
                          : item.category === 'بخش'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {item.category === 'آزمون' ? (
                        <BookOpen className="w-4 h-4" />
                      ) : (
                        <span className="text-[10px]">{item.category}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate text-white">{item.title}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 text-[#FFCC00] shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mr-2">
                    {isSelected && (
                      <span className="text-[11px] text-[#FFCC00] hidden sm:flex items-center gap-1 font-mono">
                        ورود <CornerDownLeft className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* فوتر راهنما */}
        <div className="px-4 py-2.5 bg-[#12141A] border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 border border-white/10 rounded font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-black/40 border border-white/10 rounded font-mono">↓</kbd>
              پیمایش
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 border border-white/10 rounded font-mono">Enter</kbd>
              انتخاب
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-black/40 border border-white/10 rounded font-mono">ESC</kbd>
              بستن
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span>کلید میانبر:</span>
            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white/5 border border-white/10 rounded text-gray-300">
              {mounted && isMac ? '⌘ + K' : 'Ctrl + K'}
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
