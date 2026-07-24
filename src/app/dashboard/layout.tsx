import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { SessionProvider } from '@/components/layout/session-provider';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { requireUser, toSessionUser } from '@/lib/auth/session';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Next Shadcn Dashboard Starter',
  description: 'Basic dashboard with Next.js and Shadcn',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate for every /dashboard route. The proxy also redirects
  // unauthenticated requests, but this is the check that guarantees no
  // dashboard data is rendered without a verified session.
  const user = await requireUser();

  // Persisting the sidebar state in the cookie.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  const sessionUser = toSessionUser(user);
  return (
    <SessionProvider user={sessionUser}>
      <KBar>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar user={sessionUser} />
          <SidebarInset>
            <Header />
            <InfobarProvider defaultOpen={false}>
              {children}
              <InfoSidebar side='right' />
            </InfobarProvider>
          </SidebarInset>
        </SidebarProvider>
      </KBar>
    </SessionProvider>
  );
}
