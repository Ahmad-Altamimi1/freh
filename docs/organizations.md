# Organizations Registry

A searchable registry of cultural societies (الجمعيات الثقافية), seeded from an MS Access export. Three capabilities: **Excel import**, **compound filtering**, and **reports** driven by whatever the filter selected.

| Route | Purpose | Access |
| --- | --- | --- |
| `/dashboard/organizations` | Table, search, filter builder, create/edit/delete, **import dialog** | read: any signed-in user · write: `admin` |
| `/dashboard/organizations/reports` | KPIs, charts, print/PDF | any signed-in user |
| `/api/organizations/export` | Filtered `.xlsx` download | any signed-in user |
| `/api/organizations/template` | Blank import template | `admin` role |

---

## Data model

`organizations` — [src/db/schema/organizations.ts](../src/db/schema/organizations.ts).

Three columns exist only to make matching work and are never shown:

| Column | Why |
| --- | --- |
| `name_normalized` | `name` folded by `normalizeArabic()`. Half of the identity key. |
| `search_key` | Normalized name + director + district + classification + ID/mobile digits. Backed by a **trigram GIN index** so `ILIKE '%…%'` stays indexable. |
| `national_id_key` | Postgres-generated `coalesce(national_id, '')`. See below. |

### `national_id` is not a primary key

In the source data **two national IDs each belong to two different societies**, and two societies carry none at all. Identity is therefore the composite `(national_id_key, name_normalized)` — the `organizations_identity_key` unique index.

`national_id_key` exists because NULLs never conflict with one another in a unique index, so the two ID-less societies would re-insert on every import. Folding NULL to `''` inside the index *expression* would work in SQL, but Drizzle's `onConflictDoUpdate` can only name **columns** as the conflict arbiter — hence a stored generated column.

> Keying on `national_id` alone silently collapses each duplicated pair into one row and loses a society per import.

### Migrations

`0001_organizations_indexes.sql` is hand-written and holds what drizzle-kit cannot express: the `pg_trgm` extension, the trigram index, and **row level security**. Drizzle-created tables land with RLS *disabled*, which on Supabase means the anon key can read the table directly through PostgREST. Preserve that file if the schema is ever regenerated.

---

## Arabic normalization

Everything comparing Arabic text goes through [src/lib/arabic.ts](../src/lib/arabic.ts) — one function, shared by search, import matching, and dedupe.

Arabic admits several spellings of the same word: hamza carriers (أ إ آ → ا), taa marbuta (ة → ه), alef maqsura (ى → ي), tatweel, and diacritics. Without folding, searching `شعله` finds nothing while `شعلة` exists in the table.

```ts
normalizeArabic('جمعية ملتقى شعلة اليرموك') // 'جمعيه ملتقي شعله اليرموك'
```

Code points are written as `\u` escapes in that file: Arabic literals get reordered by bidi rendering, which makes character ranges nearly impossible to review. One range in particular — `U+064B–U+0670` — looks like "all the diacritics" but swallows `U+0660–U+0669`, the Arabic-Indic digits, and would delete every digit of a national ID.

---

## Filtering

The URL is the single source of truth. Every filtered view is shareable, survives reload, and is directly reusable as a report definition.

```
?q=شعله&filters=[{"id":"district","operator":"inArray",…}]&joinOperator=and
```

| Piece | File |
| --- | --- |
| Operators, join operators, variants | [src/config/data-table.ts](../src/config/data-table.ts) *(pre-existing)* |
| URL ⇄ filter array | `getFiltersStateParser` in [src/lib/parsers.ts](../src/lib/parsers.ts) *(pre-existing)* |
| Params + column-id validation | [src/features/organizations/api/search-params.ts](../src/features/organizations/api/search-params.ts) |
| **Filter state → Drizzle SQL** | [src/lib/filter-columns.ts](../src/lib/filter-columns.ts) |
| Builder UI | [src/components/ui/table/data-table-filter-list.tsx](../src/components/ui/table/data-table-filter-list.tsx) |

Filtering, counting, sorting and aggregation all happen **in Postgres**, behind one shared `WHERE` built by `buildWhere()` in [service.ts](../src/features/organizations/api/service.ts). A report and the table it came from must describe the same rows, and that only holds if they share the predicate.

Everything in `filter-columns.ts` treats its input as hostile — filter state comes from the query string. A column id is honoured only if it appears in the caller's `columns` map; a value that will not coerce is dropped; `%` and `_` are escaped so a literal wildcard in a search term matches itself.

A column is filterable only if its definition carries `meta.variant` — that is what selects the operator list and the value input.

### Adding a filterable column

1. Add it to `FILTERABLE_COLUMNS` in `service.ts`.
2. Add its id to `ORGANIZATION_COLUMN_IDS` in `search-params.ts`.
3. Give the column a `meta.variant` (and `meta.options` for select variants) in `columns.tsx`.
4. Add its Arabic label to `ORGANIZATION_FIELD_LABELS`.

---

## Import

`importOrganizations()` — [src/features/organizations/api/import.ts](../src/features/organizations/api/import.ts). **Upserts**; re-importing the same file updates rather than duplicates.

The UI is a **dialog on the registry page**, not its own route: importing is an action performed *on* the table rather than a place to go, and the point of the flow is watching the rows change. A separate page discarded the filter and scroll position that prompted the import. Committing invalidates `organizationKeys.all`, so the table behind the dialog updates in place.

Parsing lives in [workbook.ts](../src/features/organizations/api/workbook.ts) and is shared by the preview and the commit, so the preview describes exactly what will happen.

Headers are matched through an alias table accepting **both** the original Access names and Arabic labels, so `3_merged.xlsx` imports unedited and an export re-imports unedited:

```
Org_Name | اسم الجمعية  →  name          Org_stat  | اللواء  →  district
Mobile   | رقم الهاتف   →  mobile        txtNum    | التسلسل →  serialNo
```

Only `name` and `district` are required.

### Hard failures vs. warnings

A missing name or district skips the row. A malformed phone number does **not** — it is written with a warning. Rejecting rows over a bad phone number would fail the import on precisely the rows that most need correcting.

### Spreadsheet traps handled

- **Mobile leading zero.** Read via `cell.text`, never as a number. A nine-digit value starting `7` is restored to ten — a repair of a known Excel defect, since every mobile here is `07` + eight digits.
- **Dates in UTC.** Formatting through the local timezone shifts a calendar date across a day boundary.
- **National IDs as floats** (`419935010.0`).
- **Duplicate rows within one file.** Postgres cannot update the same row twice in one `INSERT … ON CONFLICT`, so same-key rows are dropped with a warning before the statement.

`xmax = 0` in the `RETURNING` clause distinguishes inserted from updated rows in a single round trip.

---

## Create, edit, delete

`createOrganization` / `updateOrganization` / `deleteOrganization` live at the bottom of [service.ts](../src/features/organizations/api/service.ts); `mutations.ts` wraps them in `mutationOptions`. UI is a sheet ([organization-form-sheet.tsx](../src/features/organizations/components/organization-form-sheet.tsx)) opened from the header button or a row's ⋯ menu.

**All three require `admin`.** `'use server'` makes every export a POST endpoint, so hiding the button guards nothing — `requireEditor()` is the boundary. `canEdit` is resolved server-side in the listing and passed down, so the actions column never flashes in during hydration.

**Derived columns are recomputed on every write** through the same `@/lib/arabic` helpers the import uses. A row written without them would be invisible to search *and* to the import's duplicate detection — a silent failure.

**Duplicates surface as a message, not a 500.** A write violating `organizations_identity_key` (Postgres `23505`) is rethrown as "توجد جمعية أخرى بنفس الاسم والرقم الوطني". Worth knowing that normalization can make the clash invisible in raw text: `جمعية الشعلة` and `جمعيه الشعله` collide.

**Every mutation invalidates `organizationKeys.all`,** not a narrower key — a write can change which rows match the filter, the facet counts, and every figure on the report.

Two deliberate constraints:

- **District and classification are selects, not free text**, fed by the facets query. Both are controlled vocabularies here, and a typo silently creates a new facet that splits the reports and the filter list. New vocabulary is introduced through an import, where it is deliberate.
- **Form validation is no stricter than the import's.** A row imported with an odd mobile number has to stay editable; if the form demanded a well-formed number, fixing that row's director name would be impossible without also "fixing" a number nobody can verify.

## Reports and export

The report page reads the **same** search params as the table — the toolbar's report button just carries the query string across. `getOrganizationReport()` runs grouped aggregates behind the shared `WHERE`; nothing is computed from fetched rows, so the numbers describe the whole result set rather than the current page.

The export route re-parses the filter and re-runs the query server-side. It never accepts a client-supplied row list: the browser only holds one page, so an export built from it would silently contain ten rows.

Exported workbooks set `rightToLeft: true`, format mobile and national ID as text (`@`), and carry a second sheet naming the applied filters — an exported file outlives the URL that produced it, and a list of 16 societies with no statement of what was asked for cannot be defended later.

Print/PDF is [src/styles/print.css](../src/styles/print.css) — no dependency. Mark navigation with `print:hidden` and unbreakable blocks with `break-inside-avoid`.

---

## Arabic UI and RTL

| Concern | Where |
| --- | --- |
| `lang='ar' dir='rtl'` + font vars | [src/app/layout.tsx](../src/app/layout.tsx) |
| `DirectionProvider` | [src/components/layout/providers.tsx](../src/components/layout/providers.tsx) |
| Font | [src/components/themes/font.config.ts](../src/components/themes/font.config.ts) |
| Strings | [src/features/organizations/constants/labels.ts](../src/features/organizations/constants/labels.ts) |
| Dates/numbers | `formatDateAr`, `formatNumberAr` in [src/lib/format.ts](../src/lib/format.ts) |

Four things that are easy to get wrong:

- **`dir` belongs on `<html>`,** not the dashboard shell. Base UI portals overlays to the end of `<body>`; set lower and every popover reverts to LTR.
- **`DirectionProvider` is required on top of `dir`.** Base UI primitives position themselves in JavaScript and read direction from context, so without it `align='start'` keeps resolving to the left edge.
- **The font must carry Arabic glyphs.** Geist has none and fails silently — the browser substitutes a system serif for every Arabic string. The loaders publish `--font-plex-arabic` / `--font-geist-mono`, which the theme points `--font-sans` / `--font-mono` at; they must not publish as `--font-sans` directly, since the theme sets that same property on the same element and the winner would depend on stylesheet injection order. `fontVariables` goes on `<html>` — one level down and the theme's `var()` reference resolves to nothing.
- **Dates are Gregorian with Western digits** (`ar-JO-u-ca-gregory-nu-latn`). These are civil registration dates; a Hijri rendering would be a different date, and Eastern Arabic numerals would clash with the Latin-digit IDs beside them.

Column pinning uses `insetInlineStart/End` in [src/lib/data-table.ts](../src/lib/data-table.ts). TanStack's pinning sides are *logical* — `'left'` means the leading edge — so physical `left` would pin to the wrong side while still measuring the offset from the other.

---

## Verifying

```bash
bun run db:migrate && bun run typecheck && bun run build
```

Import [3_merged.xlsx](file:///C:/Users/ASUS/Downloads/3_merged.xlsx) unedited, then check:

- `inserted: 137, updated: 0`; **re-import the same file** → `inserted: 0, updated: 137`, still 137 rows.
- `select * from organizations where national_id in ('420205017','420235029')` → **4 rows**. Two means the identity index is wrong.
- Mobile reads `0785876407` *with* the zero; `established_at` for row 1 is `1993-03-16`.
- Quick-search `شعله` finds `شعلة`; `أحلام` finds `احلام`.
- `رقم الهاتف فارغ` → 5 rows. `التصنيف فارغ` → 1 row. District `قصبة اربد` → 66.
- District `[قصبة اربد, الرمثا]` **AND** established 2000–2010 → 16; flipped to **OR** → 97.
- Export, then re-import the exported file — it must parse with zero errors.

CRUD:

- Create a society, then create a second with the **same name and the same national ID** → rejected with the duplicate message, not a crash. Same name with a *different* national ID must be allowed (that is the real-world case the identity key exists for).
- Create one, then search for it by a differently-spelled variant (ة vs ه) → it must be found, which proves `search_key` was written.
- Edit a row, then reopen a *different* row's edit sheet → it must show the second row's values, not the first's.
- Sign in as a non-`admin` user → no create button, no import button, no ⋯ column.
- Filter the table, then import — the dialog closes onto the *same* filtered view, with the rows refreshed in place.
