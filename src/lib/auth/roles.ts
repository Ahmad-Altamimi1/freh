import type { User } from '@supabase/supabase-js';

/**
 * Role and permission reads for a Supabase user.
 *
 * Both live in `app_metadata`, which — unlike `user_metadata` — cannot be
 * written by the user's own session. It is only settable with the service role
 * key (see `createAdminClient`) or from a Postgres trigger, which is what makes
 * it safe to base authorization on.
 *
 * The role vocabulary is intentionally open (plain strings). Define whatever
 * roles the business needs later and set them on users via the admin API; no
 * change is needed here.
 */

type AppMetadata = {
  role?: unknown;
  roles?: unknown;
  permissions?: unknown;
};

function readAppMetadata(user: User | null | undefined): AppMetadata {
  return (user?.app_metadata ?? {}) as AppMetadata;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string');
  return [];
}

/** Every role on the user, merging the singular `role` and plural `roles` keys. */
export function getUserRoles(user: User | null | undefined): string[] {
  const metadata = readAppMetadata(user);
  return [...new Set([...toStringArray(metadata.role), ...toStringArray(metadata.roles)])];
}

/** Every permission string on the user. */
export function getUserPermissions(user: User | null | undefined): string[] {
  return toStringArray(readAppMetadata(user).permissions);
}

export function hasRole(user: User | null | undefined, role: string): boolean {
  return getUserRoles(user).includes(role);
}

export function hasAnyRole(user: User | null | undefined, roles: string[]): boolean {
  if (roles.length === 0) return true;
  const userRoles = getUserRoles(user);
  return roles.some((role) => userRoles.includes(role));
}

export function hasPermission(user: User | null | undefined, permission: string): boolean {
  return getUserPermissions(user).includes(permission);
}

/** Access rules a navigation item or page can declare. All listed rules must pass. */
export type AccessCheck = {
  /** User must hold at least one of these roles. */
  anyRole?: string[];
  /** User must hold every one of these permissions. */
  permissions?: string[];
};

export function satisfiesAccess(user: User | null | undefined, access?: AccessCheck): boolean {
  if (!access) return true;
  if (!user) return false;
  if (access.anyRole && !hasAnyRole(user, access.anyRole)) return false;
  if (access.permissions?.some((permission) => !hasPermission(user, permission))) return false;
  return true;
}
