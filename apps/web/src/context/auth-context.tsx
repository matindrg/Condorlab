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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  enrolledExamIds: [],
  isLoading: true,
  isEnrolled: () => false,
  markExamAsEnrolled: () => {},
  refreshAuth: async () => {},
});

const STORAGE_USER_KEY = 'condor_user';
const STORAGE_ENROLLED_KEY = 'condor_enrolled_exams';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [enrolledExamIds, setEnrolledExamIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // لود اولیه از کش محلی
  useEffect(() => {
    try {
      const cachedUser = localStorage.getItem(STORAGE_USER_KEY);
      if (cachedUser) {
        setUser(JSON.parse(cachedUser));
      }
      const cachedEnrolled = localStorage.getItem(STORAGE_ENROLLED_KEY);
      if (cachedEnrolled) {
        setEnrolledExamIds(JSON.parse(cachedEnrolled));
      }
    } catch {
      // ignore
    }
  }, []);

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
          setEnrolledExamIds((prev) => {
            const combined = Array.from(new Set([...prev, ...enrollData.enrolledExamIds]));
            try {
              localStorage.setItem(STORAGE_ENROLLED_KEY, JSON.stringify(combined));
            } catch {}
            return combined;
          });
        }
      }
    } catch {
      // خطا در شبکه
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();

    const handleAuthChange = () => {
      try {
        const cachedUser = localStorage.getItem(STORAGE_USER_KEY);
        setUser(cachedUser ? JSON.parse(cachedUser) : null);
        const cachedEnrolled = localStorage.getItem(STORAGE_ENROLLED_KEY);
        if (cachedEnrolled) {
          setEnrolledExamIds(JSON.parse(cachedEnrolled));
        }
      } catch {}
      refreshAuth();
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

  return (
    <AuthContext.Provider
      value={{
        user,
        enrolledExamIds,
        isLoading,
        isEnrolled,
        markExamAsEnrolled,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
