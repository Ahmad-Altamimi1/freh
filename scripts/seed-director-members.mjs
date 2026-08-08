#!/usr/bin/env node

/**
 * Backfill: adds each organization's directorName to its members array
 * (with jobTitle "مدير") when they are not already listed.
 *
 * Safe to re-run — skips organizations that already have the director as a
 * member (compared via Arabic normalization).
 *
 * Usage:
 *   node scripts/seed-director-members.mjs
 *   node scripts/seed-director-members.mjs --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const DRY_RUN = process.argv.includes('--dry-run');

const ENV_FILES = ['.env.local', '.env'];

function loadEnv() {
  for (const file of ENV_FILES) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;

    return Object.fromEntries(
      fs
        .readFileSync(full, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].split(' #')[0].trim().replace(/^['"]|['"]$/g, '')])
    );
  }
  throw new Error(`No env file found. Expected one of: ${ENV_FILES.join(', ')}`);
}

/**
 * Minimal Arabic normalization — matches the app's normalizeArabic().
 * Folds hamza carriers, taa marbuta, strips diacritics, lowercases.
 */
function normalizeArabic(text) {
  return text
    .normalize('NFKC')
    .replace(/ـ/g, '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const env = loadEnv();
const dbUrl = env.DIRECT_DATABASE_URL ?? env.DATABASE_URL;

if (!dbUrl) {
  console.error('DIRECT_DATABASE_URL (or DATABASE_URL) must be set.');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

try {
  const orgs = await sql`
    SELECT id, name, director_name, members
    FROM organizations
    WHERE director_name IS NOT NULL
      AND director_name != ''
  `;

  let updated = 0;
  let skipped = 0;

  for (const org of orgs) {
    const members = org.members ?? [];
    const normalizedDirector = normalizeArabic(org.director_name);

    const alreadyPresent = members.some(
      (m) => normalizeArabic(m.name) === normalizedDirector
    );

    if (alreadyPresent) {
      skipped++;
      continue;
    }

    const newMembers = [
      { name: org.director_name, nationalId: '', mobile: '', jobTitle: 'مدير' },
      ...members
    ];

    if (DRY_RUN) {
      console.log(`[dry-run] ${org.name}: would add "${org.director_name}" as مدير`);
    } else {
      await sql`
        UPDATE organizations
        SET members = ${JSON.stringify(newMembers)}::jsonb,
            updated_at = now()
        WHERE id = ${org.id}
      `;
    }

    updated++;
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}.`);
  console.log(`  Total with director: ${orgs.length}`);
  console.log(`  Added as member:     ${updated}`);
  console.log(`  Already present:     ${skipped}`);
} finally {
  await sql.end();
}
