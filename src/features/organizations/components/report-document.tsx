import { formatDateAr, formatNumberAr, formatPercent } from '@/lib/format';
import type { FilterDescription } from '../api/describe-filters';
import type { Organization, ReportColumn, ReportGroupRow, ReportResult } from '../api/types';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';

const DOC = ORGANIZATION_LABELS.document;
const REPORT = ORGANIZATION_LABELS.report;
const SECTIONS = ORGANIZATION_LABELS.sections;

/**
 * The printable government report.
 *
 * A Server Component with no client JavaScript and no charting library: the
 * distribution blocks are plain tables with a CSS-width bar rather than SVG.
 * That is a deliberate choice for the PDF path — Recharts measures its container
 * in the browser after hydration, so a headless render has to be raced with a
 * timeout and can emit a half-laid-out chart. A percentage-width `div` is
 * deterministic, prints identically in both paths, and reads as a formal
 * statistical table rather than a dashboard widget, which is what a filed
 * document wants.
 */

interface ReportDocumentProps {
  result: Omit<ReportResult, 'generatedAt'>;
  appliedFilters: FilterDescription[];
  generatedAt: string;
}

export function ReportDocument({ result, appliedFilters, generatedAt }: ReportDocumentProps) {
  const { definition, summary, grouped, rows } = result;
  const show = (section: (typeof definition.sections)[number]) =>
    definition.sections.includes(section);

  return (
    <div className='doc-sheet text-[11pt] leading-relaxed' dir='rtl'>
      {/* The per-page header and footer come from the PDF route's margin-box
          templates — see the note in src/app/print/layout.tsx. This masthead is
          the page-one letterhead and appears once. */}
      <DocumentMasthead />

      <div className='avoid-break mt-6 text-center'>
        <h1 className='text-[16pt] font-bold text-black'>{definition.title}</h1>
        <p className='mt-1 text-[9pt] text-neutral-600'>
          {REPORT.generatedAt}: <span dir='ltr'>{formatDateAr(generatedAt)}</span>
        </p>
      </div>

      {show('criteria') && <CriteriaBlock applied={appliedFilters} />}
      {show('summary') && <SummaryBlock summary={summary} />}

      <GroupedBlock
        rows={grouped}
        total={summary.total}
        dimension={ORGANIZATION_LABELS.groupBy[definition.groupBy]}
      />

      {show('charts') && (
        <>
          {definition.groupBy !== 'district' && result.byDistrict.length > 0 && (
            <GroupedBlock
              rows={result.byDistrict}
              total={summary.total}
              dimension={ORGANIZATION_FIELD_LABELS.district}
            />
          )}
          {definition.groupBy !== 'classification' && result.byClassification.length > 0 && (
            <GroupedBlock
              rows={result.byClassification}
              total={summary.total}
              dimension={ORGANIZATION_FIELD_LABELS.classification}
            />
          )}
        </>
      )}

      {show('table') && <DetailTable rows={rows} columns={definition.columns} />}

      <SignatureBlock />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** The letterhead on page one: emblem flanked by the ministry hierarchy. */
function DocumentMasthead() {
  return (
    <header className='avoid-break flex items-center justify-between gap-6 border-b-2 border-black pb-4'>
      <div className='text-[10pt] leading-6'>
        <p className='font-bold text-black'>{DOC.kingdom}</p>
        <p className='text-black'>{DOC.ministry}</p>
        <p className='text-neutral-700'>{DOC.directorate}</p>
        <p className='text-neutral-700'>{DOC.department}</p>
      </div>

      {/*
        A plain <img>, not next/image. The PDF route renders this page in
        headless Chromium and waits for the network to settle; next/image adds
        an optimizer round-trip and a client-side srcset swap, both of which are
        pure latency and one more thing that can be mid-flight when the PDF is
        captured. The asset is a fixed-size local file, so optimization buys
        nothing here.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src='/logo-mark.png' alt='' aria-hidden='true' className='h-20 w-auto object-contain' />
    </header>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='mt-6'>
      <h2 className='avoid-break mb-2 border-b border-neutral-400 pb-1 text-[11pt] font-bold text-black'>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * States what the numbers are a report of.
 *
 * Printed, the figures outlive the URL that produced them — without this a page
 * reading "16 جمعية" is indistinguishable from a claim about the whole registry.
 */
function CriteriaBlock({ applied }: { applied: FilterDescription[] }) {
  return (
    <Section title={SECTIONS.criteria}>
      {applied.length === 0 ? (
        <p className='text-[10pt] text-neutral-700'>{REPORT.noFilters}</p>
      ) : (
        <ul className='space-y-1 text-[10pt]'>
          {applied.map((line, index) => (
            <li key={`${line.label}-${index}`} className='flex gap-2'>
              <span className='text-neutral-600'>{line.label}:</span>
              <span className='font-medium text-black'>{line.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SummaryBlock({ summary }: { summary: ReportResult['summary'] }) {
  const cells: { label: string; value: string }[] = [
    { label: REPORT.total, value: formatNumberAr(summary.total) },
    { label: REPORT.districts, value: formatNumberAr(summary.districtCount) },
    { label: REPORT.classifications, value: formatNumberAr(summary.classificationCount) },
    {
      label: REPORT.range,
      value:
        summary.earliestYear && summary.latestYear
          ? `${summary.earliestYear} – ${summary.latestYear}`
          : '—'
    }
  ];

  return (
    <Section title={SECTIONS.summary}>
      <div className='avoid-break grid grid-cols-4 gap-px bg-neutral-300'>
        {cells.map((cell) => (
          <div key={cell.label} className='bg-white px-3 py-2 text-center'>
            <p className='text-[9pt] text-neutral-600'>{cell.label}</p>
            <p dir='ltr' className='mt-0.5 text-[13pt] font-bold text-black'>
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * One distribution, as a statistical table with an inline proportion bar.
 *
 * The bar is a plain `div` sized by percentage — see the component note on why
 * this is not a chart library.
 */
function GroupedBlock({
  rows,
  total,
  dimension
}: {
  rows: ReportGroupRow[];
  total: number;
  dimension: string;
}) {
  if (rows.length === 0) return null;
  const sum = rows.reduce((accumulator, row) => accumulator + row.count, 0);

  return (
    <Section title={`${DOC.groupedTitle} ${dimension}`}>
      <table className='w-full border-collapse text-[10pt]'>
        <thead>
          <tr className='bg-neutral-200'>
            <th className='border border-neutral-400 px-2 py-1 text-start font-bold'>
              {dimension}
            </th>
            <th className='w-20 border border-neutral-400 px-2 py-1 font-bold'>{DOC.count}</th>
            <th className='w-20 border border-neutral-400 px-2 py-1 font-bold'>{DOC.percent}</th>
            <th className='w-2/5 border border-neutral-400 px-2 py-1 font-bold'>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className='border border-neutral-400 px-2 py-1'>{row.label}</td>
              <td
                dir='ltr'
                className='border border-neutral-400 px-2 py-1 text-center tabular-nums'
              >
                {formatNumberAr(row.count)}
              </td>
              <td
                dir='ltr'
                className='border border-neutral-400 px-2 py-1 text-center tabular-nums'
              >
                {formatPercent(row.count, total)}
              </td>
              <td className='border border-neutral-400 px-2 py-1'>
                <div
                  className='h-2.5 bg-neutral-700'
                  style={{ width: total > 0 ? `${(row.count / total) * 100}%` : '0%' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className='bg-neutral-100 font-bold'>
            <td className='border border-neutral-400 px-2 py-1'>{DOC.total}</td>
            <td dir='ltr' className='border border-neutral-400 px-2 py-1 text-center tabular-nums'>
              {formatNumberAr(sum)}
            </td>
            <td dir='ltr' className='border border-neutral-400 px-2 py-1 text-center tabular-nums'>
              {formatPercent(sum, total)}
            </td>
            <td className='border border-neutral-400 px-2 py-1' />
          </tr>
        </tfoot>
      </table>
    </Section>
  );
}

/** Renders one cell of the detail table, keeping the LTR islands explicit. */
function cellContent(row: Organization, column: ReportColumn): React.ReactNode {
  switch (column) {
    case 'serialNo':
      return row.serialNo != null ? <span dir='ltr'>{row.serialNo}</span> : '—';
    case 'nationalId':
      return row.nationalId ? <span dir='ltr'>{row.nationalId}</span> : '—';
    case 'mobile':
      return row.mobile ? <span dir='ltr'>{row.mobile}</span> : '—';
    case 'establishedAt':
    case 'termStart':
    case 'termEnd': {
      const value = row[column];
      return value ? <span dir='ltr'>{formatDateAr(value)}</span> : '—';
    }
    case 'termLength':
      return row.termLength != null ? <span dir='ltr'>{row.termLength}</span> : '—';
    default:
      return row[column] || '—';
  }
}

function DetailTable({ rows, columns }: { rows: Organization[]; columns: ReportColumn[] }) {
  return (
    <Section title={SECTIONS.table}>
      {rows.length === 0 ? (
        <p className='text-[10pt] text-neutral-700'>{DOC.noRows}</p>
      ) : (
        <table className='w-full border-collapse text-[9pt]'>
          {/* `display: table-header-group` in the print stylesheet repeats this
              row at the top of every page the table spans. */}
          <thead>
            <tr className='bg-neutral-200'>
              <th className='w-8 border border-neutral-400 px-1 py-1 font-bold'>{DOC.rowNumber}</th>
              {columns.map((column) => (
                <th
                  key={column}
                  className='border border-neutral-400 px-2 py-1 text-start font-bold'
                >
                  {ORGANIZATION_FIELD_LABELS[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={index % 2 === 1 ? 'bg-neutral-50' : undefined}>
                <td dir='ltr' className='border border-neutral-400 px-1 py-1 text-center'>
                  {index + 1}
                </td>
                {columns.map((column) => (
                  <td key={column} className='border border-neutral-400 px-2 py-1 align-top'>
                    {cellContent(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/** The three-signature block every filed directorate document carries. */
function SignatureBlock() {
  return (
    <section className='avoid-break mt-10 grid grid-cols-3 gap-8 text-center text-[10pt]'>
      {[DOC.preparedBy, DOC.reviewedBy, DOC.approvedBy].map((role) => (
        <div key={role}>
          <p className='font-bold text-black'>{role}</p>
          <div className='mt-10 border-t border-neutral-500 pt-1 text-[9pt] text-neutral-600'>
            {DOC.signature}
          </div>
        </div>
      ))}
    </section>
  );
}
