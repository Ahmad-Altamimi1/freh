/**
 * Audit logging contracts.
 *
 * Deliberately storage-agnostic: nothing here knows about a table, a column, or
 * any business entity. Wiring this to a real schema is a matter of writing one
 * sink (see `./sinks/`) and registering it — the call sites never change.
 */

/** Actions the audit system is expected to record out of the box. */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'IMAGE_UPLOAD',
  'IMAGE_REPLACE',
  'IMAGE_DELETE',
  'LOGIN',
  'LOGOUT'
] as const;

export type KnownAuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * A known action, or any other string.
 *
 * The `string & {}` arm keeps editor autocomplete for the known actions while
 * still allowing domain-specific ones (`'EXPORT'`, `'ARCHIVE'`, …) without
 * touching this file.
 */
// oxlint-disable-next-line ban-types -- `string & {}` is the idiom that preserves literal autocomplete
export type AuditAction = KnownAuditAction | (string & {});

/** Who performed the action. Resolved from the session when not supplied. */
export type AuditActor = {
  id: string | null;
  email?: string | null;
  /** 'user' for a signed-in person, 'system' for jobs, 'anonymous' when unknown. */
  type?: 'user' | 'system' | 'anonymous';
};

/** Best-effort request provenance. Populated automatically where available. */
export type AuditContext = {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

/** What a caller passes to `auditLog()`. */
export type AuditLogInput = {
  action: AuditAction;
  /**
   * The kind of thing acted on, as a stable string — e.g. 'invoice', 'file'.
   * Intentionally not an enum: entities are defined by the business layer.
   */
  entityType: string;
  /** Identifier of the affected record, when there is one. */
  entityId?: string | null;
  /** Arbitrary structured detail. Must be JSON-serialisable. */
  metadata?: Record<string, unknown>;
  /** Overrides the actor resolved from the current session. */
  actor?: AuditActor;
  /** Merged over the automatically captured request context. */
  context?: AuditContext;
  /** Defaults to now. Pass explicitly when backfilling. */
  occurredAt?: Date;
};

/** A fully resolved event as handed to a sink. */
export type AuditEvent = {
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  actor: AuditActor;
  context: AuditContext;
  occurredAt: Date;
};

/**
 * A destination for audit events.
 *
 * Implementations must not throw — `auditLog` isolates failures, but a sink
 * that swallows and reports its own errors gives far better diagnostics.
 */
export type AuditSink = {
  /** Used in diagnostics when a sink fails. */
  name: string;
  write(event: AuditEvent): Promise<void> | void;
};
