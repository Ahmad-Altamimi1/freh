import type { UserStatus } from '../api/types';

/**
 * Arabic vocabulary for the users feature.
 *
 * A plain const map rather than an i18n library, matching the organizations
 * feature: the app is single-language, and a runtime translation layer would
 * buy nothing here. If a second language is ever needed, this file is the seam.
 *
 * Role names are NOT here: they live in the `roles` table and are editable
 * from the access-control screens, so translating them in code would fight the
 * database. Status values stay in English because they are derived from the
 * auth record; only their rendering is translated.
 */

export const USERS_PAGE_LABELS = {
  title: 'المستخدمون',
  description: 'حسابات المستخدمين في Supabase Auth — الصلاحيات وحالة الدخول.',
  addUser: 'إضافة مستخدم'
} as const;

export const USER_FIELD_LABELS = {
  firstName: 'الاسم الأول',
  lastName: 'اسم العائلة',
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  phone: 'رقم الهاتف',
  password: 'كلمة المرور',
  newPassword: 'كلمة مرور جديدة',
  role: 'الصلاحية',
  status: 'الحالة',
  lastSignInAt: 'آخر تسجيل دخول'
} as const;

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  Active: 'نشط',
  Inactive: 'موقوف',
  // Not a stored state: the account exists but has never been confirmed or
  // signed in.
  Invited: 'بانتظار التفعيل'
};

export const USER_FORM_LABELS = {
  createTitle: 'مستخدم جديد',
  editTitle: 'تعديل مستخدم',
  createDescription: 'يُنشئ حسابًا في Supabase Auth يستطيع صاحبه تسجيل الدخول به مباشرة.',
  editDescription: 'تعديل حساب المستخدم في Supabase Auth.',
  submitCreate: 'إنشاء المستخدم',
  submitEdit: 'حفظ التعديلات',
  cancel: 'إلغاء',
  noRole: 'بدون صلاحية',
  selectRole: 'اختر الصلاحية',
  selectStatus: 'اختر الحالة',
  emailHint: 'العنوان الذي يسجّل المستخدم الدخول به.',
  passwordCreateHint: 'شارك كلمة المرور مع المستخدم بعد الإنشاء.',
  passwordEditHint: 'اتركه فارغًا للإبقاء على كلمة المرور الحالية.',
  passwordPlaceholder: '٨ أحرف على الأقل',
  phoneHint: 'رقم للتواصل فقط — لا يُستخدم لتسجيل الدخول.',
  roleHint: 'الصلاحية تحدد ما يستطيع المستخدم الوصول إليه، وتسري من طلبه التالي.',
  selfRoleLocked: 'لا يمكنك تغيير صلاحيتك الخاصة.',
  statusHint: 'الإيقاف يمنع تسجيل الدخول دون حذف الحساب.'
} as const;

export const USER_TABLE_LABELS = {
  searchPlaceholder: 'ابحث عن مستخدم...',
  noRole: 'بدون صلاحية',
  neverSignedIn: 'لم يسجّل الدخول بعد',
  empty: '—',
  actions: 'الإجراءات',
  edit: 'تعديل',
  delete: 'حذف',
  openMenu: 'فتح القائمة'
} as const;

export const USER_DELETE_LABELS = {
  title: 'حذف المستخدم؟',
  description: 'سيُحذف الحساب من Supabase Auth نهائيًا ولن يتمكن صاحبه من تسجيل الدخول.',
  confirm: 'حذف',
  cancel: 'إلغاء'
} as const;

export const USER_MESSAGES = {
  created: 'تم إنشاء المستخدم بنجاح',
  createFailed: 'تعذّر إنشاء المستخدم',
  updated: 'تم تحديث بيانات المستخدم بنجاح',
  updateFailed: 'تعذّر تحديث بيانات المستخدم',
  deleted: 'تم حذف المستخدم بنجاح',
  deleteFailed: 'تعذّر حذف المستخدم'
} as const;

/** Validation copy, shared between the Zod schema and the per-field validators. */
export const USER_VALIDATION_MESSAGES = {
  firstName: 'الاسم الأول يجب ألا يقل عن حرفين',
  lastName: 'اسم العائلة يجب ألا يقل عن حرفين',
  email: 'أدخل بريدًا إلكترونيًا صحيحًا',
  password: 'كلمة المرور يجب ألا تقل عن ٨ أحرف'
} as const;

/** Errors thrown by the service and surfaced to the user as-is. */
export const USER_SERVICE_ERRORS = {
  forbidden: 'غير مصرح لك بإدارة المستخدمين.',
  passwordRequired: 'كلمة المرور مطلوبة عند إنشاء مستخدم جديد.',
  loadFailed: 'تعذّر تحميل المستخدمين',
  createFailed: 'تعذّر إنشاء المستخدم.',
  updateFailed: 'تعذّر تحديث بيانات المستخدم.',
  deleteFailed: 'تعذّر حذف المستخدم.',
  selfDeactivate: 'لا يمكنك إيقاف حسابك الخاص.',
  selfDelete: 'لا يمكنك حذف حسابك الخاص.',
  selfRoleChange: 'لا يمكنك تغيير صلاحيتك الخاصة — اطلب ذلك من مدير نظام آخر.',
  unknownRole: 'الصلاحية المحددة غير موجودة.'
} as const;
