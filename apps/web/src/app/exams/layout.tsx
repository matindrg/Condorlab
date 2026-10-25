import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'کاتالوگ آزمون‌های المپیاد زیست‌شناسی',
  description: 'کاتالوگ آزمون‌های سرفصلی بیولوژی کمپبل، دوره‌های شبیه‌ساز مرحله اول و مرحله دوم با تحلیل هوشمند.',
};

export default function ExamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
