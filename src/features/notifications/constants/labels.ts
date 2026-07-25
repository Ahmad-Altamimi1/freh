import { formatDateAr } from '@/lib/format';

/**
 * Arabic vocabulary for the notifications feature, following the same
 * plain-const-map convention as `@/features/organizations/constants/labels`.
 */
export const NOTIFICATION_LABELS = {
  page: {
    title: 'الإشعارات',
    description: 'إشعاراتك، بما فيها تنبيهات اقتراب انتهاء دورات الجمعيات.'
  },
  center: {
    title: 'الإشعارات',
    markAllRead: 'تعليم الكل كمقروء',
    empty: 'لا توجد إشعارات',
    newCount: (n: number) => `${n} جديد`,
    markReadFailed: 'تعذّر تحديث الإشعار.',
    markAllReadFailed: 'تعذّر تحديث الإشعارات.'
  },
  tabs: {
    all: (n: number) => `الكل (${n})`,
    unread: (n: number) => `غير مقروء (${n})`,
    read: (n: number) => `مقروء (${n})`
  },
  empty: 'لا توجد إشعارات',
  markAsRead: 'تعليم كمقروء',
  termEndingSoon: {
    title: 'اقتراب انتهاء الدورة',
    body: (organizationName: string, termEnd: string) =>
      `دورة «${organizationName}» تنتهي بتاريخ ${formatDateAr(termEnd)}.`,
    actionLabel: 'عرض الجمعية'
  }
} as const;
