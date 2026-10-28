'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './auth-context';
import { INITIAL_CATALOG_EXAMS } from '@/lib/catalog';

export interface UserProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  grade: string;
  school: string;
  city: string;
  email?: string;
  role?: string;
  createdAt?: string;
}

export interface PurchasedProduct {
  id: string;
  title: string;
  slug: string;
  type: string;
  orderNumber: string;
  price: number;
  payableAmount: number;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'completed' | 'expired' | 'missed' | string;
  accessType: string;
  purchasedAt: string;
  durationMinutes: number;
  totalQuestions: number;
  campbellVolumes?: number[];
  startTime?: string;
  endTime?: string;
  remainingSeconds?: number;
  isLiveActive?: boolean;
  isSessionLocked?: boolean;
  lockedDeviceId?: string;
  startedAt?: string;
  submittedAt?: string;
  isReportPublished?: boolean;
}

export interface AppCacheContextType {
  profile: UserProfile | null;
  purchasedProducts: PurchasedProduct[];
  enrolledExamIds: string[];
  isLoading: boolean;
  isStale: boolean;
  lastUpdated: number | null;
  refetchDashboard: (force?: boolean) => Promise<void>;
  invalidatePurchases: () => void;
  invalidateExams: () => void;
  invalidateUser: () => void;
  invalidateAll: () => void;
  mutateProfile: (updater: Partial<UserProfile>) => void;
  mutateProducts: (updater: PurchasedProduct[] | ((prev: PurchasedProduct[]) => PurchasedProduct[])) => void;
}

const AppCacheContext = createContext<AppCacheContextType | null>(null);

const APP_CACHE_SESSION_KEY = 'condor_app_cache_v1';
const GC_TIME_MS = 60 * 60 * 1000; // ۱ ساعت نگه‌داری در نشست
const STALE_TIME_MS = Infinity; // تا زمان وقوع Mutation صریح، کش معتبر است

interface CachePayload {
  profile: UserProfile | null;
  purchasedProducts: PurchasedProduct[];
  enrolledExamIds: string[];
  userId: string | null;
  timestamp: number;
}

let memoryAppCache: CachePayload | null = null;

export function AppCacheProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, enrolledExamIds: authEnrolledIds, isLoading: isAuthLoading, isMounted } = useAuth();
  const currentUserId = authUser?.id || null;
  const isAuthReady = isMounted && !isAuthLoading && Boolean(authUser?.id);

  // بازیابی همگام از حافظه یا سشن‌استوریج
  const getInitialCache = (): CachePayload | null => {
    if (typeof window === 'undefined') return null;

    if (memoryAppCache && memoryAppCache.userId === currentUserId) {
      if (Date.now() - memoryAppCache.timestamp < GC_TIME_MS) {
        return memoryAppCache;
      }
    }

    try {
      const stored = sessionStorage.getItem(APP_CACHE_SESSION_KEY);
      if (stored) {
        const parsed: CachePayload = JSON.parse(stored);
        if (parsed.userId === currentUserId && Date.now() - parsed.timestamp < GC_TIME_MS) {
          memoryAppCache = parsed;
          return parsed;
        }
      }
    } catch {}
    return null;
  };

  const initialCache = getInitialCache();

  const [profile, setProfile] = useState<UserProfile | null>(() => initialCache?.profile || null);
  const [purchasedProducts, setPurchasedProducts] = useState<PurchasedProduct[]>(() => initialCache?.purchasedProducts || []);
  const [enrolledExamIds, setEnrolledExamIds] = useState<string[]>(() => initialCache?.enrolledExamIds || authEnrolledIds || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache && !!authUser);
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => initialCache?.timestamp || null);

  const isFetchingRef = useRef<boolean>(false);

  // ذخیره در سشن‌استوریج و حافظه
  const saveToCache = useCallback((newProfile: UserProfile | null, newProducts: PurchasedProduct[], newEnrolled: string[]) => {
    const payload: CachePayload = {
      profile: newProfile,
      purchasedProducts: newProducts,
      enrolledExamIds: newEnrolled,
      userId: currentUserId,
      timestamp: Date.now(),
    };
    memoryAppCache = payload;
    setLastUpdated(payload.timestamp);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(APP_CACHE_SESSION_KEY, JSON.stringify(payload));
      } catch {}
    }
  }, [currentUserId]);

  // واکشی داده‌های داشبورد با حفاظت در برابر خطای Cold-Start دیتابیس و اعتبارسنجی قطعی کاربر
  const refetchDashboard = useCallback(async (force = false) => {
    // گیت صریح: کوئری هرگز قبل از اتمام احراز هویت شلیک نمی‌شود
    if (!isMounted || isAuthLoading || !authUser?.id) return;

    if (!force && memoryAppCache && memoryAppCache.userId === currentUserId && Date.now() - memoryAppCache.timestamp < STALE_TIME_MS) {
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!memoryAppCache || memoryAppCache.userId !== currentUserId) {
      setIsLoading(true);
    }

    // تلاش مجدد با بازگشت نمایی در صورت کلد-استارت دیتابیس
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch('/api/dashboard/overview', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.user) {
            const u = json.data.user;
            const userProf: UserProfile = {
              firstName: u.profile?.firstName || authUser.profile?.firstName || '',
              lastName: u.profile?.lastName || authUser.profile?.lastName || '',
              fullName:
                u.profile?.fullName ||
                `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim() ||
                'داوطلب المپیاد',
              phoneNumber: u.profile?.phoneNumber || authUser.profile?.phoneNumber || '',
              grade: u.profile?.grade || authUser.profile?.grade || '10',
              school: u.profile?.school || authUser.profile?.school || 'نامشخص',
              city: u.profile?.city || authUser.profile?.city || 'نامشخص',
              email: u.email || authUser.email || '',
              role: u.role || authUser.role || 'Student',
              createdAt: u.createdAt || authUser.createdAt,
            };
            setProfile(userProf);

            const fetchedProducts: PurchasedProduct[] = json.data.purchasedProducts || [];
            const effectiveEnrolled = authEnrolledIds || [];

            if (Array.isArray(effectiveEnrolled) && effectiveEnrolled.length > 0) {
              for (const enrolledId of effectiveEnrolled) {
                const alreadyExists = fetchedProducts.some(
                  (p) => p.id === enrolledId || p.slug === enrolledId,
                );
                if (!alreadyExists) {
                  const matchedExam = INITIAL_CATALOG_EXAMS.find(
                    (e) => e.id === enrolledId || e.slug === enrolledId,
                  );
                  if (matchedExam) {
                    fetchedProducts.push({
                      id: matchedExam.id,
                      title: matchedExam.title,
                      slug: matchedExam.slug,
                      type: matchedExam.category === 'stage2' ? 'شبیه‌ساز تخصصی مرحله ۲' : 'آزمون شبیه‌ساز',
                      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
                      price: matchedExam.price,
                      payableAmount: matchedExam.price,
                      status: 'not_started',
                      accessType: 'رسمی (با رتبه)',
                      purchasedAt: new Date().toISOString(),
                      durationMinutes: matchedExam.durationMinutes,
                      totalQuestions: matchedExam.totalQuestions,
                      campbellVolumes: matchedExam.campbellVolumes,
                      startTime: matchedExam.startTime,
                      endTime: matchedExam.endTime,
                      remainingSeconds: matchedExam.durationMinutes * 60,
                      isLiveActive: false,
                      isSessionLocked: false,
                    });
                  }
                }
              }
            }

            setPurchasedProducts(fetchedProducts);
            setEnrolledExamIds(effectiveEnrolled);
            saveToCache(userProf, fetchedProducts, effectiveEnrolled);
            break; // پایان موفقیت‌آمیز واکشی
          }
        } else if (res.status === 401) {
          // عدم احراز هویت، جلوگیری از کش کردن وضعیت خالی
          break;
        }
      } catch (e) {
        // خطای اتصال موقت، تکرار با تاخیر
      }

      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempts * 500));
      }
    }

    setIsLoading(false);
    isFetchingRef.current = false;
  }, [authUser, currentUserId, authEnrolledIds, isAuthLoading, isMounted, saveToCache]);

  // رویدادهای Mutation برای ابطال دقیق برش داده‌ها
  const invalidatePurchases = useCallback(() => {
    refetchDashboard(true);
  }, [refetchDashboard]);

  const invalidateExams = useCallback(() => {
    refetchDashboard(true);
  }, [refetchDashboard]);

  const invalidateUser = useCallback(() => {
    refetchDashboard(true);
  }, [refetchDashboard]);

  const invalidateAll = useCallback(() => {
    memoryAppCache = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(APP_CACHE_SESSION_KEY);
      } catch {}
    }
    refetchDashboard(true);
  }, [refetchDashboard]);

  // شنود رویدادهای سراسری
  useEffect(() => {
    const handleInvalidateAll = () => invalidateAll();
    const handleInvalidatePurchases = () => invalidatePurchases();
    const handleInvalidateExams = () => invalidateExams();
    const handleInvalidateUser = () => invalidateUser();

    window.addEventListener('condor:invalidate:all', handleInvalidateAll);
    window.addEventListener('condor:invalidate:purchases', handleInvalidatePurchases);
    window.addEventListener('condor:invalidate:exams', handleInvalidateExams);
    window.addEventListener('condor:invalidate:user', handleInvalidateUser);

    return () => {
      window.removeEventListener('condor:invalidate:all', handleInvalidateAll);
      window.removeEventListener('condor:invalidate:purchases', handleInvalidatePurchases);
      window.removeEventListener('condor:invalidate:exams', handleInvalidateExams);
      window.removeEventListener('condor:invalidate:user', handleInvalidateUser);
    };
  }, [invalidateAll, invalidatePurchases, invalidateExams, invalidateUser]);

  // همگام‌سازی وضعیت کلاینت هنگام تغییر کاربر احراز هویت شده (سوئیچ کاربر یا لاگین/لاگ‌اوت)
  useEffect(() => {
    if (!currentUserId) {
      setProfile(null);
      setPurchasedProducts([]);
      setEnrolledExamIds([]);
      setIsLoading(false);
      return;
    }

    if (memoryAppCache && memoryAppCache.userId !== currentUserId) {
      memoryAppCache = null;
      try {
        sessionStorage.removeItem(APP_CACHE_SESSION_KEY);
      } catch {}
      setProfile(null);
      setPurchasedProducts([]);
    }

    if (isAuthReady) {
      refetchDashboard(false);
    }
  }, [currentUserId, isAuthReady, refetchDashboard]);

  // همگام‌سازی مستقیم در حافظه (Optimistic Mutators)
  const mutateProfile = useCallback((updater: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = prev ? { ...prev, ...updater } : null;
      if (updated) {
        saveToCache(updated, purchasedProducts, enrolledExamIds);
      }
      return updated;
    });
  }, [purchasedProducts, enrolledExamIds, saveToCache]);

  const mutateProducts = useCallback((updater: PurchasedProduct[] | ((prev: PurchasedProduct[]) => PurchasedProduct[])) => {
    setPurchasedProducts((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      saveToCache(profile, updated, enrolledExamIds);
      return updated;
    });
  }, [profile, enrolledExamIds, saveToCache]);

  const value: AppCacheContextType = {
    profile,
    purchasedProducts,
    enrolledExamIds,
    isLoading,
    isStale: false,
    lastUpdated,
    refetchDashboard,
    invalidatePurchases,
    invalidateExams,
    invalidateUser,
    invalidateAll,
    mutateProfile,
    mutateProducts,
  };

  return <AppCacheContext.Provider value={value}>{children}</AppCacheContext.Provider>;
}

export function useAppCache() {
  const context = useContext(AppCacheContext);
  if (!context) {
    throw new Error('useAppCache must be used within an AppCacheProvider');
  }
  return context;
}
