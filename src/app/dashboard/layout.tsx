import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { SessionProvider } from '@/components/layout/session-provider';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { BreadcrumbOverrideProvider } from '@/hooks/use-breadcrumbs';
import { getEffectiveAccess } from '@/lib/auth/access';
import { requireUser, toSessionUser } from '@/lib/auth/session';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'لوحة التحكم',
  description: 'سجل الجمعيات الثقافية في محافظة إربد.',
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
  // Roles and permissions come from the database, not the JWT — so a grant
  // changed a moment ago is reflected on this render rather than whenever the
  // user's token next refreshes.
  const access = await getEffectiveAccess();
  const sessionUser = toSessionUser(user, access);
  return (
    <SessionProvider user={sessionUser}>
      <KBar>
        <SidebarProvider defaultOpen={defaultOpen}>
          {/* RTL: primary navigation belongs on the leading (right) edge, and
              the contextual info panel on the opposite one. */}
          <AppSidebar user={sessionUser} side='right' />
          <SidebarInset>
            <BreadcrumbOverrideProvider>
              <Header />
              <InfobarProvider defaultOpen={false}>
                {children}
                <InfoSidebar side='left' />
              </InfobarProvider>
            </BreadcrumbOverrideProvider>
          </SidebarInset>
        </SidebarProvider>
      </KBar>
    </SessionProvider>
  );
}
