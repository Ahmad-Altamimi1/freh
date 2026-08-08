import { formatNumberAr } from '@/lib/format';
import type { FilterOperator, JoinOperator } from '@/types/data-table';
import type { RelativeDateToken } from '@/lib/filter-columns';

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
    activeCount: (n: number) => `${n} شرط`,
    /** Clears the quick search and every condition in one action. */
    clearAll: 'مسح الكل',
    /** The و/أو control sitting between the first two pills. */
    joinToggle: 'تبديل بين "و" و"أو"',
    /** Shown in place of the pill row while nothing is filtering. */
    none: 'بدون تصفية — يشمل السجل بالكامل'
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
    range: 'سنوات التأسيس',
    byDistrict: 'التوزيع حسب اللواء',
    byClassification: 'التوزيع حسب التصنيف',
    byYear: 'التأسيس عبر السنوات',
    appliedFilters: 'معايير التصفية المطبقة',
    noFilters: 'لا توجد معايير — التقرير يشمل السجل بالكامل.',
    generatedAt: 'تاريخ إنشاء التقرير',
    unclassified: 'غير مصنّف'
  },
  detail: {
    sections: {
      identity: 'البيانات الأساسية',
      term: 'الدورة الحالية',
      contact: 'بيانات التواصل'
    },
    stats: {
      members: 'الأعضاء',
      established: 'سنة التأسيس',
      termLength: 'مدة الدورة',
      remaining: 'المتبقي من الدورة'
    },
    termEnded: 'انتهت الدورة',
    empty: '—',
    dangerZone: {
      title: 'منطقة الخطر',
      description: 'حذف الجمعية إجراء نهائي — سيتم حذف بياناتها وأعضائها ولا يمكن التراجع.'
    }
  },
  /** The home dashboard. */
  dashboard: {
    title: 'لوحة التحكم',
    description: 'نظرة عامة على السجل، وما ينقصه من بيانات، وحالة الدورات.',
    alerts: {
      title: 'بيانات ناقصة',
      description: 'اضغط على أي بند لفتح الجمعيات التي ينقصها ذلك البيان واستكماله.',
      allClear: 'لا توجد بيانات ناقصة — السجل مكتمل.',
      complete: 'مكتمل',
      /** Opens the filtered registry listing. */
      openList: 'عرض الجمعيات',
      /** Opens one organization's page, where the missing value is filled in. */
      fillIn: 'استكمال',
      andMore: (n: number) => `و${n} غيرها`
    },
    /** The missing-data checks, phrased as what is absent. */
    issues: {
      mobile: 'بدون رقم هاتف',
      directorName: 'بدون اسم مدير',
      nationalId: 'بدون رقم وطني',
      establishedAt: 'بدون تاريخ تأسيس',
      term: 'بدون دورة محددة'
    },
    term: {
      title: 'حالة الدورات',
      description: (days: number) => `نافذة التنبيه الحالية: ${days} يومًا قبل انتهاء الدورة.`,
      active: 'سارية',
      endingSoon: 'تنتهي قريبًا',
      ended: 'منتهية',
      unset: 'غير محددة'
    },
    recent: {
      title: 'آخر التحديثات',
      description: 'أحدث الجمعيات التي تمت إضافتها أو تعديلها.',
      empty: 'لا توجد سجلات بعد.'
    },
    /** Shortcuts to the work the dashboard points at. */
    actions: {
      browse: 'تصفّح السجل',
      report: 'إنشاء تقرير'
    },
    /** Shown instead of the aggregate to a user who cannot read the registry. */
    noAccess: {
      title: 'لا توجد بيانات لعرضها',
      description:
        'حسابك لا يملك صلاحية الاطلاع على سجل الجمعيات. راجع مدير النظام إذا كنت بحاجة إلى ذلك.'
    }
  },
  /** Report builder controls. */
  builder: {
    title: 'منشئ التقارير',
    description: 'اختر المعايير وشكل التقرير، ثم اطبعه أو نزّله بصيغة PDF.',
    reportTitle: 'عنوان التقرير',
    criteria: 'معايير التصفية',
    groupBy: 'التجميع حسب',
    sections: 'أقسام التقرير',
    columns: 'أعمدة الجدول',
    matching: 'النتائج المطابقة',
    openPrint: 'معاينة الطباعة',
    downloadPdf: 'تنزيل PDF',
    exportExcel: 'تصدير إلى إكسل',
    templates: 'القوالب المحفوظة',
    noTemplates: 'لا توجد قوالب محفوظة بعد.',
    loadTemplate: 'تحميل',
    saveTemplate: 'حفظ كقالب',
    updateTemplate: 'تحديث القالب',
    templateName: 'اسم القالب',
    templateDescription: 'وصف مختصر (اختياري)',
    templateSaved: 'تم حفظ القالب.',
    templateUpdated: 'تم تحديث القالب.',
    templateDeleted: 'تم حذف القالب.',
    templateSaveFailed: 'تعذّر حفظ القالب.',
    templateDeleteFailed: 'تعذّر حذف القالب.',
    deleteTemplateTitle: 'حذف القالب؟',
    deleteTemplateDescription: 'سيتم حذف هذا القالب نهائيًا.',
    selectAtLeastOneSection: 'اختر قسمًا واحدًا على الأقل.',
    selectAtLeastOneColumn: 'اختر عمودًا واحدًا على الأقل.',
    /** Card headings and helper text for the redesigned builder. */
    shape: 'شكل التقرير',
    shapeDescription: 'العنوان والتجميع والأقسام التي يتكوّن منها المستند.',
    sectionsHint: 'الكتل التي ستُطبع، بالترتيب.',
    columnsHint: 'الحقول التي ستظهر في جدول التفاصيل.',
    selectAllColumns: 'تحديد الكل',
    clearColumns: 'مسح',
    columnsCount: (selected: number, total: number) => `${selected} من ${total}`,
    distribution: 'التوزيع حسب',
    output: 'الإخراج',
    outputBlocked: 'اختر قسمًا وعمودًا واحدًا على الأقل لتفعيل التصدير.'
  },
  /** Grouping dimensions offered by the builder. */
  groupBy: {
    district: 'اللواء',
    classification: 'التصنيف',
    year: 'سنة التأسيس',
    termStatus: 'حالة الدورة'
  },
  /** Blocks the report may contain. */
  sections: {
    criteria: 'معايير التصفية',
    summary: 'الملخص الإحصائي',
    charts: 'الرسوم البيانية',
    table: 'جدول التفاصيل'
  },
  /** Strings that appear only on the printed document. */
  document: {
    kingdom: 'المملكة الأردنية الهاشمية',
    ministry: 'وزارة الثقافة',
    directorate: 'مديرية ثقافة اربد',
    department: 'قسم الهيئات',
    groupedTitle: 'التوزيع حسب',
    total: 'الإجمالي',
    percent: 'النسبة',
    count: 'العدد',
    rowNumber: 'م',
    preparedBy: 'إعداد',
    reviewedBy: 'تدقيق',
    approvedBy: 'اعتماد',
    signature: 'التوقيع',
    page: 'صفحة',
    /** Shown in the repeating page header, beside the emblem. */
    runningTitle: 'تقرير الجمعيات الثقافية — اربد',
    printedNote: 'وثيقة صادرة عن نظام سجل الجمعيات الثقافية',
    noRows: 'لا توجد سجلات مطابقة للمعايير المحددة.'
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

/**
 * A count of organizations, agreeing in Arabic.
 *
 * Arabic counts take four forms — singular, dual, the 3–10 plural, and the
 * ≥11 singular-after-number — so the obvious `${n} جمعية` template reads as
 * broken grammar for every count below eleven.
 */
export function formatOrganizationCountAr(count: number): string {
  if (count === 0) return 'لا توجد جمعيات';
  if (count === 1) return 'جمعية واحدة';
  if (count === 2) return 'جمعيتان';
  if (count <= 10) return `${formatNumberAr(count)} جمعيات`;
  return `${formatNumberAr(count)} جمعية`;
}
