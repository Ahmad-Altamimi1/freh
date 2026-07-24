import { randomUUID } from 'node:crypto';
import { StorageError } from './types';

/** Extensions we are willing to write, keyed by MIME type. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv'
};

/**
 * Reduces a caller-supplied folder path to something safe to concatenate.
 *
 * Rejects traversal outright rather than stripping it: a `prefix` containing
 * `..` means the caller's intent is unclear, and silently rewriting it could
 * put a file somewhere they did not expect.
 */
export function sanitizePrefix(prefix?: string): string {
  if (!prefix) return '';

  const segments = prefix
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new StorageError(`Invalid storage prefix: "${prefix}"`, 'INVALID_PATH');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(segment)) {
      throw new StorageError(
        `Storage prefix segments may only contain letters, numbers, dot, underscore and hyphen: "${segment}"`,
        'INVALID_PATH'
      );
    }
  }

  return segments.join('/');
}

/** Derives an extension from the MIME type, falling back to the filename. */
function resolveExtension(mimeType: string, originalName?: string | null): string {
  const fromMime = EXTENSION_BY_MIME[mimeType];
  if (fromMime) return fromMime;

  const fromName = originalName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;

  return 'bin';
}

/**
 * Builds an unguessable storage path.
 *
 * The filename is a random UUID rather than anything derived from user input.
 * That matters for a private bucket: even if a signed URL leaks, neighbouring
 * objects cannot be guessed by incrementing an id or trying a known name, and
 * an uploaded filename can never collide with or overwrite an existing object.
 */
export function buildStoragePath(options: {
  mimeType: string;
  prefix?: string;
  fileName?: string;
  originalName?: string | null;
}): string {
  const prefix = sanitizePrefix(options.prefix);
  const extension = resolveExtension(options.mimeType, options.originalName);

  const base = options.fileName
    ? sanitizePrefix(options.fileName.replace(/\.[^.]+$/, ''))
    : randomUUID();

  if (!base) {
    throw new StorageError('Could not derive a valid file name.', 'INVALID_PATH');
  }

  const name = `${base}.${extension}`;
  return prefix ? `${prefix}/${name}` : name;
}

/** Validates a path supplied by a caller (e.g. read back from the database). */
export function assertValidStoragePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('..')) {
    throw new StorageError(`Invalid storage path: "${path}"`, 'INVALID_PATH');
  }
  return trimmed;
}
