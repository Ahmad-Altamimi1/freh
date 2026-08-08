import { USER_STATUS_LABELS } from '../../constants/labels';

/**
 * Status is derived from the auth record, not stored.
 *
 * `Invited` is read-only — it means the account has never been confirmed or
 * signed in, so the form only ever writes the other two. The values stay in
 * English because that is what the service compares against; only the label is
 * Arabic.
 *
 * There is no static role list to sit alongside this: roles are rows in the
 * `roles` table, editable at runtime, and come from `assignableRolesQueryOptions`.
 */
export const STATUS_OPTIONS = [
  { value: 'Active', label: USER_STATUS_LABELS.Active },
  { value: 'Inactive', label: USER_STATUS_LABELS.Inactive }
];
