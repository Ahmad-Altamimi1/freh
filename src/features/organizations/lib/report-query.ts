import { normalizeArabic } from '@/lib/arabic';
import type { ExtendedColumnFilter } from '@/types/data-table';
import type { Organization, ReportDefinition, ReportGroupBy } from '../api/types';
import { todayUTC } from './term';

/**
 * Turns a plain Arabic sentence into report criteria — no LLM, no network.
 *
 * The registry's vocabulary is closed: eight-or-so districts, a handful of
 * classifications, a fixed set of fields, and four term states. That bound is
 * what makes a rule-based parser viable where it wouldn't be for open text —
 * "الجمعيات بإربد اللي دورتها خلصت وما إلها مدير" is three recognisable phrases,
 * not a language-understanding problem.
 *
 * Everything it recognises is reported back in `understood`, and the result
 * flows into the ordinary builder state — so a phrase it misses is corrected
 * with the same filter chips as any other report, never a dead end. Matching
 * runs through `normalizeArabic` for the same reason every comparison in this
 * app does: hamza and taa-marbuta variants must not decide whether a filter
 * fires.
 */

/** A field the parser can target, with the phrases that name it. */
type FieldSpec = {
  id: Extract<keyof Organization, string>;
  variant: ExtendedColumnFilter<Organization>['variant'];
  /** Human label for the `understood` line. */
  label: string;
  /** Phrases meaning "this field is absent" → `isEmpty`. */
  absent: string[];
  /** Phrases meaning "this field is present" → `isNotEmpty`. */
  present?: string[];
};

/**
 * Absence/presence vocabulary per field.
 *
 * Phrase lists rather than a grammar: at this vocabulary size an explicit list
 * is both more reliable and more auditable than trying to parse negation
 * generally. All phrases are folded through `normalizeArabic` at match time, so
 * they are written here in ordinary spelling.
 */
const FIELD_SPECS: FieldSpec[] = [
  {
    id: 'directorName',
    variant: 'text',
    label: 'اسم المدير',
    absent: ['بدون مدير', 'بلا مدير', 'ما إلها مدير', 'ماإلها مدير', 'بدون اسم مدير', 'بدون مدراء'],
    present: ['إلها مدير', 'عندها مدير', 'فيها مدير', 'لها مدير']
  },
  {
    id: 'mobile',
    variant: 'text',
    label: 'رقم الهاتف',
    absent: ['بدون هاتف', 'بدون رقم هاتف', 'بلا هاتف', 'بدون رقم', 'ما إلها هاتف', 'بدون تلفون'],
    present: ['إلها هاتف', 'عندها رقم', 'إلها رقم']
  },
  {
    id: 'nationalId',
    variant: 'text',
    label: 'الرقم الوطني',
    absent: ['بدون رقم وطني', 'بلا رقم وطني', 'ما إلها رقم وطني']
  },
  {
    id: 'establishedAt',
    variant: 'dateRange',
    label: 'تاريخ التأسيس',
    absent: ['بدون تاريخ تأسيس', 'بدون تأسيس', 'بلا تاريخ تأسيس']
  },
  {
    // "No term recorded" is a missing derived `termEnd` — see the schema note.
    id: 'termEnd',
    variant: 'dateRange',
    label: 'الدورة',
    absent: ['بدون دورة', 'بلا دورة', 'بدون دورة محددة', 'ما إلها دورة', 'دورة غير محددة']
  }
];

/** Term-status phrases → a concrete predicate on `termEnd`. */
const TERM_STATUS: { phrases: string[]; operator: 'lt' | 'gte'; label: string }[] = [
  {
    phrases: [
      'منتهية',
      'خلصت دورتها',
      'انتهت دورتها',
      'دورتها منتهية',
      'دورتها خلصت',
      'منتهية الدورة'
    ],
    operator: 'lt',
    label: 'دورة منتهية'
  },
  {
    phrases: ['دورتها سارية', 'سارية', 'دورتها فعالة', 'دورة سارية'],
    operator: 'gte',
    label: 'دورة سارية'
  }
];

/** "Group by" phrases → a grouping dimension. */
const GROUP_BY: { phrases: string[]; value: ReportGroupBy }[] = [
  { phrases: ['حسب اللواء', 'حسب الألوية', 'لكل لواء', 'بالألوية'], value: 'district' },
  { phrases: ['حسب التصنيف', 'لكل تصنيف', 'بالتصنيف'], value: 'classification' },
  { phrases: ['حسب السنة', 'حسب سنة التأسيس', 'عبر السنوات', 'حسب سنوات التأسيس'], value: 'year' },
  { phrases: ['حسب حالة الدورة', 'حسب الدورة', 'حسب حالة الدورات'], value: 'termStatus' }
];

/** Arabic-Indic and extended Arabic-Indic digits → Western, for year matching. */
function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Browser-safe unique id for a filter chip. */
function filterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Deterministic-enough fallback for environments without WebCrypto.
  return `f_${Math.abs(hashString(String(Date.now())))}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function makeFilter(
  spec: Pick<FieldSpec, 'id' | 'variant'>,
  operator: ExtendedColumnFilter<Organization>['operator'],
  value: string | string[]
): ExtendedColumnFilter<Organization> {
  return { id: spec.id, variant: spec.variant, operator, value, filterId: filterId() };
}

export type ParsedReportQuery = {
  criteria: NonNullable<ReportDefinition['criteria']>;
  groupBy?: ReportGroupBy;
  title: string;
  /** Arabic descriptions of every recognised clause, for the "we understood" note. */
  understood: string[];
  /** False when nothing at all was recognised — the caller shows a hint. */
  matched: boolean;
};

export type ParseReportQueryInput = {
  query: string;
  /** Distinct district values in the registry, for exact-match detection. */
  districts: string[];
  /** Distinct classification values in the registry. */
  classifications: string[];
};

/**
 * Parses one Arabic query into report criteria.
 *
 * Deliberately additive and forgiving: every clause it recognises is ANDed, and
 * anything it doesn't recognise is simply left out rather than guessed at. When
 * it recognises nothing structural, it falls back to a free-text search on the
 * whole phrase so the query still does *something* useful.
 */
export function parseReportQuery(input: ParseReportQueryInput): ParsedReportQuery {
  const { query, districts, classifications } = input;
  const normalized = normalizeArabic(query);
  const withWesternDigits = toWesternDigits(normalized);

  const has = (phrase: string) => normalized.includes(normalizeArabic(phrase));

  const filters: ExtendedColumnFilter<Organization>[] = [];
  const understood: string[] = [];
  let groupBy: ReportGroupBy | undefined;

  /* ---- facet fields: district & classification (exact, multi-value) ---- */
  const matchFacet = (
    values: string[],
    field: Pick<FieldSpec, 'id' | 'variant'>,
    fieldLabel: string
  ) => {
    const hit = values.filter((value) => normalized.includes(normalizeArabic(value)));
    if (hit.length > 0) {
      filters.push(makeFilter(field, 'inArray', hit));
      understood.push(`${fieldLabel}: ${hit.join('، ')}`);
    }
  };
  matchFacet(districts, { id: 'district', variant: 'multiSelect' }, 'اللواء');
  matchFacet(classifications, { id: 'classification', variant: 'multiSelect' }, 'التصنيف');

  /* ---- absence / presence ---- */
  for (const spec of FIELD_SPECS) {
    if (spec.absent.some(has)) {
      filters.push(makeFilter(spec, 'isEmpty', ''));
      understood.push(`بدون ${spec.label}`);
    } else if (spec.present?.some(has)) {
      filters.push(makeFilter(spec, 'isNotEmpty', ''));
      understood.push(`لها ${spec.label}`);
    }
  }

  /* ---- term status → predicate on termEnd ---- */
  const today = todayUTC();
  for (const status of TERM_STATUS) {
    if (status.phrases.some(has)) {
      filters.push(makeFilter({ id: 'termEnd', variant: 'dateRange' }, status.operator, today));
      understood.push(status.label);
      break; // "ended" and "active" are mutually exclusive; first wins.
    }
  }

  /* ---- year comparisons on establishedAt ----
     Needles are written in NORMALIZED form (taa-marbuta already folded to haa,
     hamza carriers to bare alef), because `withWesternDigits` is derived from
     the already-folded `normalized` — matching raw spelling here would never
     fire. So: سنة→سنه, تأسست→تاسست. */
  const after = withWesternDigits.match(/بعد\s+(\d{4})/);
  const before = withWesternDigits.match(/قبل\s+(\d{4})/);
  const exact = withWesternDigits.match(/(?:سنه|عام|تاسست|في)\s+(\d{4})/);
  const est = { id: 'establishedAt' as const, variant: 'dateRange' as const };
  if (after) {
    filters.push(makeFilter(est, 'gt', `${after[1]}-01-01`));
    understood.push(`تأسست بعد ${after[1]}`);
  } else if (before) {
    filters.push(makeFilter(est, 'lt', `${before[1]}-01-01`));
    understood.push(`تأسست قبل ${before[1]}`);
  } else if (exact) {
    filters.push(makeFilter(est, 'isBetween', [`${exact[1]}-01-01`, `${exact[1]}-12-31`]));
    understood.push(`تأسست سنة ${exact[1]}`);
  }

  /* ---- grouping ---- */
  for (const group of GROUP_BY) {
    if (group.phrases.some(has)) {
      groupBy = group.value;
      break;
    }
  }
  // When filtering by district but no grouping was asked for, classification is
  // the more informative default — grouping by the thing you filtered to is one
  // bar.
  if (!groupBy && filters.some((filter) => filter.id === 'district')) {
    groupBy = 'classification';
  }

  const matched = filters.length > 0 || groupBy !== undefined;

  // Nothing structural recognised → fall back to a plain search so the query is
  // not simply discarded.
  const q = matched ? '' : query.trim();

  return {
    criteria: { q, filters, joinOperator: 'and', sort: [{ id: 'name', desc: false }] },
    groupBy,
    title: query.trim(),
    understood,
    matched
  };
}
