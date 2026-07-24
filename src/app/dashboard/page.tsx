import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';

export default async function Dashboard() {
  await requireUser();
  redirect('/dashboard/overview');
}
