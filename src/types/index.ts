import { Icons } from '@/components/icons';

/**
 * Visibility rules for a navigation item. All declared rules must pass.
 *
 * Roles and permissions come from the Supabase user's `app_metadata` — see
 * `@/lib/auth/roles`. Leave `access` off entirely for items everyone can see.
 */
export interface PermissionCheck {
  /** User must hold at least one of these roles. */
  anyRole?: string[];
  /** User must hold every one of these permissions. */
  permissions?: string[];
}

export interface NavItem {
  title: string;
  url: string;
  disabled?: boolean;
  external?: boolean;
  shortcut?: [string, string];
  icon?: keyof typeof Icons;
  label?: string;
  description?: string;
  isActive?: boolean;
  items?: NavItem[];
  access?: PermissionCheck;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

export interface FooterItem {
  title: string;
  items: {
    title: string;
    href: string;
    external?: boolean;
  }[];
}

export type MainNavItem = NavItemWithOptionalChildren;

export type SidebarNavItem = NavItemWithChildren;
