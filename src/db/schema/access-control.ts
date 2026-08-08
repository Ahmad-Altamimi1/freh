import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

/**
 * Role-based access control: roles, the permissions each grants, and who holds
 * which role.
 *
 * Why these live in the database rather than in Supabase `app_metadata`:
 *
 *  - **Runtime CRUD.** `app_metadata` can hold a role *name*, but there is
 *    nowhere in it to define what a role means. Storing the definition here is
 *    what makes "create a role and tick its permissions" a screen instead of a
 *    deploy.
 *
 *  - **Immediate effect.** `app_metadata` is baked into the user's JWT, so a
 *    permission change only lands after a token refresh — a revoked permission
 *    would keep working for up to an hour. Permissions resolved from these
 *    tables take effect on the user's very next request.
 *
 *  - **Auditability.** `user_roles.granted_by`/`granted_at` record who gave
 *    whom access and when, which a metadata blob cannot.
 *
 * `app_metadata.role` is still read, but only as a bootstrap: see
 * `resolvePermissions()` in `@/lib/auth/permissions-resolver`.
 */

/**
 * A named bundle of permissions.
 *
 * `key` is the stable machine identity (`admin`, `editor`) and never changes;
 * `name` is the Arabic display label and is freely editable. Splitting them
 * means renaming "محرّر" to "مدخل بيانات" cannot break the seed logic that
 * looks a preset up by key.
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Stable identifier, lowercase ASCII. Unique, and immutable after insert. */
    key: text('key').notNull(),

    /** Arabic display name, shown everywhere in the UI. */
    name: text('name').notNull(),

    description: text('description'),

    /**
     * Marks a role the application refuses to delete or strip permissions from.
     *
     * Exactly one role (`admin`) carries this. Without it, an administrator can
     * remove `access:manage` from the only role that has it — or delete that
     * role — and lock every user out of the permission screen permanently, with
     * no way back except a manual SQL statement. A single undeletable
     * all-permissions role is the recovery path.
     */
    isSystem: boolean('is_system').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex('roles_key_key').on(table.key)]
);

/**
 * The permissions a role grants — one row per permission held.
 *
 * A row-per-permission rather than a `text[]` or JSONB column: it makes
 * "which roles grant reports:export:pdf" an index lookup rather than a scan of
 * every array, and it lets the composite primary key enforce that a role cannot
 * hold the same permission twice.
 *
 * `permission` is plain `text`, not a pg enum. The catalog in
 * `@/lib/auth/permissions` is the authority, and an enum would make adding a
 * permission a migration; unknown strings are filtered out on read by
 * `isPermission()`, so a retired permission stops granting anything without
 * needing one either.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    /** A `Permission` from `@/lib/auth/permissions`. Validated on read. */
    permission: text('permission').notNull()
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permission] }),
    index('role_permissions_permission_idx').on(table.permission)
  ]
);

/**
 * Which roles a user holds. Many-to-many — a user can be both `editor` and
 * `reporter`, and their effective permissions are the union.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    /**
     * Supabase `auth.users.id`. Plain column, no `.references()` — `auth.users`
     * lives outside drizzle-kit's `schemaFilter: ['public']`, so there is no
     * Drizzle table to reference. Same reasoning as `notifications.recipientId`.
     *
     * A deleted Supabase user therefore leaves an orphan row here. Harmless: it
     * is keyed by a user id that can never sign in again, and the users screen
     * lists from Supabase rather than from this table, so it is never rendered.
     */
    userId: uuid('user_id').notNull(),

    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    /** Who granted it — `auth.users.id` again, nullable for seeded assignments. */
    grantedBy: uuid('granted_by'),

    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index('user_roles_user_id_idx').on(table.userId),
    index('user_roles_role_id_idx').on(table.roleId)
  ]
);

export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type UserRoleRow = typeof userRoles.$inferSelect;
