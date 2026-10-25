import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'کندرلب — مرجع سنجش تحلیلی المپیاد زیست‌شناسی',
  description: 'آزمون‌های جامع سرفصلی بیولوژی کمپبل، کارنامه متصل به بانک دانش و شبیه‌ساز مرحله اول و دوم المپیاد کشوری زیست‌شناسی.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-[#121212] text-[#F3F4F6] min-h-screen antialiased selection:bg-[#FFCC00] selection:text-black">
        {children}
      </body>
    </html>
  );
}
