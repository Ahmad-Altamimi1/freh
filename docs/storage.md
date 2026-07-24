# Private File Storage

A generic service over a **private** Supabase Storage bucket. It is deliberately entity-agnostic — there is no `uploadProductImage()`, because the entities do not exist yet.

Import from `@/lib/storage`. Everything here is server-only (`import 'server-only'`).

## API

```ts
uploadPrivateFile(file, options?)   // → StoredFile
getSignedFileUrl(path, options?)    // → string
getSignedFileUrls(paths, options?)  // → Record<path, url>
deletePrivateFile(path, options?)   // → void
replacePrivateFile(oldPath, file, options?) // → StoredFile
validateFile(file, options?)        // → throws on invalid
```

## Uploading

```ts
'use server';
import { uploadPrivateFile } from '@/lib/storage';
import { requireUser } from '@/lib/auth/session';

export async function handleUpload(formData: FormData) {
  await requireUser();
  const file = formData.get('file') as File;

  const stored = await uploadPrivateFile(file, { prefix: 'invoices/2026' });
  // Persist stored.path in your own table — that is the only handle you need.
  return stored;
}
```

`StoredFile` is `{ path, bucket, mimeType, sizeBytes, originalName }`. Store `path`; everything else is metadata.

## What upload does, in order

1. Confirms a user is signed in (skippable with `skipAuthCheck` for trusted jobs).
2. Rejects empty files, files over the size limit, and disallowed MIME types.
3. Builds a random UUID path under the sanitised prefix.
4. Uploads with `upsert: false` and a pinned `contentType`.
5. Writes an `IMAGE_UPLOAD` audit event.

### Why paths are random

The filename is a UUID, never derived from user input. In a private bucket this means a leaked signed URL reveals exactly one object — neighbours cannot be guessed by incrementing an id or trying a known name — and an uploaded filename can never collide with or overwrite an existing object.

### Validation limits

Defaults are 5 MB and the common web image types (`jpeg`, `png`, `webp`, `gif`, `avif`). Override per call:

```ts
await uploadPrivateFile(file, {
  prefix: 'documents',
  allowedMimeTypes: ['application/pdf'],
  maxSizeBytes: 20 * 1024 * 1024
});
```

The browser-reported MIME type is a hint, not proof — it is attacker-controlled. It is checked to catch honest mistakes early; the actual protection is that the bucket is private, paths are unguessable, and `contentType` is pinned so nothing is ever served as active content.

## Reading

```ts
const url = await getSignedFileUrl(path, { expiresInSeconds: 60 });
```

**Treat a signed URL as a bearer token.** Anyone holding it can read the file until it expires. Keep the lifetime as short as the use case allows, generate it per request, and never cache it in a shared or public layer (including `revalidate`d fetches or a CDN).

For a list view, `getSignedFileUrls(paths)` signs in one round-trip.

Supabase can transform images while signing:

```ts
await getSignedFileUrl(path, { transform: { width: 200, height: 200, quality: 70 } });
```

## Replacing and deleting

```ts
const stored = await replacePrivateFile(oldPath, newFile, { prefix: 'invoices' });
// stored.path is NEW — update your record with it.
```

`replacePrivateFile` uploads first, then removes the old object, so a failed upload leaves the previous file intact. The new object gets a fresh random path, which means any signed URL already issued for the old path stops resolving once the delete lands.

If the delete of the old object fails, the upload is **not** rolled back — you have a valid new file, and the stale object is logged rather than failing the whole operation. Reconcile orphans with a sweep job if that matters to you.

## Errors

Every failure throws `StorageError` with a `code`:

`UNAUTHENTICATED` · `INVALID_FILE_TYPE` · `FILE_TOO_LARGE` · `INVALID_PATH` · `EMPTY_FILE` · `UPLOAD_FAILED` · `DELETE_FAILED` · `SIGN_FAILED`

```ts
import { StorageError } from '@/lib/storage';

try {
  await uploadPrivateFile(file);
} catch (error) {
  if (error instanceof StorageError && error.code === 'FILE_TOO_LARGE') {
    return { error: error.message };
  }
  throw error;
}
```

## Authentication vs authorization

These helpers verify that **someone** is signed in. They cannot verify that **this** user may touch **this** file — that depends on a schema that does not exist yet.

Until you own that check, do it in the caller:

```ts
const user = await requireUser();
const record = await getDb().query.invoices.findFirst({ where: eq(invoices.id, id) });
if (record?.ownerId !== user.id) throw new Error('Forbidden');

await deletePrivateFile(record.filePath);
```

## Bucket setup

Create the bucket in **Storage → New bucket** with **Public bucket off**, and set `SUPABASE_STORAGE_BUCKET` to its name. See [supabase-setup.md](./supabase-setup.md).
