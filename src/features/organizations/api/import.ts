'use server';

import { sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { organizations } from '@/db/schema/organizations';
import { buildSearchKey, normalizeArabic } from '@/lib/arabic';
import { auditLog } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { organizationImportRowSchema } from '../schemas/organization';
import type { ImportIssue, ImportPreview, ImportResult } from './types';
import { parseOrganizationsWorkbook, REQUIRED_FIELDS, type ParsedRow } from './workbook';

/**
 * Excel import for the organizations registry.
 *
 * Both entry points require `organizations:import`. Hiding the import link in
 * the navigation is a UX affordance; because `'use server'` makes each export a
 * POST endpoint, this check is the only thing standing between any signed-in
 * user and a full table rewrite.
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** How many rows go into one INSERT. Keeps the parameter count well inside limits. */
const CHUNK_SIZE = 200;

async function requireImporter() {
  return requirePermission(PERMISSIONS.ORGANIZATIONS_IMPORT, 'غير مصرح لك باستيراد البيانات.');
}

/** Reads the uploaded file out of the form, rejecting anything unusable. */
async function readUpload(formData: FormData): Promise<{ file: File; buffer: ArrayBuffer }> {
  const file = formData.get('file');

  if (!(file instanceof File)) {
    throw new Error('لم يتم إرفاق أي ملف.');
  }
  if (file.size === 0) {
    throw new Error('الملف فارغ.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد المسموح (٥ ميغابايت).');
  }
  // Checked by extension as well as MIME: browsers report inconsistent types for
  // xlsx, and some send `application/octet-stream`.
  if (!file.name.toLowerCase().endsWith('.xlsx') && file.type !== XLSX_MIME) {
    throw new Error('صيغة الملف غير مدعومة — المطلوب ملف .xlsx');
  }

  return { file, buffer: await file.arrayBuffer() };
}

/**
 * Parses an upload and reports what would happen, writing nothing.
 *
 * Runs the same parser as the commit step, so the headers, mapping and sample
 * rows shown here are the ones that will actually be used.
 */
export async function previewOrganizationsImport(formData: FormData): Promise<ImportPreview> {
  await requireImporter();

  const { file, buffer } = await readUpload(formData);
  const parsed = await parseOrganizationsWorkbook(buffer);

  return {
    fileName: file.name,
    detectedHeaders: parsed.detectedHeaders,
    mapping: parsed.mapping,
    unmappedHeaders: parsed.unmappedHeaders,
    missingRequired: parsed.missingRequired,
    rowCount: parsed.rows.length,
    sampleRows: parsed.rows.slice(0, 10).map((row) => ({
      name: row.name,
      district: row.district,
      classification: row.classification ?? '',
      nationalId: row.nationalId ?? '',
      establishedAt: row.establishedAt ?? '',
      directorName: row.directorName ?? '',
      mobile: row.mobile ?? ''
    }))
  };
}

/** Shapes a parsed row into the insert payload, deriving the matching columns. */
function toInsertValues(row: ParsedRow) {
  const directorName = row.directorName?.trim() || null;
  const members = directorName
    ? [{ name: directorName, nationalId: '', mobile: '', jobTitle: 'مدير' }]
    : [];

  return {
    name: row.name,
    nameNormalized: normalizeArabic(row.name),
    district: row.district,
    classification: row.classification,
    nationalId: row.nationalId,
    establishedAt: row.establishedAt,
    directorName,
    mobile: row.mobile,
    serialNo: row.serialNo,
    members,
    searchKey: buildSearchKey(row)
  };
}

/**
 * Imports an uploaded workbook, upserting on `(national_id, name_normalized)`.
 *
 * That composite key is what keeps the two national IDs shared by two different
 * societies apart. Keying on `national_id` alone would collapse each of those
 * pairs into one row and silently lose a society on every import.
 */
export async function importOrganizations(formData: FormData): Promise<ImportResult> {
  const user = await requireImporter();

  const { file, buffer } = await readUpload(formData);
  const parsed = await parseOrganizationsWorkbook(buffer);

  if (parsed.missingRequired.length > 0) {
    throw new Error(
      `الملف تنقصه أعمدة مطلوبة: ${parsed.missingRequired.join('، ')}. الأعمدة المطلوبة هي ${REQUIRED_FIELDS.join('، ')}.`
    );
  }

  const errors: ImportIssue[] = [...parsed.errors];
  const warnings: ImportIssue[] = [...parsed.warnings];
  const valid: ParsedRow[] = [];

  for (const row of parsed.rows) {
    const result = organizationImportRowSchema.safeParse({
      name: row.name,
      district: row.district,
      classification: row.classification,
      nationalId: row.nationalId,
      establishedAt: row.establishedAt,
      directorName: row.directorName,
      mobile: row.mobile,
      serialNo: row.serialNo
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row: row.rowNumber,
          column: issue.path.join('.') || undefined,
          message: issue.message
        });
      }
      continue;
    }

    valid.push(row);
  }

  /**
   * Two rows in one file can share the identity key — the same society listed
   * twice. Postgres refuses to update the same row twice in a single
   * `INSERT … ON CONFLICT`, so the duplicate is dropped here with an explicit
   * warning rather than failing the statement.
   */
  const seen = new Map<string, number>();
  const deduped: ParsedRow[] = [];

  for (const row of valid) {
    const key = `${row.nationalId ?? ''}::${normalizeArabic(row.name)}`;
    const firstSeenAt = seen.get(key);

    if (firstSeenAt !== undefined) {
      warnings.push({
        row: row.rowNumber,
        message: `صف مكرر (نفس الرقم الوطني والاسم كما في الصف ${firstSeenAt}) — تم تجاهله`
      });
      continue;
    }

    seen.set(key, row.rowNumber);
    deduped.push(row);
  }

  const db = getDb();
  let inserted = 0;
  let updated = 0;

  // One transaction: a partial import would leave the registry in a state no
  // one asked for and with no record of where it stopped.
  await db.transaction(async (tx) => {
    for (let index = 0; index < deduped.length; index += CHUNK_SIZE) {
      const chunk = deduped.slice(index, index + CHUNK_SIZE).map(toInsertValues);
      if (chunk.length === 0) continue;

      const written = await tx
        .insert(organizations)
        .values(chunk)
        .onConflictDoUpdate({
          // Must match `organizations_identity_key` exactly, or Postgres cannot
          // infer the arbiter and raises "no unique or exclusion constraint
          // matching the ON CONFLICT specification".
          target: [organizations.nationalIdKey, organizations.nameNormalized],
          set: {
            name: sql`excluded.name`,
            district: sql`excluded.district`,
            classification: sql`excluded.classification`,
            establishedAt: sql`excluded.established_at`,
            directorName: sql`excluded.director_name`,
            mobile: sql`excluded.mobile`,
            serialNo: sql`excluded.serial_no`,
            searchKey: sql`excluded.search_key`,
            updatedAt: sql`now()`
          }
        })
        // `xmax = 0` is true only for a tuple this statement inserted; a row it
        // updated carries the id of the locking transaction. It is the standard
        // way to tell the two apart in one round trip.
        .returning({ isInsert: sql<boolean>`(xmax = 0)` });

      for (const row of written) {
        if (row.isInsert) inserted += 1;
        else updated += 1;
      }
    }
  });

  const result: ImportResult = {
    fileName: file.name,
    total: parsed.rows.length,
    inserted,
    updated,
    skipped: parsed.rows.length - deduped.length,
    warnings,
    errors
  };

  await auditLog({
    action: 'IMPORT',
    entityType: 'organization',
    actor: { id: user.id, email: user.email, type: 'user' },
    metadata: {
      fileName: result.fileName,
      total: result.total,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      warningCount: warnings.length,
      errorCount: errors.length
    }
  });

  return result;
}
