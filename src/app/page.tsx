import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function Page() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard/overview' : '/auth/sign-in');
}
