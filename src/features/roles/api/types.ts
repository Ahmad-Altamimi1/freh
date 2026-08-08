import type { Permission } from '@/lib/auth/permissions';

// ============================================================
// Roles Feature — Types
// ============================================================
// A role is a named bundle of permissions, stored in `roles` +
// `role_permissions` (see `src/db/schema/access-control.ts`). The permission
// vocabulary itself is a closed set defined in `@/lib/auth/permissions` — this
// feature edits which of them a role holds, never what permissions exist.
// ============================================================

export type Role = {
  id: string;
  /** Stable machine identity, immutable after creation. */
  key: string;
  /** Arabic display name, freely editable. */
  name: string;
  description: string | null;
  /**
   * The undeletable all-permissions role. Its permission list is derived rather
   * than stored, so the editor renders it fully ticked and read-only.
   */
  isSystem: boolean;
  permissions: Permission[];
  /** How many users currently hold it — shown so deleting is an informed choice. */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RoleMutationPayload = {
  /** Only read on create; renaming the key of an existing role is not offered. */
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
};
