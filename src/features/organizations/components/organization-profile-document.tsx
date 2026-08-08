import type { Correspondence } from '@/features/correspondences/api/types';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import type { Member } from '@/db/schema/organizations';
import type { Organization } from '../api/types';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';
import { termStatusOf } from '../lib/term';

const DOC = ORGANIZATION_LABELS.document;
const PROFILE = ORGANIZATION_LABELS.profile;
const TERM_LABELS = ORGANIZATION_LABELS.dashboard.term;

/**
 * One organization's complete file, as a printable A4 document.
 *
 * The counterpart to `ReportDocument`: that one answers "what does the registry
 * look like", this one answers "give me everything on this society". It is the
 * paper artifact staff previously assembled by hand — identity, the current
 * term, the board roster, and the correspondence log in one filed document.
 *
 * A Server Component with no client JavaScript and no charting library, for the
 * same reason `ReportDocument` avoids them: the PDF is captured by headless
 * Chromium, and anything that lays itself out after hydration can be caught
 * mid-flight. Everything here is static markup.
 *
 * Correspondences are optional rather than empty-by-default: a user who cannot
 * read the log gets a stated omission, which is a different fact from a society
 * that has no correspondence.
 */

interface OrganizationProfileDocumentProps {
  organization: Organization;
  correspondences: Correspondence[] | null;
  /** `YYYY-MM-DD` today and the end of the notice window, for the term bucket. */
  termWindow: { today: string; noticeEnd: string };
  generatedAt: string;
}

export function OrganizationProfileDocument({
  organization,
  correspondences,
  termWindow,
  generatedAt
}: OrganizationProfileDocumentProps) {
  const members = organization.members ?? [];
  const attachmentCount = (correspondences ?? []).reduce(
    (total, row) => total + row.files.length,
    0
  );
  const termStatus = termStatusOf(organization.termEnd, termWindow.today, termWindow.noticeEnd);

  return (
    <div className='doc-sheet text-[11pt] leading-relaxed' dir='rtl'>
      {/* The per-page header and footer come from the PDF route's margin-box
          templates — see the note in src/app/print/layout.tsx. This masthead is
          the page-one letterhead and appears once. */}
      <DocumentMasthead />

      <div className='avoid-break mt-6 text-center'>
        <p className='text-[10pt] text-neutral-600'>{PROFILE.documentTitle}</p>
        <h1 className='mt-1 text-[16pt] font-bold text-black'>{organization.name}</h1>
        <p className='mt-1 text-[9pt] text-neutral-600'>
          {PROFILE.generatedAt}: <span dir='ltr'>{formatDateAr(generatedAt)}</span>
        </p>
      </div>

      <SummaryStrip
        cells={[
          { label: PROFILE.summary.members, value: formatNumberAr(members.length) },
          {
            label: PROFILE.summary.correspondences,
            // A restricted log is an unknown count, not zero.
            value: correspondences ? formatNumberAr(correspondences.length) : '—'
          },
          {
            label: PROFILE.summary.attachments,
            value: correspondences ? formatNumberAr(attachmentCount) : '—'
          },
          { label: PROFILE.summary.termStatus, value: TERM_LABELS[termStatus], ltr: false }
        ]}
      />

      <IdentityBlock organization={organization} />
      <TermBlock organization={organization} />
      <MembersBlock members={members} />
      <CorrespondencesBlock rows={correspondences} />

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

      {/* A plain <img>, not next/image — see the note in report-document.tsx. */}
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

function SummaryStrip({ cells }: { cells: { label: string; value: string; ltr?: boolean }[] }) {
  return (
    <div className='avoid-break mt-6 grid grid-cols-4 gap-px bg-neutral-300'>
      {cells.map((cell) => (
        <div key={cell.label} className='bg-white px-3 py-2 text-center'>
          <p className='text-[9pt] text-neutral-600'>{cell.label}</p>
          <p
            dir={cell.ltr === false ? undefined : 'ltr'}
            className='mt-0.5 text-[13pt] font-bold text-black'
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * A two-column label/value grid.
 *
 * Rendered as a definition list rather than a table because these are facts
 * about one record, not rows of a dataset — and a `<dl>` keeps the pairing
 * intact for anything reading the PDF's tag tree.
 */
function FieldGrid({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className='grid grid-cols-2 gap-x-8 gap-y-0 text-[10pt]'>
      {rows.map((row) => (
        <div
          key={row.label}
          className='avoid-break flex justify-between gap-3 border-b border-neutral-200 py-1.5'
        >
          <dt className='text-neutral-600'>{row.label}</dt>
          <dd className='font-medium text-black'>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** An absent value, printed as a dash rather than as blank space. */
const EMPTY = <span className='text-neutral-500'>—</span>;

/** Digits reorder under the bidi algorithm unless the run is marked. */
function Ltr({ children }: { children: React.ReactNode }) {
  return <span dir='ltr'>{children}</span>;
}

function IdentityBlock({ organization }: { organization: Organization }) {
  const rows = [
    { label: ORGANIZATION_FIELD_LABELS.name, value: organization.name },
    {
      label: ORGANIZATION_FIELD_LABELS.nationalId,
      value: organization.nationalId ? <Ltr>{organization.nationalId}</Ltr> : EMPTY
    },
    { label: ORGANIZATION_FIELD_LABELS.district, value: organization.district },
    {
      label: ORGANIZATION_FIELD_LABELS.classification,
      value: organization.classification || EMPTY
    },
    {
      label: ORGANIZATION_FIELD_LABELS.establishedAt,
      value: organization.establishedAt ? (
        <Ltr>{formatDateAr(organization.establishedAt)}</Ltr>
      ) : (
        EMPTY
      )
    },
    {
      label: ORGANIZATION_FIELD_LABELS.serialNo,
      value: organization.serialNo != null ? <Ltr>{organization.serialNo}</Ltr> : EMPTY
    },
    { label: ORGANIZATION_FIELD_LABELS.directorName, value: organization.directorName || EMPTY },
    {
      label: ORGANIZATION_FIELD_LABELS.mobile,
      value: organization.mobile ? <Ltr>{organization.mobile}</Ltr> : EMPTY
    }
  ];

  return (
    <Section title={PROFILE.sections.identity}>
      <FieldGrid rows={rows} />
    </Section>
  );
}

function TermBlock({ organization }: { organization: Organization }) {
  const rows = [
    {
      label: ORGANIZATION_FIELD_LABELS.termStart,
      value: organization.termStart ? <Ltr>{formatDateAr(organization.termStart)}</Ltr> : EMPTY
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termEnd,
      value: organization.termEnd ? <Ltr>{formatDateAr(organization.termEnd)}</Ltr> : EMPTY
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termLength,
      value: organization.termLength != null ? <Ltr>{organization.termLength}</Ltr> : EMPTY
    }
  ];

  return (
    <Section title={PROFILE.sections.term}>
      <FieldGrid rows={rows} />
    </Section>
  );
}

function MembersBlock({ members }: { members: Member[] }) {
  return (
    <Section title={PROFILE.sections.members}>
      {members.length === 0 ? (
        <p className='text-[10pt] text-neutral-700'>{PROFILE.noMembers}</p>
      ) : (
        <table className='w-full border-collapse text-[9.5pt]'>
          {/* `display: table-header-group` in the print stylesheet repeats this
              row at the top of every page the table spans. */}
          <thead>
            <tr className='bg-neutral-200'>
              <th className='w-8 border border-neutral-400 px-1 py-1 font-bold'>{DOC.rowNumber}</th>
              <th className='border border-neutral-400 px-2 py-1 text-start font-bold'>
                {PROFILE.memberName}
              </th>
              <th className='border border-neutral-400 px-2 py-1 text-start font-bold'>
                {ORGANIZATION_LABELS.members.jobTitle}
              </th>
              <th className='border border-neutral-400 px-2 py-1 text-start font-bold'>
                {ORGANIZATION_LABELS.members.nationalId}
              </th>
              <th className='border border-neutral-400 px-2 py-1 text-start font-bold'>
                {ORGANIZATION_LABELS.members.mobile}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr
                key={`${member.nationalId}-${index}`}
                className={index % 2 === 1 ? 'bg-neutral-50' : undefined}
              >
                <td dir='ltr' className='border border-neutral-400 px-1 py-1 text-center'>
                  {index + 1}
                </td>
                <td className='border border-neutral-400 px-2 py-1'>{member.name || EMPTY}</td>
                <td className='border border-neutral-400 px-2 py-1'>{member.jobTitle || EMPTY}</td>
                <td className='border border-neutral-400 px-2 py-1'>
                  {member.nationalId ? <Ltr>{member.nationalId}</Ltr> : EMPTY}
                </td>
                <td className='border border-neutral-400 px-2 py-1'>
                  {member.mobile ? <Ltr>{member.mobile}</Ltr> : EMPTY}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/**
 * The correspondence log.
 *
 * Attachments are listed by name and count rather than linked: a signed storage
 * URL expires in minutes, and a dead link printed onto a filed page is worse
 * than no link at all. The file names are what lets someone find the originals.
 */
function CorrespondencesBlock({ rows }: { rows: Correspondence[] | null }) {
  return (
    <Section title={PROFILE.sections.correspondences}>
      {rows === null ? (
        <p className='text-[10pt] text-neutral-700'>{PROFILE.correspondencesRestricted}</p>
      ) : rows.length === 0 ? (
        <p className='text-[10pt] text-neutral-700'>{PROFILE.noCorrespondences}</p>
      ) : (
        <table className='w-full border-collapse text-[9.5pt]'>
          <thead>
            <tr className='bg-neutral-200'>
              <th className='w-8 border border-neutral-400 px-1 py-1 font-bold'>{DOC.rowNumber}</th>
              <th className='border border-neutral-400 px-2 py-1 text-start font-bold'>
                {PROFILE.correspondenceSubject}
              </th>
              <th className='w-20 border border-neutral-400 px-2 py-1 font-bold'>
                {PROFILE.correspondenceType}
              </th>
              <th className='w-24 border border-neutral-400 px-2 py-1 font-bold'>
                {PROFILE.correspondenceDate}
              </th>
              <th className='w-2/5 border border-neutral-400 px-2 py-1 text-start font-bold'>
                {PROFILE.correspondenceAttachments}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={index % 2 === 1 ? 'bg-neutral-50' : undefined}>
                <td dir='ltr' className='border border-neutral-400 px-1 py-1 text-center'>
                  {index + 1}
                </td>
                <td className='border border-neutral-400 px-2 py-1 align-top'>{row.name}</td>
                <td className='border border-neutral-400 px-2 py-1 text-center align-top'>
                  {row.type}
                </td>
                <td
                  dir='ltr'
                  className='border border-neutral-400 px-2 py-1 text-center align-top tabular-nums'
                >
                  {formatDateAr(row.createdAt)}
                </td>
                <td className='border border-neutral-400 px-2 py-1 align-top'>
                  {row.files.length === 0 ? (
                    EMPTY
                  ) : (
                    <>
                      <span className='text-neutral-600'>
                        {PROFILE.attachmentCount(row.files.length)}
                      </span>
                      <ul className='mt-0.5 space-y-0.5 text-[8.5pt] text-neutral-700'>
                        {row.files.map((file) => (
                          // Filenames are an LTR island even inside Arabic prose.
                          <li key={file.path} dir='ltr' className='text-start'>
                            {file.originalName ?? file.path}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </td>
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
