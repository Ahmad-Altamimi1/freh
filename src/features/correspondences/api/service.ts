'use server';

import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';

import { getDb } from '@/db';
import { correspondences } from '@/db/schema/correspondences';
import { organizations } from '@/db/schema/organizations';
import { normalizeArabic } from '@/lib/arabic';
import { auditLog } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { buildFilterWhere, escapeLike, type FilterableColumns } from '@/lib/filter-columns';
import { deletePrivateFile, getSignedFileUrl, uploadPrivateFile } from '@/lib/storage';
import {
  CORRESPONDENCE_ALLOWED_MIME_TYPES,
  CORRESPONDENCE_MAX_FILE_SIZE_BYTES
} from '../constants/upload';
import { correspondenceFormSchema } from '../schemas/correspondence';
import type {
  CorrespondenceFacets,
  CorrespondenceFile,
  CorrespondenceFilters,
  CorrespondencesResponse,
  CorrespondenceWithFiles
} from './types';

// ============================================================
// Correspondences Service — Data Access Layer
// ============================================================
// Server Actions + Drizzle. This is the only file in the feature that touches
// the database; `queries.ts` and every component import from here.
//
// Two rules hold throughout:
//   1. `requirePermission()` runs before every export, naming the specific
//      capability it needs — create, update and delete are separately
//      grantable. `'use server'` makes every export here reachable as a POST
//      endpoint, so hiding a button in the UI guards nothing — this is the
//      check that does.
//   2. Filtering, counting and sorting all happen in Postgres behind one
//      shared `WHERE`, built once in `buildWhere()`.
// ============================================================

/** Columns the advanced filter is allowed to reach. */
const FILTERABLE_COLUMNS: FilterableColumns = {
  name: correspondences.name,
  type: correspondences.type,
  organizationId: correspondences.organizationId,
  createdAt: correspondences.createdAt
};

/**
 * Columns the table is allowed to sort by. Diverges from `FILTERABLE_COLUMNS`
 * on `organizationId`: sorting "by organization" should order alphabetically
 * by the joined name, not by an opaque UUID. Filtering still targets the raw
 * FK column — that's what the facets' option values are.
 */
const SORTABLE_COLUMNS: FilterableColumns = {
  ...FILTERABLE_COLUMNS,
  organizationId: organizations.name
};

/** The public column list, including the organization name every read joins in. */
const SELECT_COLUMNS = {
  id: correspondences.id,
  name: correspondences.name,
  type: correspondences.type,
  organizationId: correspondences.organizationId,
  organizationName: organizations.name,
  files: correspondences.files,
  createdAt: correspondences.createdAt,
  updatedAt: correspondences.updatedAt
};

/** The single predicate shared by the listing and the facets. */
function buildWhere(filters: CorrespondenceFilters): SQL | undefined {
  const conditions: SQL[] = [];

  const query = normalizeArabic(filters.q);
  if (query) {
    conditions.push(ilike(correspondences.searchKey, `%${escapeLike(query)}%`));
  }

  const advanced = buildFilterWhere({
    columns: FILTERABLE_COLUMNS,
    filters: filters.filters ?? [],
    joinOperator: filters.joinOperator ?? 'and'
  });
  if (advanced) conditions.push(advanced);

  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function buildOrderBy(filters: CorrespondenceFilters) {
  const sorting = filters.sort ?? [];

  const clauses = sorting
    .map((item) => {
      const column = SORTABLE_COLUMNS[item.id as string];
      if (!column) return undefined;
      return item.desc ? desc(column) : asc(column);
    })
    .filter((clause) => clause !== undefined);

  // A deterministic tiebreaker, same reasoning as organizations: without one,
  // Postgres may reorder rows between pages of an otherwise-equal sort.
  return clauses.length > 0
    ? [...clauses, asc(correspondences.id)]
    : [desc(correspondences.createdAt), asc(correspondences.id)];
}

export async function getCorrespondences(
  filters: CorrespondenceFilters
): Promise<CorrespondencesResponse> {
  await requirePermission(PERMISSIONS.CORRESPONDENCES_READ, NO_READ_ACCESS);

  const db = getDb();
  const where = buildWhere(filters);
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 10));

  const [rows, totals] = await Promise.all([
    db
      .select(SELECT_COLUMNS)
      .from(correspondences)
      .innerJoin(organizations, eq(correspondences.organizationId, organizations.id))
      .where(where)
      .orderBy(...buildOrderBy(filters))
      .limit(perPage)
      .offset((page - 1) * perPage),
    // No join needed here — every filterable column lives on `correspondences` itself.
    db.select({ value: count() }).from(correspondences).where(where)
  ]);

  const total = totals[0]?.value ?? 0;

  return {
    data: rows,
    total,
    pageCount: Math.ceil(total / perPage)
  };
}

export async function getCorrespondenceById(id: string): Promise<CorrespondenceWithFiles | null> {
  await requirePermission(PERMISSIONS.CORRESPONDENCES_READ, NO_READ_ACCESS);

  const [row] = await getDb()
    .select(SELECT_COLUMNS)
    .from(correspondences)
    .innerJoin(organizations, eq(correspondences.organizationId, organizations.id))
    .where(eq(correspondences.id, id))
    .limit(1);

  if (!row) return null;

  // Signed per-file rather than via the batched `getSignedFileUrls`, so each
  // can carry its own `downloadAs` — a download should be named after the
  // original file, not the random UUID storage path. One bad signature
  // shouldn't fail the whole page, so failures resolve to `null` rather than
  // rejecting.
  const files = await Promise.all(
    row.files.map(async (file) => ({
      ...file,
      url: await getSignedFileUrl(file.path, {
        expiresInSeconds: 300,
        downloadAs: file.originalName ?? undefined
      }).catch(() => null)
    }))
  );

  return { ...row, files };
}

/**
 * Every correspondence filed against one organization, newest first.
 *
 * Unpaginated by design — this backs the organization's profile document, which
 * is a complete file rather than a page of one. Files are returned unsigned:
 * the document lists what is attached, it does not link to it, and a signed URL
 * printed into a PDF would be a five-minute link on a page that outlives it.
 */
export async function getCorrespondencesByOrganization(organizationId: string) {
  await requirePermission(PERMISSIONS.CORRESPONDENCES_READ, NO_READ_ACCESS);

  return getDb()
    .select(SELECT_COLUMNS)
    .from(correspondences)
    .innerJoin(organizations, eq(correspondences.organizationId, organizations.id))
    .where(eq(correspondences.organizationId, organizationId))
    .orderBy(desc(correspondences.createdAt), asc(correspondences.id));
}

/**
 * Organizations that have at least one correspondence, with counts.
 *
 * Deliberately unfiltered — the picker should offer every organization that
 * appears in the log, not only those surviving whatever the table is
 * currently filtered to.
 */
export async function getCorrespondenceFacets(): Promise<CorrespondenceFacets> {
  await requirePermission(PERMISSIONS.CORRESPONDENCES_READ, NO_READ_ACCESS);

  const rows = await getDb()
    .select({ value: correspondences.organizationId, label: organizations.name, count: count() })
    .from(correspondences)
    .innerJoin(organizations, eq(correspondences.organizationId, organizations.id))
    .groupBy(correspondences.organizationId, organizations.name)
    .orderBy(desc(count()), asc(organizations.name));

  return { organizations: rows };
}

// ============================================================
// Writes
// ============================================================
// All three require the `admin` role.
//
// Writes accept `FormData`, not a typed object: a file cannot travel through a
// plain Server Action argument (React's `'use server'` serialization supports
// `FormData` instances, not bare `File`/`Blob`), and the same two working
// precedents already in this codebase for sending a file to a Server Action
// (organizations' own import flows) use exactly this transport.
// ============================================================

/** Postgres foreign-key violation. */
const FOREIGN_KEY_VIOLATION = '23503';

/** Shared refusal messages, so the same denial always reads the same. */
const NO_READ_ACCESS = 'غير مصرح لك بالاطلاع على المراسلات.';
const NO_WRITE_ACCESS = 'غير مصرح لك بتعديل المراسلات.';

/**
 * Rethrows a foreign-key violation as something a user can act on — this can
 * only happen if the selected organization was deleted or tampered with
 * between the form loading and submitting.
 */
function rethrowWriteError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if ((error as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
      throw new Error('الجهة المعنية المحددة غير موجودة.');
    }
  }
  throw error;
}

const scalarFieldsSchema = correspondenceFormSchema.pick({
  name: true,
  type: true,
  organizationId: true
});

/**
 * Re-validates the scalar fields server-side. `FormData` is stringly-typed at
 * the wire boundary — unlike a plain-object payload, nothing upstream of this
 * has already checked that `type` is one of the two allowed values.
 */
function readScalarFields(formData: FormData) {
  return scalarFieldsSchema.parse({
    name: formData.get('name'),
    type: formData.get('type'),
    organizationId: formData.get('organizationId')
  });
}

function readNewFiles(formData: FormData): File[] {
  return formData.getAll('files').filter((entry): entry is File => entry instanceof File);
}

async function uploadNewFiles(files: File[]): Promise<CorrespondenceFile[]> {
  return Promise.all(
    files.map(async (file) => {
      const stored = await uploadPrivateFile(file, {
        prefix: 'correspondences',
        allowedMimeTypes: CORRESPONDENCE_ALLOWED_MIME_TYPES,
        maxSizeBytes: CORRESPONDENCE_MAX_FILE_SIZE_BYTES
      });
      return { ...stored, uploadedAt: new Date().toISOString() };
    })
  );
}

/** Removes storage objects that are no longer referenced by any row. Logs, never throws. */
async function cleanupRemovedFiles(files: CorrespondenceFile[]): Promise<void> {
  if (files.length === 0) return;

  const results = await Promise.allSettled(files.map((file) => deletePrivateFile(file.path)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('[correspondences] failed to remove file', {
        path: files[index].path,
        error: result.reason
      });
    }
  });
}

export async function createCorrespondence(formData: FormData): Promise<{ id: string }> {
  const user = await requirePermission(PERMISSIONS.CORRESPONDENCES_CREATE, NO_WRITE_ACCESS);

  const fields = readScalarFields(formData);
  const uploaded = await uploadNewFiles(readNewFiles(formData));
  const nameNormalized = normalizeArabic(fields.name);

  try {
    const [created] = await getDb()
      .insert(correspondences)
      .values({
        name: fields.name,
        nameNormalized,
        type: fields.type,
        organizationId: fields.organizationId,
        files: uploaded,
        searchKey: nameNormalized
      })
      .returning({ id: correspondences.id, name: correspondences.name });

    await auditLog({
      action: 'CREATE',
      entityType: 'correspondence',
      entityId: created.id,
      actor: { id: user.id, email: user.email, type: 'user' },
      metadata: { name: created.name, filesCount: uploaded.length }
    });

    return { id: created.id };
  } catch (error) {
    rethrowWriteError(error);
  }
}

export async function updateCorrespondence(
  id: string,
  formData: FormData
): Promise<{ id: string }> {
  const user = await requirePermission(PERMISSIONS.CORRESPONDENCES_UPDATE, NO_WRITE_ACCESS);

  const fields = readScalarFields(formData);
  const retainedPaths = formData.getAll('retainedFilePaths').map(String);

  const db = getDb();
  const [existing] = await db
    .select({ files: correspondences.files })
    .from(correspondences)
    .where(eq(correspondences.id, id))
    .limit(1);

  if (!existing) throw new Error('المراسلة غير موجودة.');

  // Only the paths to keep come from the client — the files themselves are
  // re-read from this row, never trusted from client-supplied metadata.
  const retainedExisting = existing.files.filter((file) => retainedPaths.includes(file.path));
  const removedFiles = existing.files.filter((file) => !retainedPaths.includes(file.path));

  const uploaded = await uploadNewFiles(readNewFiles(formData));
  const finalFiles = [...retainedExisting, ...uploaded];
  const nameNormalized = normalizeArabic(fields.name);

  try {
    const [updated] = await db
      .update(correspondences)
      .set({
        name: fields.name,
        nameNormalized,
        type: fields.type,
        organizationId: fields.organizationId,
        files: finalFiles,
        searchKey: nameNormalized,
        updatedAt: new Date()
      })
      .where(eq(correspondences.id, id))
      .returning({ id: correspondences.id, name: correspondences.name });

    if (!updated) throw new Error('المراسلة غير موجودة.');

    await auditLog({
      action: 'UPDATE',
      entityType: 'correspondence',
      entityId: updated.id,
      actor: { id: user.id, email: user.email, type: 'user' },
      metadata: { name: updated.name, filesCount: finalFiles.length }
    });

    // Upload-then-update-then-delete-old ordering, same as `replacePrivateFile`:
    // a failed upload above left the previous files untouched, and a failed
    // delete here leaves an orphaned object rather than losing data.
    await cleanupRemovedFiles(removedFiles);

    return { id: updated.id };
  } catch (error) {
    rethrowWriteError(error);
  }
}

export async function deleteCorrespondence(id: string): Promise<{ id: string }> {
  const user = await requirePermission(PERMISSIONS.CORRESPONDENCES_DELETE, NO_WRITE_ACCESS);

  const [deleted] = await getDb()
    .delete(correspondences)
    .where(eq(correspondences.id, id))
    .returning({
      id: correspondences.id,
      name: correspondences.name,
      files: correspondences.files
    });

  if (!deleted) throw new Error('المراسلة غير موجودة.');

  await auditLog({
    action: 'DELETE',
    entityType: 'correspondence',
    entityId: deleted.id,
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: { name: deleted.name }
  });

  await cleanupRemovedFiles(deleted.files);

  return { id: deleted.id };
}
