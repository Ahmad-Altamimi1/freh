import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'صفحة تسجيل الدخول إلى لوحة التحكم.'
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return <SignInViewPage redirectTo={redirectTo} />;
}
