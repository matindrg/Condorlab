'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ExamSummary } from '@condorlab/shared';

export interface StoreCacheContextType {
  exams: ExamSummary[];
  isLoading: boolean;
  isStale: boolean;
  version: string | null;
  lastUpdated: number | null;
  refetch: (force?: boolean) => Promise<ExamSummary[]>;
  mutate: (updater: ExamSummary[] | ((prev: ExamSummary[]) => ExamSummary[])) => void;
  invalidate: () => void;
}

const StoreCacheContext = createContext<StoreCacheContextType | null>(null);

const STORE_SESSION_KEY = 'condor_store_catalog_cache';
const GC_TIME_MS = 60 * 60 * 1000; // ۱ ساعت زمان نگه‌داری درون نشست
const STALE_TIME_MS = Infinity; // کش ماندگار در طول سشن مگر با ابطال صریح یا تغییر نسخه

// کش تک‌نمونه‌ای درون‌حافظه (Layer 1 Memory Cache) جهت بازگشت آنی بدون تأخیر در تغییر صفحات
let memoryStoreCatalog: {
  data: ExamSummary[];
  timestamp: number;
  version: string | null;
} | null = null;

export function StoreCacheProvider({ children }: { children: React.ReactNode }) {
  // مقداردهی اولیه همگام: در صورت وجود دیتا در حافظه رم، بدون کوچک‌ترین لودینگی فوراً آماده است
  const [exams, setExams] = useState<ExamSummary[]>(() => {
    if (memoryStoreCatalog && Date.now() - memoryStoreCatalog.timestamp < GC_TIME_MS) {
      return memoryStoreCatalog.data;
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (memoryStoreCatalog && Date.now() - memoryStoreCatalog.timestamp < GC_TIME_MS) {
      return false;
    }
    return true;
  });

  const [version, setVersion] = useState<string | null>(() => memoryStoreCatalog?.version || null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => memoryStoreCatalog?.timestamp || null);
  const isFetchingRef = useRef<boolean>(false);

  // واکشی داده‌های کاتالوگ با استراتژی Stale-While-Revalidate
  const fetchStoreCatalog = useCallback(async (force = false): Promise<ExamSummary[]> => {
    // اگر کش معتبر در حافظه وجود دارد و فراخوانی اجباری نیست، نیازی به درخواست شبکه نیست
    if (!force && memoryStoreCatalog && Date.now() - memoryStoreCatalog.timestamp < STALE_TIME_MS) {
      return memoryStoreCatalog.data;
    }

    if (isFetchingRef.current) {
      return memoryStoreCatalog?.data || [];
    }

    isFetchingRef.current = true;
    if (!memoryStoreCatalog || memoryStoreCatalog.data.length === 0) {
      setIsLoading(true);
    }

    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (memoryStoreCatalog?.version) {
        headers['If-None-Match'] = memoryStoreCatalog.version;
      }

      const res = await fetch('/api/exams', {
        headers,
        cache: 'no-store', // مدیریت کامل کش کلاینت بر عهده استور کانتکست است
      });

      if (res.status === 304 && memoryStoreCatalog) {
        // داده‌ها تغییر نکرده‌اند؛ به‌روزرسانی برچسب زمان
        memoryStoreCatalog.timestamp = Date.now();
        setLastUpdated(memoryStoreCatalog.timestamp);
        return memoryStoreCatalog.data;
      }

      if (!res.ok) {
        throw new Error(`خطای دریافت کاتالوگ محصولات با کد وضعیت: ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const newVersion = res.headers.get('ETag') || res.headers.get('x-store-version') || String(Date.now());
        const timestamp = Date.now();

        memoryStoreCatalog = {
          data: data.data,
          timestamp,
          version: newVersion,
        };

        setExams(data.data);
        setVersion(newVersion);
        setLastUpdated(timestamp);

        // پشتیبان‌گیری در sessionStorage جهت پایداری تب مرورگر
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              STORE_SESSION_KEY,
              JSON.stringify({ data: data.data, timestamp, version: newVersion })
            );
          } catch {}
        }

        return data.data;
      }
    } catch (err) {
      console.warn('⚠️ عدم دسترسی موقت به سرور فروشگاه، بازیابی از کش سشن:', err);
      // تلاش برای بازیابی از sessionStorage
      if (typeof window !== 'undefined' && (!memoryStoreCatalog || memoryStoreCatalog.data.length === 0)) {
        try {
          const cachedSession = sessionStorage.getItem(STORE_SESSION_KEY);
          if (cachedSession) {
            const parsed = JSON.parse(cachedSession);
            if (Date.now() - parsed.timestamp < GC_TIME_MS) {
              memoryStoreCatalog = parsed;
              setExams(parsed.data);
              setVersion(parsed.version);
              setLastUpdated(parsed.timestamp);
              return parsed.data;
            }
          }
        } catch {}
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }

    return memoryStoreCatalog?.data || [];
  }, []);

  // لود اولیه در شروع نشست کلاینت
  useEffect(() => {
    // بازیابی از sessionStorage در رفرش مرورگر
    if (!memoryStoreCatalog && typeof window !== 'undefined') {
      try {
        const cachedSession = sessionStorage.getItem(STORE_SESSION_KEY);
        if (cachedSession) {
          const parsed = JSON.parse(cachedSession);
          if (Date.now() - parsed.timestamp < GC_TIME_MS) {
            memoryStoreCatalog = parsed;
            setExams(parsed.data);
            setVersion(parsed.version);
            setLastUpdated(parsed.timestamp);
            setIsLoading(false);
          }
        }
      } catch {}
    }

    fetchStoreCatalog();
  }, [fetchStoreCatalog]);

  // جهش و تغییر خوش‌بینانه داده‌های کش (Optimistic Update)
  const mutate = useCallback((updater: ExamSummary[] | ((prev: ExamSummary[]) => ExamSummary[])) => {
    setExams((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (memoryStoreCatalog) {
        memoryStoreCatalog.data = next;
        memoryStoreCatalog.timestamp = Date.now();
      }
      return next;
    });
  }, []);

  // ابطال صریح کش (مثلاً پس از ثبت‌نام در آزمون یا تغییر ظرفیت)
  const invalidate = useCallback(() => {
    memoryStoreCatalog = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(STORE_SESSION_KEY);
      } catch {}
    }
    fetchStoreCatalog(true);
  }, [fetchStoreCatalog]);

  return (
    <StoreCacheContext.Provider
      value={{
        exams,
        isLoading,
        isStale: false,
        version,
        lastUpdated,
        refetch: fetchStoreCatalog,
        mutate,
        invalidate,
      }}
    >
      {children}
    </StoreCacheContext.Provider>
  );
}

export function useStoreCatalog() {
  const ctx = useContext(StoreCacheContext);
  if (!ctx) {
    throw new Error('useStoreCatalog must be used within a StoreCacheProvider');
  }
  return ctx;
}

export const useStoreCache = useStoreCatalog;
