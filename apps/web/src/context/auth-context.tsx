'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthContextType {
  user: any | null;
  enrolledExamIds: string[];
  isLoading: boolean;
  isEnrolled: (examIdOrSlug: string) => boolean;
  markExamAsEnrolled: (examIdOrSlug: string) => void;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  enrolledExamIds: [],
  isLoading: true,
  isEnrolled: () => false,
  markExamAsEnrolled: () => {},
  refreshAuth: async () => {},
  logout: async () => {},
});

const STORAGE_USER_KEY = 'condor_user';
const STORAGE_ENROLLED_KEY = 'condor_enrolled_exams';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_USER_KEY);
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [enrolledExamIds, setEnrolledExamIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_ENROLLED_KEY);
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return !localStorage.getItem(STORAGE_USER_KEY);
      } catch {
        return true;
      }
    }
    return true;
  });

  const refreshAuth = useCallback(async () => {
    try {
      const [authRes, enrollmentsRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/exams/my-enrollments', { cache: 'no-store' }).catch(() => null),
      ]);

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.success && authData.user) {
          setUser(authData.user);
          try {
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authData.user));
          } catch {}
        }
      } else if (authRes.status === 401) {
        setUser(null);
        setEnrolledExamIds([]);
        try {
          localStorage.removeItem(STORAGE_USER_KEY);
          localStorage.removeItem(STORAGE_ENROLLED_KEY);
        } catch {}
      }

      if (enrollmentsRes && enrollmentsRes.ok) {
        const enrollData = await enrollmentsRes.json();
        if (enrollData.success && Array.isArray(enrollData.enrolledExamIds)) {
          setEnrolledExamIds(enrollData.enrolledExamIds);
          try {
            localStorage.setItem(STORAGE_ENROLLED_KEY, JSON.stringify(enrollData.enrolledExamIds));
          } catch {}
        }
      }
    } catch {
      // در صورت خطای شبکه یا بازراه‌اندازی سرور، کش کاربر پاک نمی‌شود
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();

    const handleAuthChange = () => {
      try {
        const cachedUser = localStorage.getItem(STORAGE_USER_KEY);
        if (!cachedUser) {
          // در صورت خروج از حساب، از واکشی مجدد خودداری می‌شود تا وضعیت لاگ‌اوت لغو نشود
          setUser(null);
          setEnrolledExamIds([]);
          return;
        }
        setUser(JSON.parse(cachedUser));
        const cachedEnrolled = localStorage.getItem(STORAGE_ENROLLED_KEY);
        if (cachedEnrolled) {
          setEnrolledExamIds(JSON.parse(cachedEnrolled));
        }
        refreshAuth();
      } catch {}
    };

    window.addEventListener('condor_auth_change', handleAuthChange);
    return () => window.removeEventListener('condor_auth_change', handleAuthChange);
  }, [refreshAuth]);

  const markExamAsEnrolled = useCallback((examIdOrSlug: string) => {
    if (!examIdOrSlug) return;
    setEnrolledExamIds((prev) => {
      const updated = Array.from(new Set([...prev, examIdOrSlug]));
      try {
        localStorage.setItem(STORAGE_ENROLLED_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    window.dispatchEvent(new Event('condor_auth_change'));
  }, []);

  const isEnrolled = useCallback(
    (examIdOrSlug: string) => {
      if (!examIdOrSlug) return false;
      return enrolledExamIds.includes(examIdOrSlug);
    },
    [enrolledExamIds],
  );

  const logout = useCallback(async () => {
    setUser(null);
    setEnrolledExamIds([]);
    try {
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_ENROLLED_KEY);
      localStorage.removeItem('condor_active_exam');
    } catch {}

    try {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event('condor_auth_change'));
    window.dispatchEvent(new Event('condor_active_exam_change'));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        enrolledExamIds,
        isLoading,
        isEnrolled,
        markExamAsEnrolled,
        refreshAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
