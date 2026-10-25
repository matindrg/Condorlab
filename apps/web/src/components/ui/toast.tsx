'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// تابع کمکی عمومی برای فراخوانی توست از هر کجای برنامه (حتی خارج از کامپوننت‌های متصل)
export const toast = {
  success: (title: string, description?: string, duration = 3500) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('condor_toast', {
          detail: { type: 'success', title, description, duration },
        }),
      );
    }
  },
  error: (title: string, description?: string, duration = 4500) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('condor_toast', {
          detail: { type: 'error', title, description, duration },
        }),
      );
    }
  },
  warning: (title: string, description?: string, duration = 4000) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('condor_toast', {
          detail: { type: 'warning', title, description, duration },
        }),
      );
    }
  },
  info: (title: string, description?: string, duration = 3500) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('condor_toast', {
          detail: { type: 'info', title, description, duration },
        }),
      );
    }
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toastData: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastItem = { ...toastData, id };

    setToasts((prev) => [...prev, newToast]);

    const duration = toastData.duration ?? 3500;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // شنود رویداد اختصاصی condor_toast برای سازگاری در سراسر برنامه
  useEffect(() => {
    const handleCustomToast = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<ToastItem, 'id'>>;
      if (customEvent.detail) {
        addToast(customEvent.detail);
      }
    };

    window.addEventListener('condor_toast', handleCustomToast);
    return () => {
      window.removeEventListener('condor_toast', handleCustomToast);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      addToast: () => '',
      removeToast: () => {},
      toast,
    };
  }
  return { ...context, toast };
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      dir="rtl"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none sm:bottom-6 sm:left-6"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const getIcon = () => {
    switch (item.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-[#FFCC00] shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (item.type) {
      case 'success':
        return 'border-emerald-500/30 shadow-emerald-950/20';
      case 'error':
        return 'border-red-500/30 shadow-red-950/20';
      case 'warning':
        return 'border-amber-500/30 shadow-amber-950/20';
      case 'info':
      default:
        return 'border-[#FFCC00]/30 shadow-[#FFCC00]/10';
    }
  };

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-[#16181F]/95 backdrop-blur-xl border ${getBorderColor()} text-right shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2`}
    >
      <div className="pt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-white leading-snug">{item.title}</h4>
        {item.description && (
          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="بستن اعلان"
        className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
