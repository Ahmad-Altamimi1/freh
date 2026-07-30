'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'Dashboard', link: '/dashboard' }],
  '/dashboard/employee': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Employee', link: '/dashboard/employee' }
  ],
  '/dashboard/organizations': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'الجمعيات', link: '/dashboard/organizations' }
  ],
  '/dashboard/product': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Product', link: '/dashboard/product' }
  ]
};

type BreadcrumbOverrideContextType = {
  title: string | null;
  setTitle: Dispatch<SetStateAction<string | null>>;
};

const BreadcrumbOverrideContext = createContext<BreadcrumbOverrideContextType>({
  title: null,
  setTitle: () => {}
});

export function BreadcrumbOverrideProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <BreadcrumbOverrideContext.Provider value={{ title, setTitle }}>
      {children}
    </BreadcrumbOverrideContext.Provider>
  );
}

export function useBreadcrumbOverride() {
  return useContext(BreadcrumbOverrideContext);
}

export function useBreadcrumbs() {
  const pathname = usePathname();
  const { title: overrideTitle } = useContext(BreadcrumbOverrideContext);

  const breadcrumbs = useMemo(() => {
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const isLast = index === segments.length - 1;
      return {
        title:
          isLast && overrideTitle
            ? overrideTitle
            : segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname, overrideTitle]);

  return breadcrumbs;
}
