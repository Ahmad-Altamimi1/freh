import type { FilterOperator, JoinOperator } from '@/types/data-table';
import type { RelativeDateToken } from '@/lib/filter-columns';
import type { TermRemainingFilter } from '../lib/term';

/**
 * Arabic vocabulary for the organizations feature.
 *
 * A plain const map rather than an i18n library: the app is single-language, and
 * a runtime translation layer would add a dependency, a provider and a lookup
 * cost to solve a problem that does not exist here. If a second language is ever
 * needed, this file is the seam to replace.
 *
 * Field labels live here rather than inline in the column definitions so the
 * table header, the filter builder, and the Excel export cannot drift apart.
 */

export const ORGANIZATION_FIELD_LABELS = {
  name: 'اسم الجمعية',
  district: 'اللواء',
  classification: 'التصنيف',
  nationalId: 'الرقم الوطني',
  establishedAt: 'تاريخ التأسيس',
  termStart: 'تاريخ بداية الدورة',
  termEnd: 'تاريخ نهاية الدورة',
  termLength: 'مدة الدورة (بالأشهر)',
  directorName: 'اسم المدير',
  mobile: 'رقم الهاتف',
  serialNo: 'التسلسل'
} as const;

export type OrganizationField = keyof typeof ORGANIZATION_FIELD_LABELS;

/**
 * Arabic labels for the filter operators defined in `@/config/data-table`.
 *
 * Translated at render time rather than by editing `dataTableConfig`, because
 * that config is shared with the template's other tables.
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

/** Arabic labels for the term-ending-soon page's "time remaining" tabs and column. */
export const ORGANIZATION_TERM_BUCKET_LABELS: Record<TermRemainingFilter, string> = {
  all: 'الكل',
  expired: 'منتهية',
  lt_2mo: 'أقل من شهرين',
  lt_3mo: 'أقل من 3 أشهر',
  lt_6mo: 'أقل من 6 أشهر',
  lt_1yr: 'أقل من سنة',
  gt_1yr: 'أكثر من سنة'
};

/** Column header for the synthetic "remaining time" column — not a real DB field, so it lives outside `ORGANIZATION_FIELD_LABELS`. */
export const ORGANIZATION_REMAINING_TIME_COLUMN_LABEL = 'الوقت المتبقي';

/** UI strings, grouped by where they appear. */
export const ORGANIZATION_LABELS = {
  entity: {
    plural: 'الجمعيات',
    singular: 'جمعية'
  },
  page: {
    listTitle: 'الجمعيات',
    listDescription: 'سجل الجمعيات الثقافية في محافظة إربد — بحث وتصفية متقدمة.',
    reportTitle: 'التقارير',
    reportDescription: 'ملخص وإحصاءات مبنية على التصفية الحالية.',
    importTitle: 'استيراد البيانات',
    importDescription: 'رفع ملف إكسل وتحديث السجل.',
    endingSoonTitle: 'قرب انتهاء الدورة',
    endingSoonDescription: 'الجمعيات التي تقترب دوراتها من الانتهاء، مصنّفة حسب الوقت المتبقي.',
    detailTitle: 'بيانات الجمعية',
    detailDescription: 'عرض تفاصيل الجمعية.'
  },
  table: {
    search: 'ابحث في السجل…',
    noResults: 'لا توجد نتائج مطابقة.',
    rowsSelected: 'صف محدد',
    of: 'من'
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
    report: 'تقرير عن النتائج الحالية',
    exportExcel: 'تصدير إلى إكسل',
    print: 'طباعة',
    import: 'استيراد',
    backToList: 'العودة إلى السجل',
    view: 'عرض',
    openMenu: 'فتح القائمة',
    create: 'إضافة جمعية',
    edit: 'تعديل',
    delete: 'حذف',
    rowActions: 'إجراءات',
    importMembers: 'استيراد أعضاء من إكسل'
  },
  form: {
    createTitle: 'إضافة جمعية',
    createDescription: 'أدخل بيانات الجمعية الجديدة.',
    editTitle: 'تعديل بيانات الجمعية',
    editDescription: 'حدّث بيانات الجمعية ثم احفظ التغييرات.',
    cancel: 'إلغاء',
    save: 'حفظ',
    create: 'إضافة',
    selectDistrict: 'اختر اللواء',
    selectClassification: 'اختر التصنيف',
    noClassification: 'بدون تصنيف',
    mobileHint: 'الصيغة المتوقعة: 07XXXXXXXX',
    nationalIdHint: 'الرقم الوطني ليس فريدًا — قد تشترك جمعيتان في نفس الرقم.',
    termEndHint: 'يُحسب تلقائيًا من تاريخ البداية ومدة الدورة.',
    created: 'تمت إضافة الجمعية.',
    updated: 'تم حفظ التغييرات.',
    createFailed: 'تعذّرت إضافة الجمعية.',
    updateFailed: 'تعذّر حفظ التغييرات.',
    memberSectionTitle: 'أعضاء الجمعية',
    memberName: 'الاسم',
    memberNationalId: 'الرقم الوطني',
    memberMobile: 'رقم الهاتف',
    memberJobTitle: 'المسمى الوظيفي',
    addMember: 'إضافة عضو',
    removeMember: 'حذف',
    memberNameRequired: 'اسم العضو مطلوب',
    memberDuplicateNationalId: 'يوجد عضو بنفس الرقم الوطني بالفعل',
    membersImportSuccess: 'تم استيراد الأعضاء بنجاح',
    membersImportFailed: 'فشل استيراد الأعضاء',
    memberEditTitle: 'تعديل بيانات العضو',
    memberEditSave: 'حفظ',
    memberEditCancel: 'إلغاء',
    deleteMemberConfirm: 'حذف العضو',
    deleteMemberDescription: 'سيتم حذف هذا العضو من قائمة الأعضاء.',
    deleteSelected: 'حذف المحدد',
    selectAll: 'تحديد الكل'
  },
  delete: {
    title: 'حذف الجمعية؟',
    description: 'سيتم حذف هذه الجمعية نهائيًا. لا يمكن التراجع عن هذا الإجراء.',
    confirm: 'حذف',
    cancel: 'إلغاء',
    success: 'تم حذف الجمعية.',
    failed: 'تعذّر حذف الجمعية.'
  },
  report: {
    total: 'إجمالي الجمعيات',
    districts: 'عدد الألوية',
    classifications: 'عدد التصنيفات',
    withMobile: 'لديها رقم هاتف',
    withDirector: 'لديها اسم مدير',
    range: 'سنوات التأسيس',
    byDistrict: 'التوزيع حسب اللواء',
    byClassification: 'التوزيع حسب التصنيف',
    byYear: 'التأسيس عبر السنوات',
    appliedFilters: 'معايير التصفية المطبقة',
    noFilters: 'لا توجد معايير — التقرير يشمل السجل بالكامل.',
    generatedAt: 'تاريخ إنشاء التقرير',
    unclassified: 'غير مصنّف'
  },
  members: {
    sectionTitle: 'أعضاء الجمعية',
    noMembers: 'لا يوجد أعضاء',
    nationalId: 'الرقم الوطني',
    mobile: 'رقم الهاتف',
    jobTitle: 'المسمى الوظيفي',
    importTitle: 'استيراد أعضاء الجمعية',
    importDescription: 'رفع ملف إكسل يحتوي على قائمة الأعضاء لإضافتهم إلى الجمعية.',
    importButton: 'استيراد أعضاء',
    importSuccess: 'تم استيراد الأعضاء بنجاح.',
    importFailed: 'تعذّر استيراد الأعضاء.',
    importAnother: 'استيراد ملف آخر',
    backToDetail: 'العودة إلى بيانات الجمعية'
  },
  import: {
    steps: {
      upload: 'رفع الملف',
      preview: 'المعاينة والمطابقة',
      result: 'النتيجة'
    },
    dropzone: 'اسحب ملف إكسل هنا أو اضغط للاختيار',
    template: 'تنزيل نموذج فارغ',
    detectedColumns: 'الأعمدة المكتشفة',
    unmapped: 'أعمدة غير مستخدمة',
    missingRequired: 'أعمدة مطلوبة غير موجودة',
    sample: 'أول صفوف من الملف',
    confirm: 'تأكيد الاستيراد',
    back: 'رجوع',
    inserted: 'صفوف مضافة',
    updated: 'صفوف محدّثة',
    skipped: 'صفوف متجاهلة',
    warnings: 'تنبيهات',
    errors: 'أخطاء',
    issueRow: 'الصف',
    issueColumn: 'العمود',
    issueMessage: 'التفاصيل',
    downloadIssues: 'تنزيل الملاحظات',
    importAnother: 'استيراد ملف آخر',
    close: 'إغلاق',
    noIssues: 'لا توجد ملاحظات.'
  }
} as const;
