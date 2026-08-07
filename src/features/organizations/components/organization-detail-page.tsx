'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertModal } from '@/components/modal/alert-modal';
import { useBreadcrumbOverride } from '@/hooks/use-breadcrumbs';
import { organizationByIdOptions } from '../api/queries';
import { deleteOrganizationMutation } from '../api/mutations';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';
import { OrganizationFormSheet } from './organization-form-sheet';
import { MembersManager } from './members-manager';

interface OrganizationDetailPageProps {
  organizationId: string;
}

/**
 * Renders Western digits as Arabic-Indic (٠-٩).
 *
 * The app's formatters intentionally emit Western digits (`nu-latn`), but the
 * facts strip is a display accent, so its numerals are converted locally rather
 * than changing the shared formatting helpers.
 */
function toArabicIndic(value: string): string {
  return value.replace(/\d/g, (digit) => String.fromCharCode(0x0660 + digit.charCodeAt(0) - 0x30));
}

/** Formats a number and converts it to Arabic-Indic digits, without grouping separators. */
function arabicIndicNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return toArabicIndic(formatNumberAr(value).replace(/\D/g, ''));
}

export function OrganizationDetailPage({ organizationId }: OrganizationDetailPageProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { setTitle: setBreadcrumbTitle } = useBreadcrumbOverride();

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
    ? Number(organization.establishedAt.slice(0, 4)) || null
    : null;

  // Hero eyebrow — derived from the founding year and the district.
  const eyebrow = [
    establishedYear != null ? `تأسست عام ${arabicIndicNumber(establishedYear)}` : null,
    organization.district || null
  ]
    .filter(Boolean)
    .join(' · ');

  // Hero description — district + classification, with a generic fallback.
  const description =
    [
      organization.classification
        ? `${ORGANIZATION_FIELD_LABELS.classification}: ${organization.classification}`
        : null,
      organization.district
        ? `${ORGANIZATION_FIELD_LABELS.district}: ${organization.district}`
        : null
    ]
      .filter(Boolean)
      .join(' · ') || 'جمعية ثقافية تعمل في محافظة إربد';

  const facts: { label: string; value: string }[] = [
    {
      label: ORGANIZATION_FIELD_LABELS.establishedAt,
      value: arabicIndicNumber(establishedYear)
    },
    {
      label: ORGANIZATION_FIELD_LABELS.district,
      value: organization.district || '—'
    },
    {
      label: ORGANIZATION_FIELD_LABELS.classification,
      value: organization.classification || '—'
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termLength,
      value: arabicIndicNumber(organization.termLength)
    }
  ];

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: ORGANIZATION_FIELD_LABELS.name, value: organization.name },
    {
      label: ORGANIZATION_FIELD_LABELS.nationalId,
      value: organization.nationalId ? (
        <span dir='ltr' className='tabular-nums tracking-tight'>
          {organization.nationalId}
        </span>
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
    { label: ORGANIZATION_FIELD_LABELS.district, value: organization.district },
    {
      label: ORGANIZATION_FIELD_LABELS.classification,
      value: organization.classification || <span className='text-muted-foreground'>—</span>
    },
    {
      label: ORGANIZATION_FIELD_LABELS.establishedAt,
      value: organization.establishedAt ? (
        formatDateAr(organization.establishedAt)
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termStart,
      value: organization.termStart ? (
        formatDateAr(organization.termStart)
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termEnd,
      value: organization.termEnd ? (
        formatDateAr(organization.termEnd)
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
    {
      label: ORGANIZATION_FIELD_LABELS.termLength,
      value:
        organization.termLength != null ? (
          formatNumberAr(organization.termLength)
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
    },
    {
      label: ORGANIZATION_FIELD_LABELS.directorName,
      value: organization.directorName || <span className='text-muted-foreground'>—</span>
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
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
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

      <div className='space-y-8'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            render={<Link href='/dashboard/organizations' />}
            className='text-muted-foreground transition-colors hover:text-foreground'
          >
            <Icons.chevronRight className='size-4' />
            {ORGANIZATION_LABELS.actions.backToList}
          </Button>
        </div>

        <div>
          {/* 1. Hero */}
          <section className='rounded-2xl border border-border bg-card px-6 pb-16 pt-10 shadow-sm sm:px-10'>
            <div className='flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between'>
              <div className='space-y-4'>
                {eyebrow && (
                  <Badge variant='outline' className='border-border bg-muted text-muted-foreground'>
                    {eyebrow}
                  </Badge>
                )}
                <h1 className='text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl'>
                  {ORGANIZATION_LABELS.page.detailTitle}
                </h1>
                <p className='max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base'>
                  {description}
                </p>
              </div>

              <div className='flex shrink-0 items-center gap-3'>
                <Button onClick={() => setEditOpen(true)} variant='outline' className='rounded-xl'>
                  <Icons.edit className='size-4' />
                  {ORGANIZATION_LABELS.actions.edit}
                </Button>
              </div>
            </div>
          </section>

          {/* 2. Facts strip — overlaps the hero */}
          <section className='relative z-10 -mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm lg:grid-cols-4'>
            {facts.map((fact) => (
              <div
                key={fact.label}
                className='flex flex-col items-center justify-center gap-1.5 bg-card px-4 py-6 text-center'
              >
                <span className='text-xl font-bold text-primary sm:text-1xl'>{fact.value}</span>
                <span className='text-xs font-medium text-muted-foreground'>{fact.label}</span>
              </div>
            ))}
          </section>
        </div>

        {/* 3. Members + definition list */}
        <section className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
          <div className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5'>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <Icons.teams className='size-5' />
                </div>
                <div>
                  <h2 className='text-lg font-semibold text-foreground'>
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
                render={
                  <Link href={`/dashboard/organizations/${organization.id}/import-members`} />
                }
                variant='outline'
                className='rounded-xl'
              >
                <Icons.fileImport className='size-4' />
                {ORGANIZATION_LABELS.members.importButton}
              </Button>
            </div>
            <div className='p-6'>
              <MembersManager organizationId={organization.id} members={organization.members} />
            </div>
          </div>

          <div className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
            {/* <div className='border-b border-border px-6 py-4'>
              <h2 className='text-base font-semibold text-foreground'>
                {ORGANIZATION_LABELS.page.detailTitle}
              </h2>
            </div> */}
            <dl className='divide-y divide-border/50'>
              {infoRows.map((row) => (
                <div
                  key={row.label}
                  className='flex items-center justify-between gap-6 px-6 py-3.5'
                >
                  <dt className='shrink-0 text-sm text-muted-foreground'>{row.label}</dt>
                  <dd className='min-w-0 text-right text-xs font-medium leading-snug text-foreground'>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className='flex justify-end'>
          <Button variant='destructive' onClick={() => setDeleteOpen(true)} className='rounded-xl'>
            <Icons.trash className='size-4' />
            {ORGANIZATION_LABELS.actions.delete}
          </Button>
        </div>
      </div>
    </>
  );
}
