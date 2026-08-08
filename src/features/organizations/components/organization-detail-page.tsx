'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { AlertModal } from '@/components/modal/alert-modal';
import { useBreadcrumbOverride } from '@/hooks/use-breadcrumbs';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { organizationByIdOptions } from '../api/queries';
import { deleteOrganizationMutation } from '../api/mutations';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { todayUTC } from '../lib/term';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';
import { OrganizationFormSheet } from './organization-form-sheet';
import { MembersManager } from './members-manager';

interface OrganizationDetailPageProps {
  organizationId: string;
}

const { detail: DETAIL_LABELS, profile: PROFILE_LABELS } = ORGANIZATION_LABELS;

/**
 * Whole months between two `YYYY-MM-DD` strings, floored.
 *
 * String arithmetic rather than `Date` math for the same reason `lib/term.ts`
 * avoids it: `new Date('YYYY-MM-DD')` parses as UTC but reads back through
 * local getters, which shifts the answer by a day either side of midnight.
 */
function monthsUntil(fromISO: string, toISO: string): number {
  const [fromYear, fromMonth, fromDay] = fromISO.split('-').map(Number);
  const [toYear, toMonth, toDay] = toISO.split('-').map(Number);
  const months = (toYear - fromYear) * 12 + (toMonth - fromMonth);
  return toDay < fromDay ? months - 1 : months;
}

/** Arabic month count, following the language's dual/plural agreement. */
function formatMonthsAr(count: number): string {
  if (count === 1) return 'شهر واحد';
  if (count === 2) return 'شهران';
  if (count <= 10) return `${formatNumberAr(count)} أشهر`;
  return `${formatNumberAr(count)} شهرًا`;
}

/** A value that may be absent — renders a muted dash rather than an empty cell. */
function Value({ children }: { children: React.ReactNode }) {
  if (children === null || children === undefined || children === '') {
    return <span className='text-muted-foreground'>{DETAIL_LABELS.empty}</span>;
  }
  return <>{children}</>;
}

export function OrganizationDetailPage({ organizationId }: OrganizationDetailPageProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { setTitle: setBreadcrumbTitle } = useBreadcrumbOverride();
  const canExportPdf = usePermissions().can(PERMISSIONS.REPORTS_EXPORT_PDF);

  const { data: organization } = useSuspenseQuery(organizationByIdOptions(organizationId));

  React.useEffect(() => {
    if (organization) {
      setBreadcrumbTitle(organization.name);
    }
    return () => setBreadcrumbTitle(null);
  }, [organization, setBreadcrumbTitle]);

  if (!organization) {
    notFound();
  }

  const deleteMutation = useMutation({
    ...deleteOrganizationMutation,
    onSuccess: () => {
      toast.success(ORGANIZATION_LABELS.delete.success);
      router.push('/dashboard/organizations');
    },
    onError: (error) => toast.error(error.message || ORGANIZATION_LABELS.delete.failed)
  });

  const establishedYear = organization.establishedAt
    ? organization.establishedAt.slice(0, 4)
    : null;

  // Months left on the current term. Negative once the term has lapsed, which
  // the stat renders as "ended" rather than as a negative count.
  const monthsLeft = organization.termEnd ? monthsUntil(todayUTC(), organization.termEnd) : null;

  const stats: {
    label: string;
    value: string;
    icon: React.ReactNode;
    ltr?: boolean;
  }[] = [
    {
      label: DETAIL_LABELS.stats.members,
      value: formatNumberAr(organization.members.length),
      icon: <Icons.teams className='size-4' />,
      ltr: true
    },
    {
      label: DETAIL_LABELS.stats.established,
      value: establishedYear ?? DETAIL_LABELS.empty,
      icon: <Icons.building className='size-4' />,
      ltr: true
    },
    {
      label: DETAIL_LABELS.stats.termLength,
      value:
        organization.termLength != null
          ? formatMonthsAr(organization.termLength)
          : DETAIL_LABELS.empty,
      icon: <Icons.calendar className='size-4' />
    },
    {
      label: DETAIL_LABELS.stats.remaining,
      value:
        monthsLeft === null
          ? DETAIL_LABELS.empty
          : monthsLeft <= 0
            ? DETAIL_LABELS.termEnded
            : formatMonthsAr(monthsLeft),
      icon: <Icons.clock className='size-4' />
    }
  ];

  // Grouped so each card answers one question: who they are, and when the
  // current term runs. The previous flat list repeated every value already
  // shown in the stats strip.
  const identityRows: { label: string; value: React.ReactNode }[] = [
    { label: ORGANIZATION_FIELD_LABELS.name, value: organization.name },
    {
      label: ORGANIZATION_FIELD_LABELS.nationalId,
      value: organization.nationalId ? (
        <span dir='ltr' className='tabular-nums'>
          {organization.nationalId}
        </span>
      ) : null
    },
    { label: ORGANIZATION_FIELD_LABELS.district, value: organization.district },
    {
      label: ORGANIZATION_FIELD_LABELS.classification,
      value: organization.classification
    },
    {
      label: ORGANIZATION_FIELD_LABELS.establishedAt,
      value: organization.establishedAt ? (
        <span dir='ltr'>{formatDateAr(organization.establishedAt)}</span>
      ) : null
    }
  ];

  const termRows: { label: string; value: React.ReactNode }[] = [
    {
      label: ORGANIZATION_FIELD_LABELS.termStart,
      value: organization.termStart ? (
        <span dir='ltr'>{formatDateAr(organization.termStart)}</span>
      ) : null
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termEnd,
      value: organization.termEnd ? (
        <span dir='ltr'>{formatDateAr(organization.termEnd)}</span>
      ) : null
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termLength,
      value: organization.termLength != null ? formatMonthsAr(organization.termLength) : null
    },
    {
      label: ORGANIZATION_FIELD_LABELS.directorName,
      value: organization.directorName
    },
    {
      label: ORGANIZATION_FIELD_LABELS.mobile,
      value: organization.mobile ? (
        <a
          dir='ltr'
          href={`tel:${organization.mobile}`}
          className='tabular-nums text-primary transition-colors hover:text-primary/70'
        >
          {organization.mobile}
        </a>
      ) : null
    }
  ];

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(organization.id)}
        loading={deleteMutation.isPending}
        title={ORGANIZATION_LABELS.delete.title}
        description={`«${organization.name}» — ${ORGANIZATION_LABELS.delete.description}`}
        confirmLabel={ORGANIZATION_LABELS.delete.confirm}
        cancelLabel={ORGANIZATION_LABELS.delete.cancel}
      />

      {editOpen && (
        <OrganizationFormSheet
          organization={organization}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <div className='space-y-6'>
        {/* 1. Toolbar — navigation on the leading edge, record actions on the trailing one */}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Button
            variant='ghost'
            size='sm'
            nativeButton={false}
            render={<Link href='/dashboard/organizations' />}
            className='-ms-2 text-muted-foreground transition-colors hover:text-foreground'
          >
            <Icons.chevronRight className='size-4 rtl:rotate-180' />
            {ORGANIZATION_LABELS.actions.backToList}
          </Button>

          <div className='flex items-center gap-2'>
            {/* Gated on the PDF permission rather than on "can see this page":
                the preview route IS the document, and Ctrl+P there produces the
                same file the download does. */}
            {canExportPdf && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  render={<Button variant='outline' size='sm' />}
                  title={PROFILE_LABELS.actionHint}
                >
                  <Icons.fileTypePdf className='size-4' />
                  {PROFILE_LABELS.action}
                  <Icons.chevronDown className='size-3.5 text-muted-foreground' />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      render={
                        <a
                          href={`/print/organization-profile/${organization.id}`}
                          target='_blank'
                          rel='noreferrer'
                          aria-label={PROFILE_LABELS.preview}
                        />
                      }
                    >
                      <Icons.printer className='size-4' />
                      {PROFILE_LABELS.preview}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <a
                          href={`/api/organizations/${organization.id}/profile/pdf`}
                          aria-label={PROFILE_LABELS.download}
                        />
                      }
                    >
                      <Icons.download className='size-4' />
                      {PROFILE_LABELS.download}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button onClick={() => setEditOpen(true)} variant='outline' size='sm'>
              <Icons.edit className='size-4' />
              {ORGANIZATION_LABELS.actions.edit}
            </Button>
          </div>
        </div>

        {/* 2. Stats — derived at-a-glance values, not a repeat of the record */}
        <section className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
          <div className='grid grid-cols-2 gap-px bg-border lg:grid-cols-4'>
            {stats.map((stat) => (
              <div key={stat.label} className='bg-card px-5 py-4'>
                <div className='flex items-center gap-1.5 text-muted-foreground'>
                  {stat.icon}
                  <span className='text-xs font-medium'>{stat.label}</span>
                </div>
                <p
                  dir={stat.ltr ? 'ltr' : undefined}
                  className='mt-1.5 text-xl font-semibold tabular-nums text-foreground text-start'
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. The record itself — two equal cards instead of one cramped column */}
        <section className='grid items-start gap-6 lg:grid-cols-2'>
          <DetailCard
            title={DETAIL_LABELS.sections.identity}
            icon={<Icons.building className='size-4' />}
            rows={identityRows}
          />
          <DetailCard
            title={DETAIL_LABELS.sections.term}
            icon={<Icons.calendar className='size-4' />}
            rows={termRows}
          />
        </section>

        {/* 4. Members — full width, since the table is the widest thing on the page */}
        <section className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
          <div className='flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Icons.teams className='size-5' />
              </div>
              <div>
                <h2 className='text-base font-semibold text-foreground'>
                  {ORGANIZATION_LABELS.members.sectionTitle}
                </h2>
                <p className='text-sm text-muted-foreground'>
                  {organization.members.length > 0
                    ? `${formatNumberAr(organization.members.length)} عضو`
                    : ORGANIZATION_LABELS.members.noMembers}
                </p>
              </div>
            </div>
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/organizations/${organization.id}/import-members`} />}
              variant='outline'
            >
              <Icons.fileImport className='size-4' />
              {ORGANIZATION_LABELS.members.importButton}
            </Button>
          </div>
          <div className='p-6'>
            <MembersManager organizationId={organization.id} members={organization.members} />
          </div>
        </section>

        {/* 5. Danger zone — irreversible actions live apart from the record, at the
            end of the page, so deleting cannot be mistaken for editing. */}
        <section className='rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-5'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex items-start gap-3'>
              <Icons.warning className='mt-0.5 size-5 shrink-0 text-destructive' />
              <div className='space-y-1'>
                <h2 className='text-sm font-semibold text-destructive'>
                  {DETAIL_LABELS.dangerZone.title}
                </h2>
                <p className='text-sm text-muted-foreground'>
                  {DETAIL_LABELS.dangerZone.description}
                </p>
              </div>
            </div>
            <Button variant='destructive' onClick={() => setDeleteOpen(true)} className='shrink-0'>
              <Icons.trash className='size-4' />
              {ORGANIZATION_LABELS.actions.delete}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

/** One labelled group of record fields. Label and value share a type size so
 *  the two columns read as a table rather than as a heading over a caption. */
function DetailCard({
  title,
  icon,
  rows
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
      <div className='flex items-center gap-2 border-b border-border px-6 py-4 text-muted-foreground'>
        {icon}
        <h2 className='text-sm font-semibold text-foreground'>{title}</h2>
      </div>
      <dl className='divide-y divide-border/60'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-baseline gap-4 px-6 py-3'
          >
            <dt className='text-sm text-muted-foreground'>{row.label}</dt>
            <dd className='min-w-0 text-sm font-medium leading-relaxed text-foreground'>
              <Value>{row.value}</Value>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
