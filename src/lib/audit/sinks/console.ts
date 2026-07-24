import type { AuditEvent, AuditSink } from '../types';

/**
 * Default sink: writes a single structured line per event.
 *
 * This exists so audit calls are useful before any table exists. It is not a
 * durable audit trail — replace it with a persistent sink before relying on
 * these records.
 */
export const consoleAuditSink: AuditSink = {
  name: 'console',
  write(event: AuditEvent) {
    const line = {
      type: 'audit',
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actor.id,
      actorType: event.actor.type,
      occurredAt: event.occurredAt.toISOString(),
      metadata: event.metadata,
      context: event.context
    };
    // oxlint-disable-next-line no-console -- structured audit output is the whole point of this sink
    console.info(JSON.stringify(line));
  }
};
