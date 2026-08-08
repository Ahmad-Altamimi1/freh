import { REPORT_COLUMNS, REPORT_GROUP_BY, REPORT_SECTIONS } from '../api/types';
import type { ReportColumn, ReportDefinition, ReportSection } from '../api/types';

/**
 * Serialization for report definitions travelling in a URL.
 *
 * The print route and the PDF endpoint are both plain GETs — they have to
 * receive the whole definition, not a React prop. Base64url rather than
 * `encodeURIComponent`: percent-encoding costs three characters per UTF-8 byte
 * and an Arabic title alone is two bytes per character, so a definition with a
 * few filters would push the URL past what proxies reliably forward. Base64
 * costs 1.33x instead of 3x.
 */

/** What a report looks like before the user has chosen anything. */
export const DEFAULT_REPORT_DEFINITION: ReportDefinition = {
  title: 'تقرير الجمعيات الثقافية',
  criteria: {},
  groupBy: 'district',
  sections: [...REPORT_SECTIONS],
  columns: ['serialNo', 'name', 'district', 'classification', 'establishedAt', 'directorName']
};

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  // `btoa` in the browser, `Buffer` on the server — this module is imported by
  // both the builder and the API route.
  const base64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary =
    typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeReportDefinition(definition: ReportDefinition): string {
  return toBase64Url(JSON.stringify(definition));
}

/**
 * Decodes a definition from a query string, falling back to the default.
 *
 * Never throws: this parses attacker-reachable input on a public route handler,
 * and a malformed parameter should render the default report rather than a 500.
 * Unknown enum members are dropped rather than trusted — the service would
 * reject them anyway, but failing here keeps the error close to the input.
 */
export function decodeReportDefinition(raw: string | null | undefined): ReportDefinition {
  if (!raw) return DEFAULT_REPORT_DEFINITION;

  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Partial<ReportDefinition>;

    const sections = (parsed.sections ?? []).filter((section): section is ReportSection =>
      (REPORT_SECTIONS as readonly string[]).includes(section)
    );
    const columns = (parsed.columns ?? []).filter((column): column is ReportColumn =>
      (REPORT_COLUMNS as readonly string[]).includes(column)
    );
    const groupBy = (REPORT_GROUP_BY as readonly string[]).includes(parsed.groupBy ?? '')
      ? parsed.groupBy!
      : DEFAULT_REPORT_DEFINITION.groupBy;

    return {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title
          : DEFAULT_REPORT_DEFINITION.title,
      criteria: parsed.criteria ?? {},
      groupBy,
      sections: sections.length > 0 ? sections : DEFAULT_REPORT_DEFINITION.sections,
      columns: columns.length > 0 ? columns : DEFAULT_REPORT_DEFINITION.columns
    };
  } catch {
    return DEFAULT_REPORT_DEFINITION;
  }
}
