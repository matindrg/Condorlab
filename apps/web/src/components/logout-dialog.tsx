'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Loader2 } from 'lucide-react';

interface LogoutDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutDialog({
  isOpen,
  isLoading,
  onClose,
  onConfirm,
}: LogoutDialogProps) {
  const [mounted, setMounted] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // بستن با کلید Escape و مدیریت فوکوس اولیه
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // فوکوس پیش‌فرض روی دکمه انصراف برای امنیت بیشتر کاربر
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    // جلوگیری از اسکرول صفحه وقتی مدال باز است
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
    };
  }, [isOpen, isLoading, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      dir="rtl"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity text-right"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-[#16181F] border border-[#2B303D] rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <LogOut className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="logout-dialog-title" className="text-base font-black text-white">
              خروج از حساب کاربری
            </h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              آیا از خروج از حساب کاربری خود مطمئن هستید؟ برای ثبت پاسخ‌برگ‌ها، خرید آزمون و مشاهده کارنامه تحلیلی نیاز به ورود مجدد خواهید داشت.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال خروج...</span>
              </>
            ) : (
              <span>بله، خروج از حساب</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
