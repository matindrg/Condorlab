'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '۱ تا ۴ (یا 1-4)', desc: 'انتخاب گزینه مربوطه در سؤال جاری' },
    { key: 'Backspace / Delete', desc: 'پاک کردن گزینه انتخابی سؤال جاری' },
    { key: 'Space یا F', desc: 'علامت‌گذاری یا لغو نشان سؤال (Flag برای بازبینی)' },
    { key: 'ArrowRight یا K', desc: 'انتقال به سؤال بعدی' },
    { key: 'ArrowLeft یا J', desc: 'انتقال به سؤال قبلی' },
    { key: 'U', desc: 'پرش مستقیم به اولین سؤال نزده' },
    { key: '?', desc: 'باز و بسته کردن این راهنما' },
    { key: 'Esc', desc: 'بستن پنجره‌های باز' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg p-6 bg-card border border-border rounded-2xl shadow-2xl text-card-foreground">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Keyboard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">کلیدهای میانبر اتاق آزمون</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-border/60">
          {shortcuts.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">{item.desc}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-semibold bg-muted border border-border rounded-lg text-foreground shadow-sm">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
}
