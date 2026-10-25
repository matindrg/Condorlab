import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ثبت‌نام داوطلب',
  description: 'عضویت و ایجاد حساب داوطلب المپیاد زیست‌شناسی در پلتفرم کندرلب.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
