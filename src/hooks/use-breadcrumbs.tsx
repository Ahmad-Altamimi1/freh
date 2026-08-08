'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

const segmentLabels: Record<string, string> = {
  dashboard: 'الرئيسية',
  overview: 'لوحة التحكم',
  organizations: 'الجمعيات',
  reports: 'التقارير',
  'import-members': 'استيراد الأعضاء',
  correspondences: 'المراسلات',
  renewals: 'تجديد الهيئات',
  notifications: 'الإشعارات',
  users: 'المستخدمون',
  settings: 'الإعدادات',
  roles: 'الأدوار والصلاحيات',
  profile: 'الملف الشخصي',
  new: 'إضافة',
  edit: 'تعديل'
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
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const isLast = index === segments.length - 1;

      const explicitOverride = segmentOverrides[index];
      if (explicitOverride) {
        return { title: explicitOverride, link: path };
      }

      if (isLast && overrideTitle) {
        return { title: overrideTitle, link: path };
      }

      return {
        title: segmentLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname, overrideTitle, segmentOverrides]);

  return breadcrumbs;
}
