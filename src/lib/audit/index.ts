import { consoleAuditSink } from './sinks/console';
import type { AuditContext, AuditEvent, AuditLogInput, AuditSink } from './types';

export { AUDIT_ACTIONS } from './types';
export type {
  AuditAction,
  AuditActor,
  AuditContext,
  AuditEvent,
  AuditLogInput,
  AuditSink,
  KnownAuditAction
} from './types';

let sinks: AuditSink[] = [consoleAuditSink];

/**
 * Replaces the set of destinations audit events are written to.
 *
 * Call once during startup (e.g. from `instrumentation.ts`) after the real
 * schema exists:
 *
 *   setAuditSinks([drizzleAuditSink]);
 *
 * Passing several sinks writes to all of them; a failure in one does not stop
 * the others.
 */
export function setAuditSinks(next: AuditSink[]): void {
  sinks = next;
}

/** Adds a destination alongside the existing ones. */
export function addAuditSink(sink: AuditSink): void {
  sinks = [...sinks, sink];
}

/** The currently registered sinks, for tests and diagnostics. */
export function getAuditSinks(): readonly AuditSink[] {
  return sinks;
}

/**
 * Best-effort request provenance.
 *
 * Returns empty values outside a request scope (background jobs, scripts)
 * rather than throwing.
 */
async function captureRequestContext(): Promise<AuditContext> {
  try {
    const { headers } = await import('next/headers');
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    return {
      ip: forwardedFor?.split(',')[0]?.trim() ?? headerList.get('x-real-ip'),
      userAgent: headerList.get('user-agent'),
      requestId: headerList.get('x-request-id')
    };
  } catch {
    return {};
  }
}

/**
 * The signed-in user, if this is running inside an authenticated request.
 *
 * Resolved lazily and defensively — audit logging must never be the reason a
 * request fails.
 */
async function resolveActor(): Promise<AuditEvent['actor']> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return { id: null, type: 'anonymous' };
    return { id: user.id, email: user.email ?? null, type: 'user' };
  } catch {
    return { id: null, type: 'system' };
  }
}

/**
 * Records an audit event.
 *
 * Generic by design — it knows nothing about the entities in your domain:
 *
 *   await auditLog({
 *     action: 'UPDATE',
 *     entityType: 'some_entity',
 *     entityId,
 *     metadata: { changed: ['status'] }
 *   });
 *
 * Never throws. A failure to record an audit event must not roll back or break
 * the operation being audited, so errors are reported and swallowed. If your
 * compliance model requires the opposite — the write fails when the audit fails
 * — call your sink directly inside the same transaction instead.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  let event: AuditEvent;

  try {
    const [context, actor] = await Promise.all([
      captureRequestContext(),
      input.actor ? Promise.resolve(input.actor) : resolveActor()
    ]);

    event = {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      actor,
      context: { ...context, ...input.context },
      occurredAt: input.occurredAt ?? new Date()
    };
  } catch (error) {
    console.error('[audit] failed to build event', { action: input.action, error });
    return;
  }

  await Promise.all(
    sinks.map(async (sink) => {
      try {
        await sink.write(event);
      } catch (error) {
        console.error(`[audit] sink "${sink.name}" failed`, { action: event.action, error });
      }
    })
  );
}
