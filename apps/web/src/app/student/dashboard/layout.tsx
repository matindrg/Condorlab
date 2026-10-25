import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'پنل کاربری',
  description: 'مشاهده مشخصات ثبت‌شده و محصولات و آزمون‌های خریداری‌شده داوطلب در کندرلب.',
};

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
