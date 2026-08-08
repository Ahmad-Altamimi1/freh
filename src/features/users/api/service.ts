'use server';

import type { User as AuthUser } from '@supabase/supabase-js';
import { asc, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { roles as rolesTable, userRoles } from '@/db/schema';
import { normalizeArabic } from '@/lib/arabic';
import { auditLog } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { USER_SERVICE_ERRORS } from '../constants/labels';
import type {
  RoleOption,
  User,
  UserFilters,
  UserMutationPayload,
  UserRole,
  UsersResponse,
  UserStatus
} from './types';

// ============================================================
// Users Service — Data Access Layer
// ============================================================
// Server Actions over two sources, joined here and nowhere else:
//
//   • Supabase Auth (`auth.users`) — identity: email, password, ban state,
//     sign-in history. Reached with the service role key, since nothing else
//     may read it. The list IS the auth directory rather than a mirrored
//     application table, so it cannot drift from who can actually sign in.
//
//   • Postgres (`user_roles` → `roles`) — authorization. Roles live here and
//     not in `app_metadata` because a metadata role is baked into the JWT and a
//     revocation would not land until the token refreshed; see
//     `src/db/schema/access-control.ts`.
//
// Every export is a POST endpoint by virtue of `'use server'`, so each one
// asserts `access:manage` for itself. Listing the directory exposes every
// account's email, so reads are gated exactly as writes are.
// ============================================================

/** Supabase caps `perPage` at 1000; ten pages is the ceiling we will scan. */
const ADMIN_PAGE_SIZE = 1000;
const MAX_ADMIN_PAGES = 10;

/** GoTrue expresses "banned indefinitely" as a duration, so: a century. */
const BAN_FOREVER = '876000h';
const BAN_NONE = 'none';

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Splits an auth user into first/last name.
 *
 * Supabase has no name columns: OAuth providers write `full_name` or `name`,
 * this feature's own form writes `first_name`/`last_name`, and a user created
 * from the Supabase dashboard has neither. All three cases have to render.
 */
function splitName(user: AuthUser): { first_name: string; last_name: string } {
  const metadata = user.user_metadata ?? {};

  const first = metadataString(metadata, 'first_name');
  const last = metadataString(metadata, 'last_name');
  if (first || last) return { first_name: first, last_name: last };

  const full = metadataString(metadata, 'full_name') || metadataString(metadata, 'name');
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first_name: user.email?.split('@')[0] ?? '', last_name: '' };
  }

  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function toStatus(user: AuthUser): UserStatus {
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    return 'Inactive';
  }
  if (!user.email_confirmed_at && !user.last_sign_in_at) return 'Invited';
  return 'Active';
}

/** Projects an auth record plus its granted roles into the shape the table renders. */
function toUser(user: AuthUser, granted: UserRole[]): User {
  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    ...splitName(user),
    email: user.email ?? '',
    phone: user.phone || metadataString(metadata, 'phone'),
    roles: granted,
    status: toStatus(user),
    last_sign_in_at: user.last_sign_in_at ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at
  };
}

/**
 * Every auth user, paged out of the admin API.
 *
 * `listUsers` offers no search, filter or sort, so the whole directory is
 * pulled and narrowed in memory below. That is fine at dashboard scale and
 * bounded by `MAX_ADMIN_PAGES`; past ten thousand accounts this wants a view
 * over `auth.users` with the predicate pushed into Postgres.
 */
async function listAllAuthUsers(): Promise<AuthUser[]> {
  const admin = createAdminClient();
  const all: AuthUser[] = [];

  for (let page = 1; page <= MAX_ADMIN_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: ADMIN_PAGE_SIZE
    });

    if (error) throw new Error(`${USER_SERVICE_ERRORS.loadFailed}: ${error.message}`);

    all.push(...data.users);
    if (data.users.length < ADMIN_PAGE_SIZE) break;
  }

  return all;
}

/**
 * Role grants for a set of users, as one query.
 *
 * A per-user lookup would be a round-trip per row; this is a single `IN` over a
 * table with an index on `user_id`.
 */
async function loadRolesByUser(userIds: string[]): Promise<Map<string, UserRole[]>> {
  const byUser = new Map<string, UserRole[]>();
  if (userIds.length === 0) return byUser;

  const rows = await getDb()
    .select({
      userId: userRoles.userId,
      key: rolesTable.key,
      name: rolesTable.name
    })
    .from(userRoles)
    .innerJoin(rolesTable, eq(rolesTable.id, userRoles.roleId))
    .where(inArray(userRoles.userId, userIds));

  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({ key: row.key, name: row.name });
    byUser.set(row.userId, list);
  }

  return byUser;
}

/** Free-text haystack for quick search, folded so Arabic names compare cleanly. */
function searchKey(user: User): string {
  return [
    normalizeArabic(`${user.first_name} ${user.last_name}`),
    normalizeArabic(user.email),
    ...user.roles.map((role) => normalizeArabic(role.name)),
    user.phone.replace(/\D/g, '')
  ]
    .filter(Boolean)
    .join(' ');
}

function sortValue(user: User, columnId: string): string | number {
  if (columnId === 'name') return normalizeArabic(`${user.first_name} ${user.last_name}`);

  const value = (user as unknown as Record<string, unknown>)[columnId];
  if (typeof value === 'number') return value;
  return String(value ?? '').toLowerCase();
}

function applySort(users: User[], sort: string | undefined): User[] {
  if (!sort) return users;

  let sortItems: { id: string; desc: boolean }[];
  try {
    sortItems = JSON.parse(sort);
  } catch {
    return users;
  }
  if (!Array.isArray(sortItems) || sortItems.length === 0) return users;

  const { id, desc } = sortItems[0];

  return users.toSorted((a, b) => {
    const aValue = sortValue(a, id);
    const bValue = sortValue(b, id);

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return desc ? bValue - aValue : aValue - bValue;
    }
    return desc
      ? String(bValue).localeCompare(String(aValue))
      : String(aValue).localeCompare(String(bValue));
  });
}

export async function getUsers(filters: UserFilters): Promise<UsersResponse> {
  await requirePermission(PERMISSIONS.ACCESS_MANAGE, USER_SERVICE_ERRORS.forbidden);

  const { page = 1, limit = 10, roles, search, sort } = filters;

  const authUsers = await listAllAuthUsers();
  const rolesByUser = await loadRolesByUser(authUsers.map((user) => user.id));

  let users = authUsers.map((user) => toUser(user, rolesByUser.get(user.id) ?? []));

  const roleFilter = roles ? String(roles).split(/[.,]/).filter(Boolean) : [];
  if (roleFilter.length > 0) {
    users = users.filter((user) => user.roles.some((role) => roleFilter.includes(role.key)));
  }

  if (search) {
    const needle = normalizeArabic(search);
    if (needle) users = users.filter((user) => searchKey(user).includes(needle));
  }

  users = applySort(users, sort);

  const offset = (page - 1) * limit;

  return {
    success: true,
    time: new Date().toISOString(),
    message: 'مستخدمو Supabase Auth',
    total_users: users.length,
    offset,
    limit,
    users: users.slice(offset, offset + limit)
  };
}

/**
 * The roles that can be assigned, for the filter and the form select.
 *
 * Read from the database rather than a constant: roles are created and renamed
 * from the access-control screens at runtime, so a hardcoded list would go
 * stale the first time someone adds one.
 */
export async function getAssignableRoles(): Promise<RoleOption[]> {
  await requirePermission(PERMISSIONS.ACCESS_MANAGE, USER_SERVICE_ERRORS.forbidden);

  const rows = await getDb()
    .select({ key: rolesTable.key, name: rolesTable.name })
    .from(rolesTable)
    .orderBy(asc(rolesTable.name));

  return rows.map((row) => ({ value: row.key, label: row.name }));
}

/**
 * Profile fields, written to `user_metadata`.
 *
 * `phone` goes here rather than into the auth `phone` column: that column is an
 * SMS sign-in identifier and setting it requires a phone provider, while this
 * field is a contact detail.
 */
function buildUserMetadata(data: UserMutationPayload) {
  const first = data.first_name.trim();
  const last = data.last_name.trim();

  return {
    first_name: first,
    last_name: last,
    full_name: `${first} ${last}`.trim(),
    phone: data.phone.trim()
  };
}

/**
 * Turns a role key into its id, or throws.
 *
 * Resolved *before* the auth user is touched, so an unknown key fails the whole
 * mutation instead of leaving a created account with no role behind it.
 */
async function resolveRoleId(roleKey: string): Promise<string | null> {
  if (!roleKey) return null;

  const [role] = await getDb()
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.key, roleKey))
    .limit(1);

  if (!role) throw new Error(USER_SERVICE_ERRORS.unknownRole);
  return role.id;
}

/**
 * Replaces every role grant for a user with the single selected one.
 *
 * The schema is many-to-many and `getEffectiveAccess` unions the permissions,
 * but this form assigns one role, so saving is a replace rather than an add —
 * otherwise clearing the select could never take a role away.
 */
async function setUserRole(
  userId: string,
  roleId: string | null,
  grantedBy: string
): Promise<void> {
  const db = getDb();

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  if (!roleId) return;

  await db.insert(userRoles).values({ userId, roleId, grantedBy });
}

/** The role keys a user holds, for the audit trail and the self-change guard. */
async function roleKeysFor(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ key: rolesTable.key })
    .from(userRoles)
    .innerJoin(rolesTable, eq(rolesTable.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => row.key);
}

export async function createUser(data: UserMutationPayload): Promise<User> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE, USER_SERVICE_ERRORS.forbidden);

  if (!data.password) {
    throw new Error(USER_SERVICE_ERRORS.passwordRequired);
  }

  const roleId = await resolveRoleId(data.role);

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email.trim(),
    password: data.password,
    // Admin-created accounts skip the confirmation email; the admin vouched for
    // the address by typing it. Drop this to make the user confirm it first.
    email_confirm: true,
    user_metadata: buildUserMetadata(data)
  });

  if (error || !created?.user) {
    throw new Error(error?.message ?? USER_SERVICE_ERRORS.createFailed);
  }

  if (data.status === 'Inactive') {
    await admin.auth.admin.updateUserById(created.user.id, { ban_duration: BAN_FOREVER });
  }

  await setUserRole(created.user.id, roleId, actor.id);

  await auditLog({
    action: 'CREATE',
    entityType: 'auth.user',
    entityId: created.user.id,
    actor: { id: actor.id, email: actor.email, type: 'user' },
    metadata: { email: created.user.email, role: data.role || null }
  });

  const granted = await loadRolesByUser([created.user.id]);
  return toUser(created.user, granted.get(created.user.id) ?? []);
}

export async function updateUser(id: string, data: UserMutationPayload): Promise<User> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE, USER_SERVICE_ERRORS.forbidden);

  const isSelf = id === actor.id;
  if (isSelf && data.status === 'Inactive') {
    throw new Error(USER_SERVICE_ERRORS.selfDeactivate);
  }

  const currentRoles = await roleKeysFor(id);

  // Changing your own role is the one edit that can lock you out of this very
  // screen — and out of every other screen that could grant it back.
  if (isSelf && (currentRoles[0] ?? '') !== data.role) {
    throw new Error(USER_SERVICE_ERRORS.selfRoleChange);
  }

  const roleId = await resolveRoleId(data.role);

  const admin = createAdminClient();
  const { data: updated, error } = await admin.auth.admin.updateUserById(id, {
    email: data.email.trim(),
    user_metadata: buildUserMetadata(data),
    // 'none' lifts an existing ban, so this one field covers both directions.
    ban_duration: data.status === 'Inactive' ? BAN_FOREVER : BAN_NONE,
    ...(data.password ? { password: data.password } : {})
  });

  if (error || !updated?.user) {
    throw new Error(error?.message ?? USER_SERVICE_ERRORS.updateFailed);
  }

  if (!isSelf) await setUserRole(id, roleId, actor.id);

  await auditLog({
    action: 'UPDATE',
    entityType: 'auth.user',
    entityId: updated.user.id,
    actor: { id: actor.id, email: actor.email, type: 'user' },
    metadata: {
      email: updated.user.email,
      roleBefore: currentRoles[0] ?? null,
      roleAfter: data.role || null,
      status: data.status,
      passwordChanged: Boolean(data.password)
    }
  });

  const granted = await loadRolesByUser([id]);
  return toUser(updated.user, granted.get(id) ?? []);
}

export async function deleteUser(id: string): Promise<{ id: string }> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE, USER_SERVICE_ERRORS.forbidden);

  if (id === actor.id) {
    throw new Error(USER_SERVICE_ERRORS.selfDelete);
  }

  const admin = createAdminClient();

  // Read first: the delete response carries no user, and the audit entry is
  // worth more with an email on it than with a bare UUID.
  const { data: existing } = await admin.auth.admin.getUserById(id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message || USER_SERVICE_ERRORS.deleteFailed);

  // `user_roles.user_id` has no FK to `auth.users` — that table is outside
  // drizzle's schema filter — so the grants have to be swept explicitly.
  await getDb().delete(userRoles).where(eq(userRoles.userId, id));

  await auditLog({
    action: 'DELETE',
    entityType: 'auth.user',
    entityId: id,
    actor: { id: actor.id, email: actor.email, type: 'user' },
    metadata: { email: existing?.user?.email ?? null }
  });

  return { id };
}
