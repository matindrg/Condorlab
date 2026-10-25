import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { GlobalSearchDialog } from '@/components/global-search-dialog';
import { AuthProvider } from '@/context/auth-context';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: {
    default: 'کندرلب — مرجع سنجش تحلیلی المپیاد زیست‌شناسی',
    template: '%s | کندرلب',
  },
  description: 'آزمون‌های جامع سرفصلی بیولوژی کمپبل، کارنامه متصل به بانک دانش و شبیه‌ساز مرحله اول و دوم المپیاد کشوری زیست‌شناسی.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-[#121212] text-[#F3F4F6] min-h-screen antialiased selection:bg-[#FFCC00] selection:text-black font-sans flex flex-col">
        <ToastProvider>
          <AuthProvider>
            <Navbar />
            <GlobalSearchDialog />
            <main className="flex-1">{children}</main>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
