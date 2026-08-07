/**
 * Upload constraints for correspondence attachments.
 *
 * Not the storage lib's own default (common web image types, 5 MB) —
 * correspondence attachments are primarily scanned letters and documents, not
 * images. Shared between the server (`api/service.ts`, actual enforcement via
 * `uploadPrivateFile`) and the client (`correspondence-form.tsx`, the
 * uploader's early size hint) so the two numbers can never drift apart.
 */
export const CORRESPONDENCE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp'
];

export const CORRESPONDENCE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const CORRESPONDENCE_MAX_FILES = 10;
