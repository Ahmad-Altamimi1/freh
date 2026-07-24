/**
 * Arabic text normalization.
 *
 * Arabic orthography admits several spellings of the same word: hamza carriers
 * (alef madda/hamza-above/hamza-below) for a bare alef, taa marbuta for haa,
 * alef maqsura for yaa, plus optional diacritics and the tatweel elongation
 * character. Two records a reader considers identical therefore rarely match
 * byte-for-byte.
 *
 * Every comparison in this app — quick search, and the import's duplicate
 * detection — runs through `normalizeArabic`, so the same organization spelled
 * two ways resolves to one key. Display always uses the original text; only the
 * comparison key is folded.
 *
 * Code points are written as \u escapes throughout. Arabic literals in source
 * are reordered by bidi rendering, which makes character ranges easy to
 * misread and nearly impossible to review.
 */

/** Tatweel (U+0640) — a purely typographic elongation carrying no meaning. */
const TATWEEL = /ـ/g;

/**
 * Combining marks, as explicit ranges rather than one sweeping range:
 * harakat (U+064B–U+065F), superscript alef (U+0670), and quranic
 * annotation (U+06D6–U+06ED).
 *
 * The tempting shorthand U+064B–U+0670 is wrong: U+0660–U+0669 are the
 * Arabic-Indic digits and sit inside it, so that range would delete every digit
 * of a national ID written in Arabic numerals.
 */
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;

/** Arabic-Indic (U+0660–U+0669) and extended Arabic-Indic (U+06F0–U+06F9) digits. */
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

/**
 * Letter folding. Order matters only in that each rule is independent — none of
 * the targets is itself a source of a later rule.
 */
const LETTER_FOLDING: Array<[RegExp, string]> = [
  [/[آأإٱٲٳ]/g, 'ا'], // alef variants  -> alef
  [/ة/g, 'ه'], // taa marbuta    -> haa
  [/[ىيی]/g, 'ي'], // alef maqsura / farsi yeh -> yeh
  [/ؤ/g, 'و'], // waw + hamza    -> waw
  [/ئ/g, 'ي'], // yeh + hamza    -> yeh
  [/ک/g, 'ك'] // farsi keheh    -> kaf
];

/**
 * Folds an Arabic string to a comparison key.
 *
 * Also lowercases and collapses whitespace, so mixed Arabic/Latin values — and
 * the stray double spaces that appear in several director names in the source
 * data — compare cleanly. Latin text passes through as a plain lowercase trim.
 */
export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return '';

  let out = String(input).normalize('NFKC').replace(TATWEEL, '').replace(DIACRITICS, '');

  for (const [pattern, replacement] of LETTER_FOLDING) {
    out = out.replace(pattern, replacement);
  }

  return out.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Converts Arabic-Indic digits to Western ones and strips everything that is not
 * a digit.
 *
 * Used for national ID and mobile, which arrive from Access as text, as floats,
 * and occasionally carrying a separator.
 */
export function normalizeDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';

  return String(input)
    .replace(ARABIC_INDIC_DIGITS, (digit) => {
      const code = digit.charCodeAt(0);
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    })
    .replace(/\D/g, '');
}

/** The searchable fields of an organization, as free text. */
export type SearchableOrganization = {
  name?: string | null;
  directorName?: string | null;
  district?: string | null;
  classification?: string | null;
  nationalId?: string | null;
  mobile?: string | null;
};

/**
 * Builds the single haystack column that quick search matches against.
 *
 * One normalized column with a trigram index beats six OR'd ILIKEs across six
 * columns: the planner gets one index to work with, and normalization is paid
 * once at write time rather than per row on every read.
 */
export function buildSearchKey(row: SearchableOrganization): string {
  return [
    normalizeArabic(row.name),
    normalizeArabic(row.directorName),
    normalizeArabic(row.district),
    normalizeArabic(row.classification),
    normalizeDigits(row.nationalId),
    normalizeDigits(row.mobile)
  ]
    .filter(Boolean)
    .join(' ');
}
