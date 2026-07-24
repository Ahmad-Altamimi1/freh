/**
 * Contracts for the private file storage service.
 *
 * Deliberately entity-agnostic: nothing here knows whether a file belongs to a
 * product, a user, or anything else. Callers supply a `prefix` (a folder path)
 * and get back a storage path to persist however their schema sees fit.
 */

export type FileValidationOptions = {
  /** Allowed MIME types. Defaults to the common web image formats. */
  allowedMimeTypes?: string[];
  /** Maximum size in bytes. Defaults to 5 MB. */
  maxSizeBytes?: number;
};

export type UploadOptions = FileValidationOptions & {
  /**
   * Folder path the file is stored under, e.g. `'invoices'` or
   * `'invoices/2026'`. Segments are sanitised; `..` and absolute paths are
   * rejected.
   */
  prefix?: string;
  /** Overrides the generated filename. The extension is still derived safely. */
  fileName?: string;
  /** Storage bucket. Defaults to `SUPABASE_STORAGE_BUCKET`. */
  bucket?: string;
  /**
   * Skips the "is there a signed-in user" check. Only for trusted background
   * jobs that have already established authorization themselves.
   */
  skipAuthCheck?: boolean;
  /** Extra detail recorded on the audit event. */
  auditMetadata?: Record<string, unknown>;
  /** Entity type recorded on the audit event. Defaults to `'storage.file'`. */
  auditEntityType?: string;
};

export type StoredFile = {
  /** Path within the bucket. This is what you persist in your own schema. */
  path: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string | null;
};

export type SignedUrlOptions = {
  bucket?: string;
  /** Lifetime in seconds. Defaults to 60. Capped at 7 days by Supabase. */
  expiresInSeconds?: number;
  /** Prompts a download with this filename instead of rendering inline. */
  downloadAs?: string;
  /** Image transformation applied on the fly (Supabase image transforms). */
  transform?: { width?: number; height?: number; quality?: number };
};

/** Thrown for every failure mode below, with a machine-readable `code`. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'UNAUTHENTICATED'
      | 'INVALID_FILE_TYPE'
      | 'FILE_TOO_LARGE'
      | 'INVALID_PATH'
      | 'EMPTY_FILE'
      | 'UPLOAD_FAILED'
      | 'DELETE_FAILED'
      | 'SIGN_FAILED'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
];

export const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
