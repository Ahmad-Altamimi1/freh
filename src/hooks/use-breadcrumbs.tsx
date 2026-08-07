'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
  '/dashboard/correspondences': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'المراسلات', link: '/dashboard/correspondences' }
  ],
  '/dashboard/product': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Product', link: '/dashboard/product' }
  ]
};

type BreadcrumbOverrideContextType = {
  title: string | null;
  setTitle: Dispatch<SetStateAction<string | null>>;
  segmentOverrides: Record<number, string>;
  setSegmentOverride: (index: number, title: string | null) => void;
};

const BreadcrumbOverrideContext = createContext<BreadcrumbOverrideContextType>({
  title: null,
  setTitle: () => {},
  segmentOverrides: {},
  setSegmentOverride: () => {}
});

export function BreadcrumbOverrideProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [segmentOverrides, setSegmentOverrides] = useState<Record<number, string>>({});

  const setSegmentOverride = useCallback((index: number, val: string | null) => {
    setSegmentOverrides((prev) => {
      const next = { ...prev };
      if (val === null) {
        delete next[index];
      } else {
        next[index] = val;
      }
      return next;
    });
  }, []);

  return (
    <BreadcrumbOverrideContext.Provider
      value={{ title, setTitle, segmentOverrides, setSegmentOverride }}
    >
      {children}
    </BreadcrumbOverrideContext.Provider>
  );
}

export function useBreadcrumbOverride() {
  return useContext(BreadcrumbOverrideContext);
}

export function useBreadcrumbs() {
  const pathname = usePathname();
  const { title: overrideTitle, segmentOverrides } = useContext(BreadcrumbOverrideContext);

  const breadcrumbs = useMemo(() => {
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const isLast = index === segments.length - 1;

      const explicitOverride = segmentOverrides[index];
      if (explicitOverride) {
        return { title: explicitOverride, link: path };
      }

      return {
        title:
          isLast && overrideTitle
            ? overrideTitle
            : segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname, overrideTitle, segmentOverrides]);

  return breadcrumbs;
}
