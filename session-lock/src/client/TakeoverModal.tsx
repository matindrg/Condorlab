import { useEffect, useRef } from 'react';
import type { TakeoverInfo } from './useExamHeartbeat';

export interface TakeoverModalProps {
  open: boolean;
  info: TakeoverInfo | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatLastSeen(value?: string): string {
  if (!value) return 'نامشخص';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'نامشخص';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/**
 * The modal is intentionally small and explicit: the second device is blocked
 * until the user confirms, so an accidental refresh never steals the exam.
 */
export function TakeoverModal({ open, info, loading = false, onConfirm, onCancel }: TakeoverModalProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="takeover-title"
        aria-describedby="takeover-description"
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
          fontFamily: 'Vazirmatn, IRANSans, Tahoma, sans-serif',
          lineHeight: 1.8,
        }}
      >
        <h2 id="takeover-title" style={{ margin: 0, fontSize: 18 }}>
          آزمون در دستگاه دیگری باز است
        </h2>
        <p id="takeover-description" style={{ marginTop: 8, color: '#334155', fontSize: 14 }}>
          این آزمون روی دستگاه دیگری فعال است. اگر می‌خواهی در این دستگاه ادامه بدهی، دستگاه قبلی
          از آزمون خارج می‌شود و پاسخ‌های ذخیره‌شده‌ی این دستگاه ارسال می‌شوند.
        </p>

        <dl style={{ margin: '12px 0', fontSize: 13, color: '#475569' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt>آخرین فعالیت دستگاه دیگر</dt>
            <dd style={{ margin: 0 }}>{formatLastSeen(info?.lastSeenAt)}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt>جابه‌جایی باقی‌مانده</dt>
            <dd style={{ margin: 0 }}>{info?.remainingTakeovers ?? 0} از ۲</dd>
          </div>
        </dl>

        {!info?.canTakeover && (
          <p style={{ color: '#b91c1c', fontSize: 13 }}>
            سقف جابه‌جایی دستگاه در این آزمون پر شده است. برای ادامه با پشتیبانی تماس بگیر.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              border: '1px solid #cbd5e1',
              background: '#fff',
              borderRadius: 10,
              padding: '10px 16px',
              cursor: 'pointer',
            }}
          >
            بازگشت به داشبورد
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading || !info?.canTakeover}
            style={{
              border: 0,
              background: info?.canTakeover ? '#0f766e' : '#94a3b8',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 16px',
              cursor: info?.canTakeover && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'در حال انتقال…' : 'ادامه در این دستگاه'}
          </button>
        </div>
      </div>
    </div>
  );
}
