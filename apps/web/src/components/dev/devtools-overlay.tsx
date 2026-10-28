'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useAppCache } from '@/context/app-cache-context';
import { useStoreCache } from '@/context/store-cache-context';
import { formatGrade } from '@condorlab/shared';
import {
  Wrench,
  X,
  UserCheck,
  Shield,
  GraduationCap,
  Clock,
  RefreshCw,
  Database,
  WifiOff,
  AlertTriangle,
  Activity,
  Check,
  ChevronDown,
  Minimize2,
  Maximize2,
  Trash2,
  Zap,
} from 'lucide-react';

interface ApiLogItem {
  id: string;
  time: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
}

// نگهداری ارجاع دائمی و متصل به پنجره مرورگر از fetch بومی
let originalNativeFetch: typeof window.fetch | null = null;

const DEVTOOLS_STORAGE_KEY = 'condor_devtools_state_v1';

interface DevToolsPersistedState {
  isOpen: boolean;
  activeTab: 'auth' | 'exam' | 'cache' | 'network' | 'logs';
  isMinimized: boolean;
  simulatedNetwork: 'normal' | 'offline' | '500' | '401' | '403' | 'timeout';
}

const getPersistedState = (): Partial<DevToolsPersistedState> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(DEVTOOLS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export function DevToolsOverlay() {
  // اگر در محیط توسعه نیستیم، اصلاً رندر نشود (Zero footprint in production)
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const { user, refreshAuth } = useAuth();
  const { invalidateAll: invalidateAppCache, refetchDashboard } = useAppCache();
  const { invalidate: invalidateStoreCache } = useStoreCache();

  // بازیابی وضعیت ذخیره‌شده پنل از sessionStorage جهت جلوگیری از بسته شدن حین ناوبری
  const [initialPersisted] = useState(() => getPersistedState());
  const [isOpen, setIsOpen] = useState(() => initialPersisted.isOpen ?? false);
  const [activeTab, setActiveTab] = useState<'auth' | 'exam' | 'cache' | 'network' | 'logs'>(
    () => initialPersisted.activeTab || 'auth'
  );
  const [isMinimized, setIsMinimized] = useState(() => initialPersisted.isMinimized ?? false);
  const [simulatedNetwork, setSimulatedNetwork] = useState<'normal' | 'offline' | '500' | '401' | '403' | 'timeout'>(
    () => initialPersisted.simulatedNetwork || 'normal'
  );
  const [apiLogs, setApiLogs] = useState<ApiLogItem[]>([]);
  const [examStatusOverride, setExamStatusOverride] = useState<string>('normal');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  // همگام‌سازی دائمی وضعیت UI پنل در sessionStorage با هر تغییر
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        DEVTOOLS_STORAGE_KEY,
        JSON.stringify({ isOpen, activeTab, isMinimized, simulatedNetwork })
      );
    } catch {}
  }, [isOpen, activeTab, isMinimized, simulatedNetwork]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 2500);
  };

  // شورتکات کیبورد Ctrl+Shift+D یا Cmd+Shift+D جهت باز/بستن پنل دیباگ (با پشتیبانی کامل از کیبورد فارسی و KeyD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd' || e.code === 'KeyD')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ابزار شبیه‌سازی شبکه و لاگ ایمن API
  // اصل ایزولاسیون قطعی: در حالت عادی کاملاً Passive است و هرگز درخواست‌های داخلی Next.js، احراز هویت یا دیتابیس را مختل نمی‌کند
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!originalNativeFetch) {
      originalNativeFetch = window.fetch.bind(window);
    }
    const nativeFetch = originalNativeFetch;

    const getUrlString = (input: RequestInfo | URL): string => {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.toString();
      if (typeof input === 'object' && input && 'url' in input) return (input as Request).url;
      return '';
    };

    const customFetch: typeof window.fetch = async (...args) => {
      const input = args[0];
      const url = getUrlString(input);
      const init = args[1] || {};
      const method =
        init.method ||
        (typeof input === 'object' && 'method' in (input as Request) ? (input as Request).method : 'GET');

      // ۱. محافظت حیاتی از ریکوئست‌های داخلی Next.js و انتقال بین صفحات (RSC Transitions & Static Chunks)
      const isNextInternal =
        url.includes('/_next/') ||
        url.includes('_rsc=') ||
        url.includes('__next') ||
        Boolean(
          init.headers &&
            ((init.headers as any)['RSC'] ||
              (init.headers as any)['rsc'] ||
              (init.headers as any)['Next-Router-State-Tree'] ||
              (typeof (init.headers as any).get === 'function' && (init.headers as any).get('RSC')))
        );

      if (isNextInternal) {
        return nativeFetch(...args);
      }

      // ۲. وضعیت شبیه‌سازی فعلی شبکه
      const currentSim = (window as any).__condor_sim_network || 'normal';
      const isApi = url.includes('/api/');

      // در صورتی که شبیه‌سازی فعال نیست (حالت عادی) یا ریکوئست مربوط به API نیست: کاملاً Passive و بدون تاخیر
      if (currentSim === 'normal' || !isApi) {
        if (!isApi) {
          return nativeFetch(...args);
        }

        const startTime = performance.now();
        try {
          const response = await nativeFetch(...args);
          const durationMs = Math.round(performance.now() - startTime);
          logApiCall(method, url, response.status, durationMs);
          return response;
        } catch (err) {
          const durationMs = Math.round(performance.now() - startTime);
          logApiCall(method, url, 0, durationMs);
          throw err;
        }
      }

      // ۳. شبیه‌سازی فعال صرفاً برای درخواست‌های API
      const startTime = performance.now();

      if (currentSim === 'offline') {
        logApiCall(method, url, 0, 0);
        throw new TypeError('Failed to fetch');
      }

      if (currentSim === '500') {
        logApiCall(method, url, 500, 0);
        return new Response(
          JSON.stringify({ success: false, message: 'خطای سرور شبیه‌سازی‌شده (500 Internal Server Error)' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (currentSim === '401') {
        logApiCall(method, url, 401, 0);
        return new Response(
          JSON.stringify({ success: false, message: 'عدم احراز هویت (401 Unauthorized)' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (currentSim === '403') {
        logApiCall(method, url, 403, 0);
        return new Response(
          JSON.stringify({ success: false, message: 'دسترسی غیرمجاز (403 Forbidden)' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (currentSim === 'timeout') {
        await new Promise((r) => setTimeout(r, 4000));
        logApiCall(method, url, 504, 4000);
        return new Response(
          JSON.stringify({ success: false, message: 'مهلت ارتباط با دیتابیس به پایان رسید (504 Gateway Timeout)' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // فال‌بک نهایی
      return nativeFetch(...args);
    };

    window.fetch = customFetch;

    return () => {
      if (originalNativeFetch) {
        window.fetch = originalNativeFetch;
      }
    };
  }, []);

  const logApiCall = (method: string, url: string, status: number, durationMs: number) => {
    // فقط درخواست‌های مربوط به دامنه خودمان لاگ شوند
    if (url.includes('/api/')) {
      const cleanUrl = url.replace(/^[a-z]+:\/\/[^/]+/i, '');
      const item: ApiLogItem = {
        id: Math.random().toString(36).slice(2),
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        method,
        url: cleanUrl,
        status,
        durationMs,
      };
      setApiLogs((prev) => [item, ...prev].slice(0, 10));
    }
  };

  // ۱. هویت‌پذیری واقعی در پایگاه داده و ردیس (Real DB User Impersonation)
  // حذف کامل Mockهای کلاینت‌ساید و اعمال سشن رسمی از طریق کوکی و توکن
  const handleSwitchRole = async (targetKey: string) => {
    try {
      setIsSwitchingRole(true);
      showNotice('در حال سوئیچ سشن کاربری در پایگاه داده و ردیس...');

      const res = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetKey }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          // ذخیره در حافظه محلی جهت SSR hydration اولیه
          try {
            localStorage.setItem('condor_user', JSON.stringify(data.user));
          } catch {}

          // بازخوانی کامل نشست از طریق /api/auth/me و ابطال کش‌های داشبورد
          await refreshAuth();
          await refetchDashboard(true);

          window.dispatchEvent(new Event('condor_auth_change'));
          window.dispatchEvent(new CustomEvent('condor:invalidate:all'));
          showNotice(`سشن واقعی به «${data.user.profile?.fullName || data.user.role}» (${data.user.role}) تغییر یافت.`);
        }
      } else {
        showNotice('خطا در سوئیچ کاربر تستی در سرور.');
      }
    } catch {
      showNotice('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  // ۲. تغییر پایه تحصیلی در دیتابیس (Grade Switcher - فکت عمومی R-66)
  const handleSwitchGrade = async (grade: string) => {
    try {
      showNotice(`در حال ثبت پایه ${formatGrade(grade)} در پایگاه داده...`);
      const res = await fetch('/api/dashboard/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade }),
      });

      if (res.ok) {
        const stored = localStorage.getItem('condor_user');
        if (stored) {
          try {
            const u = JSON.parse(stored);
            if (u.profile) {
              u.profile.grade = grade;
              localStorage.setItem('condor_user', JSON.stringify(u));
            }
          } catch {}
        }

        await refreshAuth();
        await refetchDashboard(true);
        window.dispatchEvent(new Event('condor_auth_change'));
        window.dispatchEvent(new CustomEvent('condor:invalidate:user'));
        showNotice(`پایه تحصیلی کاربر در پایگاه داده به ${formatGrade(grade)} تغییر یافت.`);
      } else {
        showNotice('خطا در به‌روزرسانی پایه در سرور.');
      }
    } catch {
      showNotice('خطا در ارتباط با سرور جهت تغییر پایه.');
    }
  };

  // ۳. شبیه‌سازی وضعیت و تایمر آزمون
  const handleFastForwardTimer = () => {
    try {
      const activeExam = localStorage.getItem('condor_active_exam');
      if (activeExam) {
        const parsed = JSON.parse(activeExam);
        parsed.expiryAt = Date.now() + 5 * 1000; // ۵ ثانیه باقیمانده
        localStorage.setItem('condor_active_exam', JSON.stringify(parsed));
        window.dispatchEvent(new Event('condor_active_exam_change'));
        showNotice('تایمر آزمون جاری روی ۵ ثانیه باقیمانده تنظیم شد.');
      } else {
        showNotice('هیچ آزمون فعالی در حافظه محلی یافت نشد.');
      }
    } catch {}
  };

  const handleResetExamAttempt = async () => {
    try {
      localStorage.removeItem('condor_active_exam');
      window.dispatchEvent(new Event('condor_active_exam_change'));
      // فراخوانی اندپوینت ریست ادمین در صورت نیاز
      await fetch('/api/admin/attempts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      }).catch(() => null);

      invalidateAppCache();
      showNotice('وضعیت آزمون ریست شد و صندلی برای شروع مجدد آزاد گردید.');
    } catch {
      showNotice('خطا در ریست آزمون.');
    }
  };

  // ۴. مدیریت کش و ابطال حافظه
  const handleFlushAllCache = () => {
    invalidateStoreCache();
    invalidateAppCache();
    sessionStorage.clear();
    showNotice('تمام کش‌های کلاینت (فروشگاه، داشبورد و سشن) پاکسازی شدند.');
  };

  // ۵. اعمال وضعیت شبیه‌سازی شبکه
  const handleSetNetwork = (mode: 'normal' | 'offline' | '500' | '401' | '403' | 'timeout') => {
    setSimulatedNetwork(mode);
    (window as any).__condor_sim_network = mode;
    showNotice(`حالت شبکه به ${mode === 'normal' ? 'عادی' : mode} تغییر یافت.`);
  };

  return (
    <>
      {/* دکمه شناور دیباگ در پایین-چپ صفحه */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 z-[9999] px-3.5 py-2 rounded-2xl bg-[#16181D]/90 hover:bg-[#20232B] text-amber-400 border border-amber-500/40 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 group font-mono"
          title="شورتکات باز کردن: Ctrl+Shift+D"
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping group-hover:bg-amber-300" />
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span>DevTools</span>
          <span className="text-[10px] text-gray-400 border border-white/10 px-1.5 py-0.5 rounded-md font-mono">
            ^⇧D
          </span>
        </button>
      )}

      {/* پنجره دیباگ جامع توسعه‌دهنده */}
      {isOpen && (
        <div
          className={`fixed bottom-4 left-4 z-[9999] w-[95vw] sm:w-[460px] bg-[#121418]/95 border border-amber-500/30 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-right font-sans transition-all duration-200 ${
            isMinimized ? 'h-14' : 'max-h-[85vh]'
          }`}
          dir="rtl"
        >
          {/* هدر پنل دیباگ */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#181B22] border-b border-white/10 select-none">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">کندرلب DevTools</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    DEV ONLY
                  </span>
                </div>
                <div className="text-[10px] text-gray-400">
                  کاربر جاری: <strong className="text-amber-300">{user?.role || 'Guest'}</strong> ({user?.profile?.fullName || 'ناشناس'})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-gray-400">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title={isMinimized ? 'بزرگنمایی' : 'کوچک‌نمایی'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* پیام اطلاع‌رسانی موقت */}
          {actionNotice && (
            <div className="bg-amber-500 text-black text-xs font-bold px-4 py-1.5 flex items-center justify-between animate-fadeIn">
              <span>{actionNotice}</span>
              <Zap className="w-3.5 h-3.5" />
            </div>
          )}

          {!isMinimized && (
            <>
              {/* تب‌های بالای پنل */}
              <div className="flex items-center gap-1 p-2 bg-[#14161C] border-b border-white/5 overflow-x-auto scrollbar-none text-xs font-bold">
                <button
                  onClick={() => setActiveTab('auth')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'auth'
                      ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  نقش و کاربر
                </button>

                <button
                  onClick={() => setActiveTab('exam')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'exam'
                      ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  آزمون و تایمر
                </button>

                <button
                  onClick={() => setActiveTab('cache')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'cache'
                      ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  کش و حافظه
                </button>

                <button
                  onClick={() => setActiveTab('network')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'network'
                      ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  شبیه‌ساز شبکه
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'logs'
                      ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  لاگ API
                </button>
              </div>

              {/* بدنه محتوای تب فعال */}
              <div className="p-4 space-y-4 overflow-y-auto max-h-[50vh] text-xs">
                {/* تب ۱: نقش و کاربر */}
                {activeTab === 'auth' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-gray-400 font-bold">هویت‌پذیری کاربران تستی دیتابیس (Real DB Impersonation):</label>
                        <span className="text-[10px] text-amber-400 font-mono">Real Sessions</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRole('admin')}
                          className={`p-2.5 rounded-xl border text-right transition-all ${
                            user?.role === 'MasterAdmin'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>مدیر ارشد</span>
                            <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded">ADMIN</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 truncate">admin@condorlab.ir</div>
                        </button>

                        <button
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRole('officer')}
                          className={`p-2.5 rounded-xl border text-right transition-all ${
                            user?.role === 'ExamOfficer'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>مسئول آزمون</span>
                            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-400/10 px-1 py-0.5 rounded">OFFICER</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 truncate">officer@condorlab.ir</div>
                        </button>

                        <button
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRole('student-10')}
                          className={`p-2.5 rounded-xl border text-right transition-all ${
                            user?.role === 'Student' && user?.email === 'student.tenth@condorlab.ir'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>داوطلب پایه دهم</span>
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">WITH EXAM</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 truncate">آرتین رادمنش (حلی ۱)</div>
                        </button>

                        <button
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRole('student-fresh')}
                          className={`p-2.5 rounded-xl border text-right transition-all ${
                            user?.role === 'Student' && user?.email === 'student.fresh@condorlab.ir'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>داوطلب جدید</span>
                            <span className="text-[9px] font-mono text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded">NO EXAMS</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 truncate">سهراب سپهری (البرز)</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-400 block mb-2 font-bold">
                        تغییر پایه تحصیلی (پایه‌های ۷ تا ۱۱ — فکت استاندارد R-66):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: '7', label: 'پایه هفتم' },
                          { id: '8', label: 'پایه هشتم' },
                          { id: '9', label: 'پایه نهم' },
                          { id: '10', label: 'پایه دهم' },
                          { id: '11', label: 'پایه یازدهم' },
                        ].map((g) => (
                          <button
                            key={g.id}
                            onClick={() => handleSwitchGrade(g.id)}
                            className={`p-2 rounded-xl border text-center transition-all font-bold ${
                              user?.profile?.grade === g.id
                                ? 'bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">شناسه یکتای سرور (user_id):</span>
                        <span className="font-mono text-amber-300 text-[11px] truncate max-w-[240px]">{user?.id || 'عدم احراز هویت (مهمان)'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">وضعیت سشن:</span>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                          user ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-400 bg-white/5 border-white/10'
                        }`}>
                          {user ? 'REAL DB SESSION (PASSIVE)' : 'GUEST / UNLOGGED'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* تب ۲: آزمون و تایمر */}
                {activeTab === 'exam' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 leading-relaxed text-[11px]">
                      این ابزارها امکان تست سناریوهای مرزی (Edge-Cases) اتمام تایمر و بازنشانی تلاش آزمون را بدون نیاز به دستکاری دیتابیس فراهم می‌سازند.
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={handleFastForwardTimer}
                        className="w-full p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black flex items-center justify-center gap-2 shadow-md shadow-amber-500/15 transition-all"
                      >
                        <Clock className="w-4 h-4" />
                        <span>جلو کشیدن تایمر به ۰۰:۰۵ (تست خاتمه خودکار)</span>
                      </button>

                      <button
                        onClick={handleResetExamAttempt}
                        className="w-full p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>ریست تلاش و صندلی آزمون جاری (امکان شرکت مجدد)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* تب ۳: کش و حافظه */}
                {activeTab === 'cache' && (
                  <div className="space-y-4">
                    <p className="text-gray-400 leading-relaxed">
                      بررسی وضعیت کش لایه ۱ کلاینت و ابطال حافظه بدون نیاز به پاکسازی تاریخچه مرورگر:
                    </p>

                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          invalidateStoreCache();
                          showNotice('کش کاتالوگ فروشگاه ابطال شد.');
                        }}
                        className="w-full p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-bold flex items-center justify-between transition-all"
                      >
                        <span>ابطال کش فروشگاه (Store Products Cache)</span>
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      </button>

                      <button
                        onClick={() => {
                          invalidateAppCache();
                          showNotice('کش داشبورد و محصولات کاربر ابطال شد.');
                        }}
                        className="w-full p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-bold flex items-center justify-between transition-all"
                      >
                        <span>ابطال کش داشبورد کاربر (User Queries Cache)</span>
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      </button>

                      <button
                        onClick={handleFlushAllCache}
                        className="w-full p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-black flex items-center justify-between transition-all"
                      >
                        <span>پاکسازی کامل همه کش‌ها (Full Cache Flush)</span>
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* تب ۴: شبیه‌ساز شبکه و خطاها */}
                {activeTab === 'network' && (
                  <div className="space-y-4">
                    <p className="text-gray-400 leading-relaxed">
                      شبیه‌سازی خطاهای شبکه و سرور برای ارزیابی تاب‌آوری UI (Resilience):
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'normal', label: 'اتصال عادی (Normal)' },
                        { id: 'offline', label: 'آفلاین (قطع اینترنت)' },
                        { id: '500', label: 'خطای سرور (500 Error)' },
                        { id: '401', label: 'انقضای سشن (401)' },
                        { id: '403', label: 'عدم دسترسی (403)' },
                        { id: 'timeout', label: 'تایم‌اوت DB (504 Timeout)' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSetNetwork(item.id as any)}
                          className={`p-2.5 rounded-xl border text-center transition-all font-bold ${
                            simulatedNetwork === item.id
                              ? 'bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* تب ۵: لاگ درخواست‌های API */}
                {activeTab === 'logs' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-gray-400 pb-1 border-b border-white/5">
                      <span>۱۰ درخواست اخیر API:</span>
                      <button
                        onClick={() => setApiLogs([])}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        پاکسازی لاگ
                      </button>
                    </div>

                    {apiLogs.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">هنوز درخواستی ثبت نشده است</div>
                    ) : (
                      <div className="space-y-1.5 font-mono text-[11px]">
                        {apiLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-2 rounded-xl bg-[#181B22] border border-white/5 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 truncate max-w-[280px]">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  log.method === 'GET'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : log.method === 'POST'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                {log.method}
                              </span>
                              <span className="text-gray-200 truncate" title={log.url}>
                                {log.url}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-gray-500">{log.durationMs}ms</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  log.status >= 200 && log.status < 300
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {log.status || 'ERR'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
