#!/usr/bin/env node

/**
 * Copies the contents of a storage bucket from one Supabase to another.
 *
 * The database dump moves `storage.objects` — the *index* of what files exist —
 * but not the bytes, which live in the storage backend. Import the dump without
 * this step and every attachment resolves to a signed URL that returns 500.
 *
 * Reads the file list from the destination's own `storage.objects` (already
 * populated by the dump), so it copies exactly what the database expects to
 * find, at exactly the paths it expects.
 *
 * Usage:
 *   CLOUD_URL=https://<ref>.supabase.co \
 *   CLOUD_SERVICE_KEY=<cloud service_role> \
 *   LOCAL_URL=http://10.0.0.5:8000 \
 *   LOCAL_SERVICE_KEY=<local SERVICE_ROLE_KEY> \
 *   node copy-storage.mjs [bucket]
 *
 * Idempotent: re-running overwrites, so an interrupted copy just needs another
 * run. Never deletes anything on either side.
 */

const bucket = process.argv[2] ?? 'private';

const {
  CLOUD_URL,
  CLOUD_SERVICE_KEY,
  LOCAL_URL,
  LOCAL_SERVICE_KEY,
  LIST_LIMIT = '10000'
} = process.env;

for (const [name, value] of Object.entries({
  CLOUD_URL,
  CLOUD_SERVICE_KEY,
  LOCAL_URL,
  LOCAL_SERVICE_KEY
})) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const auth = (key) => ({ apikey: key, Authorization: `Bearer ${key}` });

/**
 * Every object path in the bucket, read from the destination.
 *
 * The storage API's list endpoint is per-prefix and non-recursive, so walk it:
 * an entry with no `id` is a folder.
 */
async function listPaths(base, key, prefix = '') {
  const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...auth(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: Number(LIST_LIMIT), sortBy: { column: 'name' } })
  });

  if (!res.ok) throw new Error(`list ${prefix || '/'} failed (${res.status}): ${await res.text()}`);

  const entries = await res.json();
  const paths = [];

  for (const entry of entries) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) paths.push(full);
    else paths.push(...(await listPaths(base, key, full)));
  }

  return paths;
}

const paths = await listPaths(LOCAL_URL, LOCAL_SERVICE_KEY);
console.log(`${paths.length} ملف في الفهرس المحلي — بدء النقل من السحابة`);

let copied = 0;
const failures = [];

for (const [index, path] of paths.entries()) {
  const label = `[${index + 1}/${paths.length}] ${path}`;

  try {
    // service_role reads the object directly; no signed URL round-trip needed.
    const download = await fetch(`${CLOUD_URL}/storage/v1/object/${bucket}/${path}`, {
      headers: auth(CLOUD_SERVICE_KEY)
    });
    if (!download.ok) throw new Error(`تنزيل ${download.status}`);

    const body = Buffer.from(await download.arrayBuffer());
    const contentType = download.headers.get('content-type') ?? 'application/octet-stream';

    const upload = await fetch(`${LOCAL_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...auth(LOCAL_SERVICE_KEY), 'Content-Type': contentType, 'x-upsert': 'true' },
      body
    });
    if (!upload.ok) throw new Error(`رفع ${upload.status}: ${await upload.text()}`);

    copied++;
    console.log(`  ✔ ${label} (${(body.length / 1024).toFixed(0)}KB)`);
  } catch (error) {
    failures.push({ path, message: error.message });
    console.error(`  ✘ ${label} — ${error.message}`);
  }
}

console.log(`\nنُقل ${copied} من ${paths.length}`);

if (failures.length) {
  console.error(`فشل ${failures.length} — أعد التشغيل بعد معالجتها:`);
  for (const failure of failures) console.error(`  - ${failure.path}: ${failure.message}`);
  process.exit(1);
}
