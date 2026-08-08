// ============================================================
// Users Feature — Types
// ============================================================
// A "user" here is a Supabase Auth user (`auth.users`). There is no
// application-side users table: the id is the auth UUID, profile fields live in
// `user_metadata`, and roles come from `user_roles` → `roles` in Postgres (see
// `src/db/schema/access-control.ts`), not from `app_metadata`.
// ============================================================

/**
 * Derived from the auth record — not a stored column.
 *
 * `Inactive` means banned, `Invited` means the account exists but has never
 * been confirmed or signed in.
 */
export type UserStatus = 'Active' | 'Inactive' | 'Invited';

/** A role a user holds: the stable key, and the Arabic name shown in the UI. */
export type UserRole = {
  key: string;
  name: string;
};

export type User = {
  /** Supabase Auth UUID. */
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** Every role held. Many-to-many, so a user can hold none or several. */
  roles: UserRole[];
  status: UserStatus;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserFilters = {
  page?: number;
  limit?: number;
  roles?: string;
  search?: string;
  sort?: string;
};

export type UsersResponse = {
  success: boolean;
  time: string;
  message: string;
  total_users: number;
  offset: number;
  limit: number;
  users: User[];
};

/** A role as the table filter and the form select consume it. */
export type RoleOption = {
  value: string;
  label: string;
};

export type UserMutationPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** `roles.key`, or an empty string for a user who holds no role. */
  role: string;
  status: UserStatus;
  /**
   * Required on create — sign-in is email + password, so an admin-created
   * account needs an initial one. Optional on update, where a blank value
   * leaves the existing password untouched.
   */
  password?: string;
};
