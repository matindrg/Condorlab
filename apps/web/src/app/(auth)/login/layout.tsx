import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ورود به حساب کاربری',
  description: 'ورود داوطلبان المپیاد زیست‌شناسی به پلتفرم سنجش تحلیلی کندرلب.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
