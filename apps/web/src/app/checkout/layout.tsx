import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تسویه‌حساب و رزرو صندلی',
  description: 'پیش‌فاکتور، ثبت‌نام نهایی و دریافت صندلی آزمون المپیاد زیست‌شناسی در کندرلب.',
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
