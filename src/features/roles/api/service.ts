'use server';

import { asc, count, desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { rolePermissions, roles as rolesTable, userRoles } from '@/db/schema';
import { auditLog } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/access';
import { ALL_PERMISSIONS, isPermission, PERMISSIONS } from '@/lib/auth/permissions';
import type { Permission } from '@/lib/auth/permissions';
import { ROLE_SERVICE_ERRORS } from '../constants/labels';
import type { Role, RoleMutationPayload } from './types';

// ============================================================
// Roles Service — Data Access Layer
// ============================================================
// Server Actions + Drizzle over `roles` / `role_permissions` / `user_roles`.
//
// `'use server'` makes every export a POST endpoint, so each one asserts
// `access:manage` for itself — including the reads. Listing which role grants
// what is a map of the authorization model, which is not information to hand to
// anyone who happens to be signed in.
//
// Editing roles is editing the authorization system from inside it, so two
// invariants are enforced here rather than trusted to the UI:
//
//   1. The system role cannot be renamed away from its purpose, stripped, or
//      deleted. It is the recovery path if every other role loses
//      `access:manage`.
//   2. You cannot remove your own `access:manage`. That is the one edit whose
//      failure mode is locking yourself out of the screen you would need to
//      undo it.
// ============================================================

/** Role keys are machine identifiers: lowercase ASCII, digits, `_` and `-`. */
const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505';

/** Keeps only permissions still in the catalog, de-duplicated. */
function sanitizePermissions(input: string[]): Permission[] {
  return [...new Set(input.filter(isPermission))];
}

/**
 * Assembles roles with their permissions and member counts.
 *
 * Three queries rather than one join: a role's permissions and its holders are
 * independent one-to-many relations, and joining both at once multiplies them
 * into a cross product that has to be de-duplicated in application code
 * anyway. At the scale of a role list — a handful of rows — three indexed reads
 * are cheaper and considerably easier to read.
 */
async function loadRoles(where?: ReturnType<typeof eq>): Promise<Role[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(rolesTable)
    .where(where)
    // System role first — it is the one every other role is understood against,
    // and the one an administrator looks for when recovering access.
    .orderBy(desc(rolesTable.isSystem), asc(rolesTable.name));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [permissionRows, memberRows] = await Promise.all([
    db
      .select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, ids)),
    db
      .select({ roleId: userRoles.roleId, total: count() })
      .from(userRoles)
      .where(inArray(userRoles.roleId, ids))
      .groupBy(userRoles.roleId)
  ]);

  const permissionsByRole = new Map<string, Permission[]>();
  for (const row of permissionRows) {
    if (!isPermission(row.permission)) continue;
    const list = permissionsByRole.get(row.roleId);
    if (list) list.push(row.permission);
    else permissionsByRole.set(row.roleId, [row.permission]);
  }

  const membersByRole = new Map(memberRows.map((row) => [row.roleId, row.total]));

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    // Derived for the system role, exactly as permission resolution derives it —
    // so the editor shows what is actually in force rather than stored rows that
    // would go stale the moment a permission is added to the catalog.
    permissions: row.isSystem ? [...ALL_PERMISSIONS] : (permissionsByRole.get(row.id) ?? []),
    memberCount: membersByRole.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

export async function getRoles(): Promise<Role[]> {
  await requirePermission(PERMISSIONS.ACCESS_MANAGE, ROLE_SERVICE_ERRORS.forbidden);
  return loadRoles();
}

export async function getRoleById(id: string): Promise<Role | null> {
  await requirePermission(PERMISSIONS.ACCESS_MANAGE, ROLE_SERVICE_ERRORS.forbidden);
  const [role] = await loadRoles(eq(rolesTable.id, id));
  return role ?? null;
}

export async function createRole(payload: RoleMutationPayload): Promise<Role> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE, ROLE_SERVICE_ERRORS.forbidden);

  const key = payload.key.trim().toLowerCase();
  const name = payload.name.trim();

  if (!ROLE_KEY_PATTERN.test(key)) throw new Error(ROLE_SERVICE_ERRORS.invalidKey);
  if (!name) throw new Error(ROLE_SERVICE_ERRORS.nameRequired);

  const permissions = sanitizePermissions(payload.permissions);
  const db = getDb();

  let created;
  try {
    [created] = await db
      .insert(rolesTable)
      .values({
        key,
        name,
        description: payload.description.trim() || null,
        // Never settable from a payload: the system role is a property of the
        // installation, and a second one would defeat the invariant that
        // exactly one role can always reach this screen.
        isSystem: false
      })
      .returning();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      throw new Error(ROLE_SERVICE_ERRORS.duplicateKey, { cause: error });
    }
    throw error;
  }

  if (permissions.length > 0) {
    await db
      .insert(rolePermissions)
      .values(permissions.map((permission) => ({ roleId: created.id, permission })));
  }

  await auditLog({
    action: 'CREATE',
    entityType: 'role',
    entityId: created.id,
    actor: { id: actor.id, email: actor.email, type: 'user' },
    metadata: { key, name, permissionCount: permissions.length }
  });

  const [role] = await loadRoles(eq(rolesTable.id, created.id));
  return role;
}

export async function updateRole(id: string, payload: RoleMutationPayload): Promise<Role> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE, ROLE_SERVICE_ERRORS.forbidden);

  const db = getDb();
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!existing) throw new Error(ROLE_SERVICE_ERRORS.notFound);

  const name = payload.name.trim();
  if (!name) throw new Error(ROLE_SERVICE_ERRORS.nameRequired);

  // The system role may be renamed and re-described — that is cosmetic — but its
  // permissions are derived, not stored, so there is nothing to write and no
  // way to weaken it. Refusing the edit outright is clearer than silently
  // ignoring half of it.
  const permissions = sanitizePermissions(payload.permissions);
  if (existing.isSystem && permissions.length !== ALL_PERMISSIONS.length) {
    throw new Error(ROLE_SERVICE_ERRORS.systemRoleLocked);
  }

  if (!existing.isSystem) {
    await assertNotRevokingOwnAccess(id, actor.id, permissions);
  }

  await db
    .update(rolesTable)
    .set({ name, description: payload.description.trim() || null, updatedAt: new Date() })
    .where(eq(rolesTable.id, id));

  if (!existing.isSystem) {
    // Replace rather than diff: the form submits the complete intended set, and
    // a delete-then-insert is one round trip each with no chance of a stale
    // permission surviving because it was missing from a computed diff.
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    if (permissions.length > 0) {
      await db
        .insert(rolePermissions)
        .values(permissions.map((permission) => ({ roleId: id, permission })));
    }
  }

  await auditLog({
    action: 'UPDATE',
    entityType: 'role',
    entityId: id,
    actor: { id: actor.id, email: actor.email, type: 'user' },
    metadata: { key: existing.key, name, permissionCount: permissions.length }
  });

  const [role] = await loadRoles(eq(rolesTable.id, id));
  return role;
}

export async function deleteRole(id: string): Promise<{ id: string }> {
  const actor = await requirePermission(PERMISSIONS.ACCESS_MANAGE, ROLE_SERVICE_ERRORS.forbidden);

  const db = getDb();
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!existing) throw new Error(ROLE_SERVICE_ERRORS.notFound);
  if (existing.isSystem) throw new Error(ROLE_SERVICE_ERRORS.systemRoleUndeletable);

  // Deleting a role you hold is fine — unless it is what grants you this screen.
  await assertNotRevokingOwnAccess(id, actor.id, []);

  const [{ total }] = await db
    .select({ total: count() })
    .from(userRoles)
    .where(eq(userRoles.roleId, id));

  // `user_roles.role_id` cascades, so this would silently strip the role from
  // its holders. Refusing while anyone still holds it makes the consequence a
  // decision rather than a surprise: unassign them first.
  if (total > 0) throw new Error(ROLE_SERVICE_ERRORS.roleInUse(total));

  await db.delete(rolesTable).where(eq(rolesTable.id, id));

  await auditLog({
    action: 'DELETE',
    entityType: 'role',
    entityId: id,
    actor: { id: actor.id, email: actor.email, type: 'user' },
    metadata: { key: existing.key, name: existing.name }
  });

  return { id };
}

/**
 * Refuses an edit that would strip the actor's own `access:manage`.
 *
 * Recomputes what the actor would hold *after* the change: they keep the
 * permission if any of their other roles grants it, or if one of them is the
 * system role. Only when this role is their last route to the screen is the
 * edit refused — the check is about not being locked out, not about protecting
 * any particular role.
 */
async function assertNotRevokingOwnAccess(
  roleId: string,
  actorId: string,
  nextPermissions: Permission[]
): Promise<void> {
  if (nextPermissions.includes(PERMISSIONS.ACCESS_MANAGE)) return;

  const held = await getDb()
    .select({
      roleId: rolesTable.id,
      isSystem: rolesTable.isSystem,
      permission: rolePermissions.permission
    })
    .from(userRoles)
    .innerJoin(rolesTable, eq(rolesTable.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, rolesTable.id))
    .where(eq(userRoles.userId, actorId));

  // Not held by the actor at all — the edit cannot affect their own access.
  if (!held.some((row) => row.roleId === roleId)) return;

  const keepsAccess = held.some(
    (row) => row.roleId !== roleId && (row.isSystem || row.permission === PERMISSIONS.ACCESS_MANAGE)
  );

  if (!keepsAccess) throw new Error(ROLE_SERVICE_ERRORS.selfLockout);
}
