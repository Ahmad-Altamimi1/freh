import 'server-only';

import { auditLog } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertValidStoragePath, buildStoragePath } from './paths';
import {
  DEFAULT_ALLOWED_MIME_TYPES,
  DEFAULT_MAX_SIZE_BYTES,
  StorageError,
  type FileValidationOptions,
  type SignedUrlOptions,
  type StoredFile,
  type UploadOptions
} from './types';

export { StorageError, DEFAULT_ALLOWED_MIME_TYPES, DEFAULT_MAX_SIZE_BYTES } from './types';
export type { FileValidationOptions, SignedUrlOptions, StoredFile, UploadOptions } from './types';
export { buildStoragePath, sanitizePrefix, assertValidStoragePath } from './paths';

/**
 * Generic private file storage over a Supabase Storage bucket.
 *
 * Every function here is entity-agnostic on purpose — there is no
 * `uploadProductImage`. Callers pass a `prefix` and store the returned `path`
 * in whatever schema they eventually define.
 *
 * The bucket must be created as PRIVATE. Nothing in this module can make an
 * object public; reads go exclusively through short-lived signed URLs.
 */

function resolveBucket(bucket?: string): string {
  return bucket ?? getServerEnv().SUPABASE_STORAGE_BUCKET;
}

/**
 * Confirms there is a signed-in user and returns their id.
 *
 * This is the authentication half. Authorization — whether *this* user may
 * touch *this* file — depends on the business schema and must be enforced by
 * the caller before invoking these helpers.
 */
async function requireActor(skipAuthCheck?: boolean): Promise<string | null> {
  if (skipAuthCheck) return null;

  const user = await getCurrentUser();
  if (!user) {
    throw new StorageError('You must be signed in to access files.', 'UNAUTHENTICATED');
  }
  return user.id;
}

/** Rejects files that are empty, oversized, or of a disallowed type. */
export function validateFile(file: File, options: FileValidationOptions = {}): void {
  const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  if (file.size === 0) {
    throw new StorageError('The file is empty.', 'EMPTY_FILE');
  }

  if (file.size > maxSizeBytes) {
    const limitMb = (maxSizeBytes / 1024 / 1024).toFixed(1);
    throw new StorageError(`File is larger than the ${limitMb} MB limit.`, 'FILE_TOO_LARGE');
  }

  // The browser-reported MIME type is a hint, not proof — it is attacker
  // controlled. It is checked here to catch honest mistakes early; the real
  // protection is that the bucket is private, paths are random, and
  // `contentType` is pinned on upload so nothing is served as active content.
  // An empty array means "accept all" — callers that know they want every type
  // pass `[]` rather than maintaining a comprehensive list.
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    throw new StorageError(
      `Files of type "${file.type || 'unknown'}" are not allowed.`,
      'INVALID_FILE_TYPE'
    );
  }
}

/**
 * Uploads a file to the private bucket and returns where it landed.
 *
 * Persist the returned `path` (and `bucket`) in your own schema — that is the
 * only handle needed to sign, replace, or delete the object later.
 */
export async function uploadPrivateFile(
  file: File,
  options: UploadOptions = {}
): Promise<StoredFile> {
  const actorId = await requireActor(options.skipAuthCheck);
  validateFile(file, options);

  const bucket = resolveBucket(options.bucket);
  const path = buildStoragePath({
    mimeType: file.type,
    prefix: options.prefix,
    fileName: options.fileName,
    originalName: file.name
  });

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    // Never overwrite: paths are random, so a collision means something is
    // wrong and silently replacing another object would be worse than failing.
    upsert: false
  });

  if (error) {
    throw new StorageError(`Upload failed: ${error.message}`, 'UPLOAD_FAILED');
  }

  const stored: StoredFile = {
    path,
    bucket,
    mimeType: file.type,
    sizeBytes: file.size,
    originalName: file.name || null
  };

  await auditLog({
    action: 'IMAGE_UPLOAD',
    entityType: options.auditEntityType ?? 'storage.file',
    entityId: path,
    actor: actorId ? undefined : { id: null, type: 'system' },
    metadata: {
      bucket,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      originalName: stored.originalName,
      ...options.auditMetadata
    }
  });

  return stored;
}

/**
 * Creates a short-lived signed URL for a private object.
 *
 * Treat the result as a bearer token: anyone holding it can read the file until
 * it expires. Keep `expiresInSeconds` as small as the use case allows, generate
 * it per request, and never cache it in a shared or public layer.
 */
export async function getSignedFileUrl(
  path: string,
  options: SignedUrlOptions = {}
): Promise<string> {
  await requireActor();

  const bucket = resolveBucket(options.bucket);
  const safePath = assertValidStoragePath(path);
  const expiresIn = options.expiresInSeconds ?? 60;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(safePath, expiresIn, {
    download: options.downloadAs,
    transform: options.transform
  });

  if (error || !data?.signedUrl) {
    throw new StorageError(
      `Could not sign URL: ${error?.message ?? 'unknown error'}`,
      'SIGN_FAILED'
    );
  }

  return data.signedUrl;
}

/** Signs several paths at once. Returns a path → URL map. */
export async function getSignedFileUrls(
  paths: string[],
  options: SignedUrlOptions = {}
): Promise<Record<string, string>> {
  await requireActor();

  if (paths.length === 0) return {};

  const bucket = resolveBucket(options.bucket);
  const safePaths = paths.map(assertValidStoragePath);
  const expiresIn = options.expiresInSeconds ?? 60;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(safePaths, expiresIn);

  if (error || !data) {
    throw new StorageError(
      `Could not sign URLs: ${error?.message ?? 'unknown error'}`,
      'SIGN_FAILED'
    );
  }

  return Object.fromEntries(
    data
      .filter((entry): entry is typeof entry & { signedUrl: string } => Boolean(entry.signedUrl))
      .map((entry) => [entry.path ?? '', entry.signedUrl])
  );
}

/** Permanently removes an object from the private bucket. */
export async function deletePrivateFile(
  path: string,
  options: {
    bucket?: string;
    auditEntityType?: string;
    auditMetadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await requireActor();

  const bucket = resolveBucket(options.bucket);
  const safePath = assertValidStoragePath(path);

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([safePath]);

  if (error) {
    throw new StorageError(`Delete failed: ${error.message}`, 'DELETE_FAILED');
  }

  await auditLog({
    action: 'IMAGE_DELETE',
    entityType: options.auditEntityType ?? 'storage.file',
    entityId: safePath,
    metadata: { bucket, ...options.auditMetadata }
  });
}

/**
 * Replaces an existing object with a new file.
 *
 * Uploads first, then removes the old object — so a failed upload leaves the
 * previous file intact. The new object gets a fresh random path, which means
 * any signed URL already issued for the old path stops resolving once the
 * delete lands. Update the path in your own records with the returned value.
 *
 * If the delete of the old object fails, the upload is NOT rolled back: the
 * caller now owns a valid new file, and the stale object is reported rather
 * than the whole operation being failed.
 */
export async function replacePrivateFile(
  previousPath: string,
  file: File,
  options: UploadOptions = {}
): Promise<StoredFile> {
  const bucket = resolveBucket(options.bucket);
  const safePreviousPath = assertValidStoragePath(previousPath);

  const stored = await uploadPrivateFile(file, { ...options, bucket });

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([safePreviousPath]);

  if (error) {
    console.error('[storage] replaced file but failed to remove the previous object', {
      bucket,
      previousPath: safePreviousPath,
      error: error.message
    });
  }

  await auditLog({
    action: 'IMAGE_REPLACE',
    entityType: options.auditEntityType ?? 'storage.file',
    entityId: stored.path,
    metadata: {
      bucket,
      previousPath: safePreviousPath,
      previousObjectRemoved: !error,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      ...options.auditMetadata
    }
  });

  return stored;
}
