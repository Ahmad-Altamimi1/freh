'use client';

import * as React from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBreadcrumbOverride } from '@/hooks/use-breadcrumbs';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { formatBytes } from '@/lib/utils';
import { correspondenceByIdOptions } from '../api/queries';
import { deleteCorrespondenceMutation } from '../api/mutations';
import {
  CORRESPONDENCE_FIELD_LABELS,
  CORRESPONDENCE_LABELS,
  CORRESPONDENCE_TYPE_BADGE_VARIANT
} from '../constants/labels';

interface CorrespondenceDetailPageProps {
  correspondenceId: string;
  /** Gates Edit/Delete — this page's own addition; organizations' equivalent
   *  renders them unconditionally and relies solely on the server rejecting
   *  a non-admin write. */
  canEdit: boolean;
}

export function CorrespondenceDetailPage({
  correspondenceId,
  canEdit
}: CorrespondenceDetailPageProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { setTitle: setBreadcrumbTitle } = useBreadcrumbOverride();

  const { data: correspondence } = useSuspenseQuery(correspondenceByIdOptions(correspondenceId));

  React.useEffect(() => {
    if (correspondence) {
      setBreadcrumbTitle(correspondence.name);
    }
    return () => setBreadcrumbTitle(null);
  }, [correspondence, setBreadcrumbTitle]);

  if (!correspondence) {
    notFound();
  }

  const deleteMutation = useMutation({
    ...deleteCorrespondenceMutation,
    onSuccess: () => {
      toast.success(CORRESPONDENCE_LABELS.delete.success);
      router.push('/dashboard/correspondences');
    },
    onError: (error: Error) => toast.error(error.message || CORRESPONDENCE_LABELS.delete.failed)
  });

  // Hero eyebrow — type + the organization it concerns, at a glance.
  const eyebrow = [correspondence.type, correspondence.organizationName]
    .filter(Boolean)
    .join(' · ');

  // Hero description — same "label: value" pattern as organizations' own hero.
  const description = [
    `${CORRESPONDENCE_FIELD_LABELS.createdAt}: ${formatDateAr(correspondence.createdAt)}`,
    `${CORRESPONDENCE_FIELD_LABELS.updatedAt}: ${formatDateAr(correspondence.updatedAt)}`
  ].join(' · ');

  const facts: { label: string; value: string }[] = [
    { label: CORRESPONDENCE_FIELD_LABELS.type, value: correspondence.type },
    {
      label: CORRESPONDENCE_FIELD_LABELS.files,
      value: formatNumberAr(correspondence.files.length)
    },
    {
      label: CORRESPONDENCE_FIELD_LABELS.createdAt,
      value: formatDateAr(correspondence.createdAt, { month: 'short' })
    },
    {
      label: CORRESPONDENCE_FIELD_LABELS.updatedAt,
      value: formatDateAr(correspondence.updatedAt, { month: 'short' })
    }
  ];

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: CORRESPONDENCE_FIELD_LABELS.name, value: correspondence.name },
    {
      label: CORRESPONDENCE_FIELD_LABELS.type,
      value: (
        <Badge variant={CORRESPONDENCE_TYPE_BADGE_VARIANT[correspondence.type]}>
          {correspondence.type}
        </Badge>
      )
    },
    {
      label: CORRESPONDENCE_FIELD_LABELS.organizationId,
      value: (
        <Link
          href={`/dashboard/organizations/${correspondence.organizationId}`}
          className='text-primary transition-colors hover:text-primary/70'
        >
          {correspondence.organizationName}
        </Link>
      )
    },
    { label: CORRESPONDENCE_FIELD_LABELS.createdAt, value: formatDateAr(correspondence.createdAt) },
    { label: CORRESPONDENCE_FIELD_LABELS.updatedAt, value: formatDateAr(correspondence.updatedAt) }
  ];

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(correspondence.id)}
        loading={deleteMutation.isPending}
        title={CORRESPONDENCE_LABELS.delete.title}
        description={`«${correspondence.name}» — ${CORRESPONDENCE_LABELS.delete.description}`}
        confirmLabel={CORRESPONDENCE_LABELS.delete.confirm}
        cancelLabel={CORRESPONDENCE_LABELS.delete.cancel}
      />

      <div className='space-y-8'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            render={<Link href='/dashboard/correspondences' />}
            className='text-muted-foreground transition-colors hover:text-foreground'
          >
            <Icons.chevronRight className='size-4' />
            {CORRESPONDENCE_LABELS.actions.backToList}
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
                  {CORRESPONDENCE_LABELS.page.detailTitle}
                </h1>
                <p className='max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base'>
                  {description}
                </p>
              </div>

              {canEdit && (
                <div className='flex shrink-0 items-center gap-3'>
                  <Button
                    render={<Link href={`/dashboard/correspondences/${correspondence.id}/edit`} />}
                    variant='outline'
                    className='rounded-xl'
                  >
                    <Icons.edit className='size-4' />
                    {CORRESPONDENCE_LABELS.actions.edit}
                  </Button>
                </div>
              )}
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

        {/* 3. Files + definition list */}
        <section className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
          <div className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5'>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <Icons.paperclip className='size-5' />
                </div>
                <div>
                  <h2 className='text-lg font-semibold text-foreground'>
                    {CORRESPONDENCE_FIELD_LABELS.files}
                  </h2>
                  <p className='text-sm text-muted-foreground'>
                    {correspondence.files.length > 0
                      ? `${formatNumberAr(correspondence.files.length)} ملف`
                      : CORRESPONDENCE_LABELS.form.noFiles}
                  </p>
                </div>
              </div>
            </div>
            <div className='p-6'>
              {correspondence.files.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  {CORRESPONDENCE_LABELS.form.noFiles}
                </p>
              ) : (
                <div className='space-y-2'>
                  {correspondence.files.map((file) => (
                    <div
                      key={file.path}
                      className='flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4'
                    >
                      <div className='flex min-w-0 items-center gap-3'>
                        <Icons.page className='size-5 shrink-0 text-muted-foreground' />
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-medium text-foreground'>
                            {file.originalName ?? file.path}
                          </p>
                          <p dir='ltr' className='text-end text-xs text-muted-foreground'>
                            {formatBytes(file.sizeBytes)}
                          </p>
                        </div>
                      </div>
                      {file.url ? (
                        <Button
                          size='sm'
                          variant='outline'
                          render={<a href={file.url} download={file.originalName ?? undefined} />}
                          className='shrink-0 rounded-xl'
                        >
                          <Icons.download className='size-4' />
                          {CORRESPONDENCE_LABELS.actions.download}
                        </Button>
                      ) : (
                        <Button
                          size='sm'
                          variant='outline'
                          disabled
                          className='shrink-0 rounded-xl'
                        >
                          {CORRESPONDENCE_LABELS.actions.downloadUnavailable}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
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

        {canEdit && (
          <div className='flex justify-end'>
            <Button
              variant='destructive'
              onClick={() => setDeleteOpen(true)}
              className='rounded-xl'
            >
              <Icons.trash className='size-4' />
              {CORRESPONDENCE_LABELS.actions.delete}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
