import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { eq, or } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

import { getDb } from '@/db';
import { rolePermissions, roles, userRoles } from '@/db/schema';
import { ALL_PERMISSIONS, isPermission, type Permission } from './permissions';
import { getUserRoles } from './roles';
import { getCurrentUser, requireUser } from './session';

/**
 * Resolving what a user is actually allowed to do.
 *
 * This module is the authorization boundary. Everything else — nav filtering,
 * `canEdit` props, disabled buttons — is presentation derived from it, and none
 * of it is trusted.
 *
 * Permissions come from the database (`user_roles` → `roles` →
 * `role_permissions`), not from the JWT. That is what makes a revoked
 * permission take effect on the user's next request instead of whenever their
 * token happens to refresh — see the comment on `src/db/schema/access-control.ts`.
 */

/** A user's resolved authorization state for the current request. */
export type EffectiveAccess = {
  /** Role keys held, e.g. `['editor', 'reporter']`. Display and nav only. */
  roles: string[];
  /** The union of every permission those roles grant. */
  permissions: Permission[];
  /** True when one of the held roles is the undeletable system role. */
  isSystemAdmin: boolean;
};

const EMPTY_ACCESS: EffectiveAccess = { roles: [], permissions: [], isSystemAdmin: false };

/**
 * Reads a user's roles and permissions from the database.
 *
 * One left-joined query rather than three round-trips: a user has a handful of
 * roles and a role a few dozen permissions, so the duplication across the join
 * is trivial next to the latency of separate queries on a serverless request.
 *
 * Wrapped in React `cache`, so the dashboard layout, the page, and every Server
 * Action in a single render share one lookup. The cache is per-request — it
 * never holds a stale grant across requests, which is the whole point of
 * resolving from the database rather than the token.
 */
const loadAccess = cache(async (userId: string): Promise<EffectiveAccess> => {
  const rows = await getDb()
    .select({
      roleKey: roles.key,
      isSystem: roles.isSystem,
      permission: rolePermissions.permission
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  if (rows.length === 0) return EMPTY_ACCESS;

  const roleKeys = new Set<string>();
  const granted = new Set<Permission>();
  let isSystemAdmin = false;

  for (const row of rows) {
    roleKeys.add(row.roleKey);
    if (row.isSystem) isSystemAdmin = true;
    // `permission` is NULL for a role with no permissions (the left join), and
    // is plain `text` — a permission retired from the catalog is dropped here
    // rather than kept as a string no check can ever match.
    if (row.permission && isPermission(row.permission)) granted.add(row.permission);
  }

  return {
    roles: [...roleKeys],
    // The system role's permissions are DERIVED, never stored — see the seed
    // migration. A new entry in the catalog is therefore held by the
    // administrator the moment it is added, with no migration and no drift.
    permissions: isSystemAdmin ? [...ALL_PERMISSIONS] : [...granted],
    isSystemAdmin
  };
});

/**
 * The effective access of the signed-in user, or empty when signed out.
 *
 * Falls back to `app_metadata.role === 'admin'` when the user holds no role in
 * the database at all. This is a bootstrap, not a second authorization path:
 * before this system existed, `app_metadata` was the only place a role lived,
 * and without this fallback deploying it would lock the existing administrators
 * out of the very screen that assigns database roles. Once any role is granted
 * through the UI the database is authoritative and the metadata is ignored.
 */
export const getEffectiveAccess = cache(async (): Promise<EffectiveAccess> => {
  const user = await getCurrentUser();
  if (!user) return EMPTY_ACCESS;

  const access = await loadAccess(user.id);
  if (access.roles.length > 0) return access;

  if (getUserRoles(user).includes('admin')) {
    return { roles: ['admin'], permissions: [...ALL_PERMISSIONS], isSystemAdmin: true };
  }

  return EMPTY_ACCESS;
});

/** The effective access of a specific user — for the access-control screens. */
export async function getAccessForUser(userId: string): Promise<EffectiveAccess> {
  return loadAccess(userId);
}

/**
 * Every user id holding `permission`, through any role.
 *
 * Used to address a broadcast — "who should be told a term is ending" — rather
 * than to authorize a request. Answering it from these tables is both cheaper
 * and more correct than paging the Supabase Admin API and reading
 * `app_metadata`: it costs one indexed query instead of an HTTP round-trip per
 * 200 users, and it follows a permission rather than a role name, so granting
 * the capability to a new role is enough to start including its holders.
 *
 * System-role holders always match, for the same derived reason as above.
 */
export async function listUserIdsWithPermission(permission: Permission): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(or(eq(roles.isSystem, true), eq(rolePermissions.permission, permission)));

  return rows.map((row) => row.userId);
}

/** Whether the signed-in user holds `permission`. */
export async function can(permission: Permission): Promise<boolean> {
  const { permissions } = await getEffectiveAccess();
  return permissions.includes(permission);
}

/** Whether the signed-in user holds every one of `permissions`. */
export async function canAll(permissions: Permission[]): Promise<boolean> {
  const access = await getEffectiveAccess();
  return permissions.every((permission) => access.permissions.includes(permission));
}

/** Whether the signed-in user holds at least one of `permissions`. */
export async function canAny(permissions: Permission[]): Promise<boolean> {
  const access = await getEffectiveAccess();
  return permissions.some((permission) => access.permissions.includes(permission));
}

/**
 * Thrown by `requirePermission`. Carries an Arabic message safe to surface.
 *
 * A distinct class so a route handler can map it to 403 rather than 500 without
 * string-matching the message.
 */
export class ForbiddenError extends Error {
  constructor(message = 'ليس لديك صلاحية للقيام بهذا الإجراء.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Asserts the signed-in user holds `permission`, or throws.
 *
 * This is the guard for Server Actions and Route Handlers. `'use server'` makes
 * every exported function a POST endpoint, so a hidden button guards nothing —
 * this is the check that does.
 */
export async function requirePermission(permission: Permission, message?: string): Promise<User> {
  const user = await requireUser();
  const { permissions } = await getEffectiveAccess();
  if (!permissions.includes(permission)) throw new ForbiddenError(message);
  return user;
}

/** Asserts the user holds every one of `permissions`, or throws. */
export async function requireAllPermissions(
  permissions: Permission[],
  message?: string
): Promise<User> {
  const user = await requireUser();
  const access = await getEffectiveAccess();
  for (const permission of permissions) {
    if (!access.permissions.includes(permission)) throw new ForbiddenError(message);
  }
  return user;
}

/**
 * Page-level guard: redirects instead of throwing.
 *
 * A Server Component that throws renders the error boundary, which is the wrong
 * experience for "you took a link you cannot open" — send the user somewhere
 * they can actually use.
 *
 * The default fallback, `/dashboard/overview`, must therefore stay reachable by
 * ANY signed-in user. Do not guard it with this function: an unauthorized user
 * would be redirected to it, and it would redirect them to itself, forever. That
 * page gates its *contents* by permission instead, which is the pattern to copy
 * for anything else that becomes a fallback target.
 */
export async function requirePagePermission(
  permission: Permission,
  fallback = '/dashboard/overview'
): Promise<User> {
  const user = await requireUser();
  const { permissions } = await getEffectiveAccess();
  if (!permissions.includes(permission)) redirect(fallback);
  return user;
}
