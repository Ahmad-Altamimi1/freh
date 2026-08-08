/**
 * Upload constraints for correspondence attachments.
 *
 * Shared between the server (`api/service.ts`, actual enforcement via
 * `uploadPrivateFile`) and the client (`correspondence-form.tsx`, the
 * uploader's early size hint) so the two numbers can never drift apart.
 */

export const CORRESPONDENCE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const CORRESPONDENCE_MAX_FILES = 10;
