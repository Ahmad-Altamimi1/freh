/**
 * The permission catalog — the single source of truth for what can be done.
 *
 * Permissions are the *only* thing authorization branches on. Roles are just
 * named bundles of them, editable at runtime from
 * `/dashboard/settings/roles`, so a business change ("let the reports clerk
 * export Excel but not PDF") is a checkbox rather than a deploy.
 *
 * Two rules keep this honest:
 *
 *  1. Never check a role name in application code. `hasAnyRole(user, ['admin'])`
 *     is a permission that cannot be delegated — the whole point of this file is
 *     that an administrator can hand out a capability without handing out the
 *     role that happens to carry it today. Check `can(user, PERMISSIONS.x)`.
 *
 *  2. This catalog is a closed set, not free text. `Permission` is a union of
 *     literals, so a typo is a compile error and the role editor can render
 *     every permission that exists without a second list to keep in sync.
 *
 * The naming convention is `domain:action`, with the format appended where the
 * *format* is the thing being restricted rather than the data — an Excel file
 * leaves the building differently from a screen, which is exactly the
 * distinction `reports:export:excel` vs `reports:view` exists to draw.
 */

/** Every permission the application understands. */
export const PERMISSIONS = {
  // ── Organizations registry ────────────────────────────────────────────
  ORGANIZATIONS_READ: 'organizations:read',
  ORGANIZATIONS_CREATE: 'organizations:create',
  ORGANIZATIONS_UPDATE: 'organizations:update',
  ORGANIZATIONS_DELETE: 'organizations:delete',
  /** Download the registry itself as a workbook, and the blank import template. */
  ORGANIZATIONS_EXPORT: 'organizations:export',
  /** Bulk-load organizations or members from an uploaded workbook. */
  ORGANIZATIONS_IMPORT: 'organizations:import',
  /** Edit the member roster attached to an organization. */
  MEMBERS_UPDATE: 'members:update',

  // ── Correspondences ───────────────────────────────────────────────────
  CORRESPONDENCES_READ: 'correspondences:read',
  CORRESPONDENCES_CREATE: 'correspondences:create',
  CORRESPONDENCES_UPDATE: 'correspondences:update',
  CORRESPONDENCES_DELETE: 'correspondences:delete',

  // ── Reports ───────────────────────────────────────────────────────────
  /** See the reports page and run a report on screen. */
  REPORTS_VIEW: 'reports:view',
  /** Render a report to PDF and download it. */
  REPORTS_EXPORT_PDF: 'reports:export:pdf',
  /** Download a report as an Excel workbook. */
  REPORTS_EXPORT_EXCEL: 'reports:export:excel',
  /** Create, rename and delete the shared saved-report definitions. */
  REPORTS_TEMPLATE_MANAGE: 'reports:template:manage',

  // ── Notifications ─────────────────────────────────────────────────────
  NOTIFICATIONS_READ: 'notifications:read',

  // ── Access control (this system itself) ───────────────────────────────
  /** Create/edit/delete roles and assign them to users. */
  ACCESS_MANAGE: 'access:manage'
} as const;

/** A permission string, narrowed to the catalog above. */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every permission, as a flat list — the role editor iterates this. */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

/**
 * Narrows an arbitrary string to a `Permission`.
 *
 * Rows read back from `role_permissions` are plain `text` — a permission
 * retired from this catalog would still sit in the table. Filtering unknown
 * strings out on read means removing a permission here silently stops granting
 * it, instead of leaving a dead string that can never match a check.
 */
export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/**
 * Presentation metadata for the role editor, grouped the way the UI renders it.
 *
 * Kept beside the catalog rather than in a feature's `labels.ts` because a new
 * permission that nobody can describe is a checkbox nobody can safely tick —
 * adding one here forces the label to be written at the same time.
 */
export type PermissionGroup = {
  key: string;
  label: string;
  permissions: { permission: Permission; label: string; description?: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'organizations',
    label: 'الجمعيات',
    permissions: [
      {
        permission: PERMISSIONS.ORGANIZATIONS_READ,
        label: 'عرض الجمعيات',
        description: 'تصفّح السجل وفتح صفحة أي جمعية.'
      },
      { permission: PERMISSIONS.ORGANIZATIONS_CREATE, label: 'إضافة جمعية' },
      { permission: PERMISSIONS.ORGANIZATIONS_UPDATE, label: 'تعديل جمعية' },
      { permission: PERMISSIONS.ORGANIZATIONS_DELETE, label: 'حذف جمعية' },
      { permission: PERMISSIONS.MEMBERS_UPDATE, label: 'تعديل أعضاء الهيئة' },
      {
        permission: PERMISSIONS.ORGANIZATIONS_IMPORT,
        label: 'استيراد من ملف',
        description: 'رفع ملف إكسل لإضافة الجمعيات أو الأعضاء دفعة واحدة.'
      },
      {
        permission: PERMISSIONS.ORGANIZATIONS_EXPORT,
        label: 'تصدير السجل',
        description: 'تنزيل جدول الجمعيات كملف إكسل، وتنزيل قوالب الاستيراد.'
      }
    ]
  },
  {
    key: 'correspondences',
    label: 'المراسلات',
    permissions: [
      { permission: PERMISSIONS.CORRESPONDENCES_READ, label: 'عرض المراسلات' },
      { permission: PERMISSIONS.CORRESPONDENCES_CREATE, label: 'إضافة مراسلة' },
      { permission: PERMISSIONS.CORRESPONDENCES_UPDATE, label: 'تعديل مراسلة' },
      { permission: PERMISSIONS.CORRESPONDENCES_DELETE, label: 'حذف مراسلة' }
    ]
  },
  {
    key: 'reports',
    label: 'التقارير',
    permissions: [
      {
        permission: PERMISSIONS.REPORTS_VIEW,
        label: 'عرض التقارير',
        description: 'فتح صفحة التقارير وتشغيل التقرير على الشاشة دون تنزيله.'
      },
      {
        permission: PERMISSIONS.REPORTS_EXPORT_PDF,
        label: 'تنزيل PDF',
        description: 'إخراج التقرير كملف PDF قابل للطباعة والمشاركة.'
      },
      {
        permission: PERMISSIONS.REPORTS_EXPORT_EXCEL,
        label: 'تنزيل إكسل',
        description: 'إخراج بيانات التقرير كملف إكسل.'
      },
      {
        permission: PERMISSIONS.REPORTS_TEMPLATE_MANAGE,
        label: 'إدارة قوالب التقارير',
        description: 'حفظ التقارير المعرّفة وتعديلها وحذفها للجميع.'
      }
    ]
  },
  {
    key: 'notifications',
    label: 'الإشعارات',
    permissions: [{ permission: PERMISSIONS.NOTIFICATIONS_READ, label: 'عرض الإشعارات' }]
  },
  {
    key: 'access',
    label: 'الصلاحيات',
    permissions: [
      {
        permission: PERMISSIONS.ACCESS_MANAGE,
        label: 'إدارة الأدوار والصلاحيات',
        description: 'إنشاء الأدوار وتعديل صلاحياتها وإسنادها للمستخدمين.'
      }
    ]
  }
];

/** Arabic label for a single permission, falling back to the raw key. */
export function permissionLabel(permission: string): string {
  for (const group of PERMISSION_GROUPS) {
    const entry = group.permissions.find((item) => item.permission === permission);
    if (entry) return entry.label;
  }
  return permission;
}

/**
 * The roles created on first migration, and restored if deleted.
 *
 * These are seeds, not hard-coded behaviour: an administrator can retick any of
 * them afterwards and the application follows, because nothing checks a role
 * name. `admin` is the exception marked `isSystem` — see the schema comment for
 * why one role has to be undeletable.
 */
export type RolePreset = {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
};

const READ_ONLY: Permission[] = [
  PERMISSIONS.ORGANIZATIONS_READ,
  PERMISSIONS.CORRESPONDENCES_READ,
  PERMISSIONS.NOTIFICATIONS_READ
];

export const ROLE_PRESETS: RolePreset[] = [
  {
    key: 'admin',
    name: 'مدير النظام',
    description: 'صلاحية كاملة على السجل والتقارير وإدارة المستخدمين.',
    isSystem: true,
    permissions: [...ALL_PERMISSIONS]
  },
  {
    key: 'editor',
    name: 'محرّر',
    description: 'إدخال وتعديل بيانات السجل والمراسلات، دون إدارة الصلاحيات.',
    isSystem: false,
    permissions: [
      ...READ_ONLY,
      PERMISSIONS.ORGANIZATIONS_CREATE,
      PERMISSIONS.ORGANIZATIONS_UPDATE,
      PERMISSIONS.ORGANIZATIONS_DELETE,
      PERMISSIONS.ORGANIZATIONS_IMPORT,
      PERMISSIONS.ORGANIZATIONS_EXPORT,
      PERMISSIONS.MEMBERS_UPDATE,
      PERMISSIONS.CORRESPONDENCES_CREATE,
      PERMISSIONS.CORRESPONDENCES_UPDATE,
      PERMISSIONS.CORRESPONDENCES_DELETE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT_PDF,
      PERMISSIONS.REPORTS_EXPORT_EXCEL,
      PERMISSIONS.REPORTS_TEMPLATE_MANAGE
    ]
  },
  {
    key: 'reporter',
    name: 'مسؤول التقارير',
    description: 'اطّلاع على البيانات مع صلاحية إخراج التقارير وتنزيلها.',
    isSystem: false,
    permissions: [
      ...READ_ONLY,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT_PDF,
      PERMISSIONS.REPORTS_EXPORT_EXCEL,
      PERMISSIONS.ORGANIZATIONS_EXPORT
    ]
  },
  {
    key: 'viewer',
    name: 'مطّلع',
    description: 'اطّلاع فقط: لا إضافة ولا تعديل ولا تنزيل.',
    isSystem: false,
    permissions: [...READ_ONLY]
  }
];
