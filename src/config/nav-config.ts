import { NavGroup } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 *
 * RBAC Access Control:
 * An item's optional `access` property controls visibility. Permissions are
 * resolved from the roles a user holds in the database — see
 * `@/lib/auth/permissions` for the catalog and `docs/rbac.md` for the whole
 * system. Prefer `permissions` over `anyRole`: a role name is a moving target
 * an administrator can rename or retire, a permission is the capability itself.
 *
 * Examples:
 *
 * 1. Restrict to one or more roles (any match passes):
 *    access: { anyRole: ['admin'] }
 *
 * 2. Require specific permissions (all must be held):
 *    access: { permissions: ['reports:read'] }
 *
 * 3. Both (all rules must pass):
 *    access: { anyRole: ['admin', 'manager'], permissions: ['reports:read'] }
 *
 * Hiding a link is a UX affordance, not a security boundary — always repeat
 * the check server-side on the page it points at.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'السجل',
    items: [
      {
        title: 'لوحة التحكم',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'الجمعيات',
        url: '/dashboard/organizations',
        icon: 'building',
        isActive: false,
        shortcut: ['o', 'o'],
        access: { permissions: ['organizations:read'] },
        items: []
      },
      {
        title: 'الإشعارات',
        url: '/dashboard/notifications',
        icon: 'notification',
        isActive: false,
        shortcut: ['n', 'n'],
        access: { permissions: ['notifications:read'] },
        items: []
      },
      {
        title: 'التقارير',
        url: '/dashboard/organizations/reports',
        icon: 'report',
        isActive: false,
        shortcut: ['r', 'r'],
        access: { permissions: ['reports:view'] },
        items: []
      },
      {
        title: 'المراسلات',
        url: '/dashboard/correspondences',
        icon: 'mail',
        isActive: false,
        shortcut: ['m', 'c'],
        access: { permissions: ['correspondences:read'] },
        items: []
      },
      {
        title: 'المستخدمون',
        url: '/dashboard/users',
        icon: 'teams',
        isActive: false,
        shortcut: ['u', 'u'],
        access: { permissions: ['access:manage'] },
        items: []
      },
      {
        title: 'الأدوار والصلاحيات',
        url: '/dashboard/settings/roles',
        icon: 'settings',
        isActive: false,
        shortcut: ['s', 'r'],
        access: { permissions: ['access:manage'] },
        items: []
      }
    ]
  }
];
