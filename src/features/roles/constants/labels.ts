/**
 * Arabic vocabulary for the roles feature.
 *
 * A plain const map rather than an i18n library, matching the users and
 * organizations features: the app is single-language, and this file is the seam
 * if that ever changes.
 *
 * Permission labels are NOT here — they sit beside the permission catalog in
 * `@/lib/auth/permissions`, so that adding a permission and naming it are the
 * same edit. A checkbox nobody can describe is a checkbox nobody can safely tick.
 */

export const ROLES_PAGE_LABELS = {
  title: 'الأدوار والصلاحيات',
  description: 'عرّف الأدوار وحدّد ما يستطيع كل دور القيام به داخل النظام.',
  addRole: 'دور جديد'
} as const;

export const ROLE_FIELD_LABELS = {
  key: 'المعرّف',
  keyHint: 'حروف إنجليزية صغيرة وأرقام و - و _ فقط. لا يمكن تغييره بعد الإنشاء.',
  name: 'اسم الدور',
  description: 'الوصف',
  permissions: 'الصلاحيات',
  members: 'المستخدمون',
  updatedAt: 'آخر تحديث'
} as const;

export const ROLE_FORM_LABELS = {
  createTitle: 'دور جديد',
  editTitle: 'تعديل الدور',
  createDescription: 'اختر ما يستطيع حاملو هذا الدور القيام به.',
  editDescription: 'عدّل اسم الدور أو الصلاحيات الممنوحة له.',
  save: 'حفظ',
  cancel: 'إلغاء',
  saving: 'جارٍ الحفظ…',
  selectAll: 'تحديد الكل',
  clearAll: 'إلغاء الكل',
  permissionCount: (granted: number, total: number) => `${granted} من ${total}`,
  systemRoleNotice:
    'هذا دور النظام: يملك كل الصلاحيات دائمًا ولا يمكن حذفه أو الانتقاص منه. وجوده يضمن بقاء طريق واحد لإدارة الصلاحيات مهما تغيّرت بقية الأدوار.',
  createSuccess: 'تم إنشاء الدور.',
  updateSuccess: 'تم حفظ الدور.',
  failed: 'تعذّر حفظ الدور.'
} as const;

export const ROLE_TABLE_LABELS = {
  empty: 'لا توجد أدوار.',
  systemBadge: 'دور النظام',
  memberCount: (total: number) => (total === 1 ? 'مستخدم واحد' : `${total} مستخدمين`),
  noMembers: 'لا أحد',
  noPermissions: 'بدون صلاحيات',
  allPermissions: 'كل الصلاحيات',
  rowActions: 'إجراءات',
  openMenu: 'فتح القائمة',
  edit: 'تعديل',
  delete: 'حذف'
} as const;

export const ROLE_DELETE_LABELS = {
  title: 'حذف الدور',
  description: 'سيُحذف هذا الدور نهائيًا. لا يمكن التراجع عن هذا الإجراء.',
  confirm: 'حذف',
  cancel: 'إلغاء',
  success: 'تم حذف الدور.',
  failed: 'تعذّر حذف الدور.'
} as const;

/** Server-side refusals. Phrased so the user can act on them. */
export const ROLE_SERVICE_ERRORS = {
  forbidden: 'غير مصرح لك بإدارة الأدوار والصلاحيات.',
  notFound: 'الدور غير موجود.',
  nameRequired: 'اسم الدور مطلوب.',
  invalidKey: 'المعرّف يجب أن يبدأ بحرف إنجليزي صغير ويحتوي على حروف وأرقام و - و _ فقط.',
  duplicateKey: 'يوجد دور آخر بنفس المعرّف.',
  systemRoleLocked: 'لا يمكن الانتقاص من صلاحيات دور النظام.',
  systemRoleUndeletable: 'لا يمكن حذف دور النظام.',
  selfLockout:
    'لا يمكنك سحب صلاحية إدارة الصلاحيات عن نفسك — عيّن دورًا آخر يملكها أولًا، وإلا فقدت الوصول لهذه الشاشة.',
  roleInUse: (total: number) =>
    `لا يمكن حذف الدور لأن ${total} من المستخدمين ما زالوا يحملونه. أزل الدور عنهم أولًا.`
} as const;
