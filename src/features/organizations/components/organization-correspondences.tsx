'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { correspondencesByOrganizationOptions } from '@/features/correspondences/api/queries';
import type { CorrespondenceType } from '@/features/correspondences/api/types';
import {
  CORRESPONDENCE_TYPE_BADGE_VARIANT,
  CORRESPONDENCE_TYPE_ICON
} from '@/features/correspondences/constants/labels';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { ORGANIZATION_LABELS } from '../constants/labels';

const PROFILE = ORGANIZATION_LABELS.profile;

interface OrganizationCorrespondencesProps {
  organizationId: string;
}

export function OrganizationCorrespondences({ organizationId }: OrganizationCorrespondencesProps) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.CORRESPONDENCES_READ);

  if (!canRead) return null;

  return <CorrespondencesList organizationId={organizationId} />;
}

function CorrespondencesList({ organizationId }: { organizationId: string }) {
  const { data, isLoading } = useQuery(correspondencesByOrganizationOptions(organizationId));

  const correspondences = data ?? [];

  return (
    <section className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <Icons.mail className='size-5' />
          </div>
          <div>
            <h2 className='text-base font-semibold text-foreground'>
              {PROFILE.sections.correspondences}
            </h2>
            <p className='text-sm text-muted-foreground'>
              {isLoading
                ? '…'
                : correspondences.length > 0
                  ? `${formatNumberAr(correspondences.length)} مراسلة`
                  : PROFILE.noCorrespondences}
            </p>
          </div>
        </div>
        <Button
          nativeButton={false}
          render={<Link href='/dashboard/correspondences' />}
          variant='outline'
          size='sm'
        >
          <Icons.chevronLeft className='size-4 rtl:rotate-180' />
          سجل المراسلات
        </Button>
      </div>

      <div className='p-6'>
        {isLoading && (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-12 w-full rounded-lg' />
            ))}
          </div>
        )}

        {!isLoading && correspondences.length === 0 && (
          <div className='flex items-center justify-center rounded-xl border border-dashed border-border py-12'>
            <div className='text-center'>
              <Icons.mail className='mx-auto mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm text-muted-foreground'>{PROFILE.noCorrespondences}</p>
            </div>
          </div>
        )}

        {!isLoading && correspondences.length > 0 && (
          <div className='overflow-hidden rounded-xl border border-border'>
            <table className='w-full text-right text-sm'>
              <thead>
                <tr className='border-b border-border bg-muted/50'>
                  <th className='px-4 py-3 font-medium text-muted-foreground'>#</th>
                  <th className='px-4 py-3 font-medium text-muted-foreground'>
                    {PROFILE.correspondenceSubject}
                  </th>
                  <th className='px-4 py-3 font-medium text-muted-foreground'>
                    {PROFILE.correspondenceType}
                  </th>
                  <th className='px-4 py-3 font-medium text-muted-foreground'>
                    {PROFILE.correspondenceDate}
                  </th>
                  <th className='px-4 py-3 font-medium text-muted-foreground'>
                    {PROFILE.correspondenceAttachments}
                  </th>
                </tr>
              </thead>
              <tbody>
                {correspondences.map((c, i) => (
                  <tr
                    key={c.id}
                    className='border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40'
                  >
                    <td className='px-4 py-3.5 text-muted-foreground'>{i + 1}</td>
                    <td className='px-4 py-3.5 font-medium text-foreground'>{c.name}</td>
                    <td className='px-4 py-3.5'>
                      {(() => {
                        const TypeIcon = CORRESPONDENCE_TYPE_ICON[c.type as CorrespondenceType];
                        return (
                          <Badge
                            variant={
                              CORRESPONDENCE_TYPE_BADGE_VARIANT[c.type as CorrespondenceType]
                            }
                            className='gap-1'
                          >
                            {TypeIcon && <TypeIcon className='size-3.5' />}
                            {c.type}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className='px-4 py-3.5 text-muted-foreground whitespace-nowrap'>
                      {formatDateAr(c.createdAt)}
                    </td>
                    <td className='px-4 py-3.5 text-muted-foreground'>
                      {PROFILE.attachmentCount(c.files?.length ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
