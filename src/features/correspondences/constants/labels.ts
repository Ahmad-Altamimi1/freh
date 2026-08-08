import type { FilterOperator, JoinOperator } from '@/types/data-table';
import type { RelativeDateToken } from '@/lib/filter-columns';
import { Icons, type Icon } from '@/components/icons';
import { CORRESPONDENCE_TYPES, type CorrespondenceType } from '../api/types';

/**
 * Arabic vocabulary for the correspondences feature.
 *
 * A plain const map rather than an i18n library — see
 * `@/features/organizations/constants/labels.ts` for why. Field labels live
 * here rather than inline in the column definitions so the table header and
 * the filter builder cannot drift apart.
 */

export const CORRESPONDENCE_FIELD_LABELS = {
  name: 'اسم المراسلة',
  type: 'نوع المراسلة',
  organizationId: 'الجهة المعنية',
  files: 'الملفات',
  createdAt: 'تاريخ الإضافة',
  updatedAt: 'آخر تحديث'
} as const;

export const CORRESPONDENCE_TYPE_OPTIONS = CORRESPONDENCE_TYPES.map((type) => ({
  value: type,
  label: type
}));

/** Cosmetic only — the Arabic value IS the label, there is no translation layer to keep in sync. */
export const CORRESPONDENCE_TYPE_BADGE_VARIANT: Record<
  CorrespondenceType,
  'default' | 'secondary'
> = {
  صادر: 'default',
  وارد: 'secondary'
};

export const CORRESPONDENCE_TYPE_ICON: Record<CorrespondenceType, Icon> = {
  صادر: Icons.send,
  وارد: Icons.mail
};

/**
 * Arabic labels for the filter operators defined in `@/config/data-table`.
 *
 * Duplicated from `@/features/organizations/constants/labels.ts` rather than
 * shared — both features currently own this independently. Worth extracting
 * once a third filterable feature needs the same three maps.
 */
export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  iLike: 'يحتوي على',
  notILike: 'لا يحتوي على',
  eq: 'يساوي',
  ne: 'لا يساوي',
  inArray: 'أحد الخيارات',
  notInArray: 'ليس أحد الخيارات',
  isEmpty: 'فارغ',
  isNotEmpty: 'غير فارغ',
  lt: 'قبل',
  lte: 'في أو قبل',
  gt: 'بعد',
  gte: 'في أو بعد',
  isBetween: 'بين',
  isRelativeToToday: 'بالنسبة لليوم'
};

export const JOIN_OPERATOR_LABELS: Record<JoinOperator, string> = {
  and: 'و',
  or: 'أو'
};

export const RELATIVE_DATE_LABELS: Record<RelativeDateToken, string> = {
  today: 'اليوم',
  yesterday: 'أمس',
  last7: 'آخر ٧ أيام',
  last30: 'آخر ٣٠ يومًا',
  last90: 'آخر ٩٠ يومًا',
  thisMonth: 'هذا الشهر',
  thisYear: 'هذه السنة'
};

/** UI strings, grouped by where they appear. */
export const CORRESPONDENCE_LABELS = {
  entity: {
    plural: 'المراسلات',
    singular: 'مراسلة'
  },
  page: {
    listTitle: 'المراسلات',
    listDescription: 'سجل المراسلات الصادرة والواردة — بحث وتصفية متقدمة.',
    createTitle: 'إضافة مراسلة',
    createDescription: 'أدخل بيانات المراسلة الجديدة.',
    detailTitle: 'بيانات المراسلة',
    editTitle: 'تعديل المراسلة',
    noAccess: 'ليست لديك صلاحية للوصول إلى هذه الصفحة.'
  },
  table: {
    search: 'ابحث في المراسلات…',
    noResults: 'لا توجد نتائج مطابقة.'
  },
  filters: {
    trigger: 'تصفية متقدمة',
    empty: 'لا توجد شروط بعد.',
    add: 'إضافة شرط',
    apply: 'تصفية',
    reset: 'إعادة تعيين',
    remove: 'حذف الشرط',
    where: 'حيث',
    selectField: 'اختر الحقل',
    selectOperator: 'اختر العملية',
    value: 'القيمة',
    from: 'من',
    to: 'إلى',
    activeCount: (n: number) => `${n} شرط`
  },
  actions: {
    view: 'عرض',
    edit: 'تعديل',
    delete: 'حذف',
    create: 'إضافة مراسلة',
    backToList: 'العودة إلى السجل',
    openMenu: 'فتح القائمة',
    rowActions: 'إجراءات',
    download: 'تنزيل',
    downloadUnavailable: 'تعذّر إنشاء رابط التحميل'
  },
  form: {
    cancel: 'إلغاء',
    save: 'حفظ',
    create: 'إضافة',
    selectType: 'اختر نوع المراسلة',
    selectOrganization: 'اختر الجهة المعنية',
    searchOrganization: 'ابحث عن جهة…',
    noOrganizationFound: 'لا توجد نتائج.',
    filesLabel: 'ملفات المراسلة',
    existingFilesLabel: 'الملفات الحالية',
    newFilesLabel: 'إضافة ملفات جديدة',
    noFiles: 'لا توجد ملفات مرفقة.',
    created: 'تمت إضافة المراسلة.',
    updated: 'تم حفظ التغييرات.',
    createFailed: 'تعذّرت إضافة المراسلة.',
    updateFailed: 'تعذّر حفظ التغييرات.'
  },
  delete: {
    title: 'حذف المراسلة؟',
    description: 'سيتم حذف هذه المراسلة وملفاتها نهائيًا. لا يمكن التراجع عن هذا الإجراء.',
    confirm: 'حذف',
    cancel: 'إلغاء',
    success: 'تم حذف المراسلة.',
    failed: 'تعذّر حذف المراسلة.'
  }
} as const;
