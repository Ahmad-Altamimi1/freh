# Audit Logging

A storage-agnostic abstraction for recording who did what. It knows nothing about your entities and defines no schema — you connect it to a real table when you have one.

## Usage

```ts
import { auditLog } from '@/lib/audit';

await auditLog({
  action: 'UPDATE',
  entityType: 'some_entity',
  entityId,
  metadata: { changed: ['status'] }
});
```

`entityType` is a free-form string, not an enum — entities are defined by the business layer, not by this module.

## Actions

`CREATE`, `UPDATE`, `DELETE`, `IMAGE_UPLOAD`, `IMAGE_REPLACE`, `IMAGE_DELETE`, `LOGIN`, `LOGOUT` are recognised and autocompleted. Any other string is accepted, so `'EXPORT'` or `'ARCHIVE'` needs no change to the library.

## What is filled in automatically

| Field | Source |
| --- | --- |
| `actor` | The signed-in Supabase user, or `{ type: 'system' }` outside a request |
| `context.ip` | `x-forwarded-for` / `x-real-ip` |
| `context.userAgent` | `user-agent` |
| `context.requestId` | `x-request-id` |
| `occurredAt` | Now |

Pass `actor`, `context` or `occurredAt` explicitly to override — useful for backfills and for jobs acting on someone's behalf.

## Failure behaviour

`auditLog()` never throws. A sink that fails is reported to the console and swallowed, so a broken audit trail cannot roll back or break the operation being audited.

If your compliance model requires the opposite — the write fails when the audit fails — call your sink directly inside the same database transaction instead of going through `auditLog()`.

## Connecting it to a real table

Out of the box, events go to `consoleAuditSink`, which prints one structured line per event. That is useful immediately but is **not a durable audit trail**.

Once you have a schema, write a sink and register it:

```ts
// src/lib/audit/sinks/database.ts
import { getDb } from '@/db';
import { auditEvents } from '@/db/schema'; // your table
import type { AuditSink } from '../types';

export const databaseAuditSink: AuditSink = {
  name: 'database',
  async write(event) {
    await getDb().insert(auditEvents).values({
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actor.id,
      metadata: event.metadata,
      ip: event.context.ip,
      userAgent: event.context.userAgent,
      occurredAt: event.occurredAt
    });
  }
};
```

Register it once at startup — `src/instrumentation.ts` is the natural place:

```ts
import { setAuditSinks } from '@/lib/audit';
import { databaseAuditSink } from '@/lib/audit/sinks/database';

setAuditSinks([databaseAuditSink]);
```

`addAuditSink()` adds a destination alongside the existing ones instead of replacing them. With several sinks registered, one failing does not stop the others.

**No call site changes.** That is the point of the abstraction: the shape of `auditLog()` is fixed, and only the sink knows about your columns.

## Already instrumented

- `LOGIN` (success and failure) and `LOGOUT` — `src/features/auth/actions/auth-actions.ts`
- `IMAGE_UPLOAD`, `IMAGE_REPLACE`, `IMAGE_DELETE` — `src/lib/storage/`

Failed logins are recorded with the attempted email and `outcome: 'failure'`. The user-facing error stays deliberately generic so the sign-in form cannot be used to enumerate which emails have accounts.
