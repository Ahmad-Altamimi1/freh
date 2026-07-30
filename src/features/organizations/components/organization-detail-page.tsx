'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as React from 'react';
import type { Icon } from '@/components/icons';

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
import { cn } from '@/lib/utils';

interface OrganizationDetailPageProps {
  organizationId: string;
}

type FieldInfo = {
  icon: Icon;
  label: string;
  value: React.ReactNode;
  iconBg: string;
};

function InfoTile({ icon: IconCmp, label, value, iconBg }: FieldInfo) {
  return (
    <div className='group flex items-start gap-4 rounded-xl border border-white/[0.06] bg-[#141A24] p-5 transition-all duration-200 hover:border-white/[0.12] hover:shadow-lg hover:shadow-purple-500/5'>
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 group-hover:border-white/[0.15] group-hover:shadow-md',
          iconBg
        )}
      >
        <IconCmp className='size-5 text-white' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-[13px] font-medium leading-none text-[#9CA3AF]'>{label}</p>
        <div className='mt-2 text-[17px] font-semibold leading-tight text-white'>{value}</div>
      </div>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className='flex items-start gap-4 rounded-xl border border-white/[0.06] bg-[#141A24] p-5'>
      <div className='size-11 animate-pulse rounded-xl bg-white/[0.06]' />
      <div className='flex-1 space-y-2'>
        <div className='h-3 w-20 animate-pulse rounded bg-white/[0.06]' />
        <div className='h-5 w-32 animate-pulse rounded bg-white/[0.06]' />
      </div>
    </div>
  );
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

  const fields: FieldInfo[] = [
    {
      icon: Icons.building,
      label: ORGANIZATION_FIELD_LABELS.name,
      value: <span className='font-medium'>{organization.name}</span>,
      iconBg: 'border-purple-500/30 bg-purple-500/10'
    },
    {
      icon: Icons.badgeCheck,
      label: ORGANIZATION_FIELD_LABELS.nationalId,
      value: organization.nationalId ? (
        <span dir='ltr' className='tabular-nums tracking-tight'>
          {organization.nationalId}
        </span>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-blue-500/30 bg-blue-500/10'
    },
    {
      icon: Icons.workspace,
      label: ORGANIZATION_FIELD_LABELS.district,
      value: (
        <Badge variant='outline' className='border-white/[0.12] bg-white/[0.04] text-white'>
          {organization.district}
        </Badge>
      ),
      iconBg: 'border-emerald-500/30 bg-emerald-500/10'
    },
    {
      icon: Icons.filter,
      label: ORGANIZATION_FIELD_LABELS.classification,
      value: organization.classification ? (
        <Badge variant='secondary' className='border-white/[0.08] bg-white/[0.06] text-white/90'>
          {organization.classification}
        </Badge>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-amber-500/30 bg-amber-500/10'
    },
    {
      icon: Icons.calendar,
      label: ORGANIZATION_FIELD_LABELS.establishedAt,
      value: organization.establishedAt ? (
        <span className='whitespace-nowrap'>{formatDateAr(organization.establishedAt)}</span>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-rose-500/30 bg-rose-500/10'
    },
    {
      icon: Icons.clock,
      label: ORGANIZATION_FIELD_LABELS.termStart,
      value: organization.termStart ? (
        <span className='whitespace-nowrap'>{formatDateAr(organization.termStart)}</span>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-cyan-500/30 bg-cyan-500/10'
    },
    {
      icon: Icons.clock,
      label: ORGANIZATION_FIELD_LABELS.termEnd,
      value: organization.termEnd ? (
        <span className='whitespace-nowrap'>{formatDateAr(organization.termEnd)}</span>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-violet-500/30 bg-violet-500/10'
    },
    {
      icon: Icons.calendar,
      label: ORGANIZATION_FIELD_LABELS.termLength,
      value: organization.termLength ? (
        <span dir='ltr' className='tabular-nums'>
          {formatNumberAr(organization.termLength)}
        </span>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-orange-500/30 bg-orange-500/10'
    },
    {
      icon: Icons.user,
      label: ORGANIZATION_FIELD_LABELS.directorName,
      value: organization.directorName ? (
        <span>{organization.directorName}</span>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-sky-500/30 bg-sky-500/10'
    },
    {
      icon: Icons.phone,
      label: ORGANIZATION_FIELD_LABELS.mobile,
      value: organization.mobile ? (
        <a
          dir='ltr'
          href={`tel:${organization.mobile}`}
          className='tabular-nums text-white transition-colors hover:text-purple-400'
        >
          {organization.mobile}
        </a>
      ) : (
        <span className='text-[#9CA3AF]'>—</span>
      ),
      iconBg: 'border-green-500/30 bg-green-500/10'
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
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            render={<Link href='/dashboard/organizations' />}
            className='text-[#9CA3AF] transition-colors hover:text-white'
          >
            <Icons.chevronRight className='size-4' />
            {ORGANIZATION_LABELS.actions.backToList}
          </Button>
        </div>

        <div
          className='overflow-hidden rounded-[18px] border border-white/[0.06] shadow-lg shadow-black/20'
          style={{
            background:
              'linear-gradient(135deg, rgba(20,26,36,0.95) 0%, rgba(15,20,30,0.98) 50%, rgba(20,26,36,0.95) 100%)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <div className='p-8'>
            <div className='flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between'>
              <div className='flex items-start gap-5'>
                <div className='flex size-16 shrink-0 items-center justify-center rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/20 to-purple-500/5 shadow-lg shadow-purple-500/10'>
                  <Icons.building className='size-8 text-purple-400' />
                </div>
                <div>
                  <h1 className='text-[28px] font-semibold leading-tight tracking-tight text-white'>
                    {organization.name}
                  </h1>
                  <p className='mt-1.5 text-[14px] font-medium leading-none text-[#9CA3AF]'>
                    {ORGANIZATION_FIELD_LABELS.district} — {organization.district}
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-3'>
                <Button
                  onClick={() => setEditOpen(true)}
                  className='rounded-xl border-white/[0.08] bg-white/[0.06] text-white shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.12] hover:shadow-md'
                >
                  <Icons.edit className='size-4' />
                  {ORGANIZATION_LABELS.actions.edit}
                </Button>
                <Button
                  variant='destructive'
                  onClick={() => setDeleteOpen(true)}
                  className='rounded-xl border-transparent bg-[#EF5350]/90 text-white shadow-sm transition-all duration-200 hover:bg-[#EF5350] hover:shadow-md hover:shadow-red-500/20'
                >
                  <Icons.trash className='size-4' />
                  {ORGANIZATION_LABELS.actions.delete}
                </Button>
              </div>
            </div>
          </div>

          <div className='h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent' />

          <div className='p-8'>
            <React.Suspense
              fallback={
                <div className='grid gap-5 sm:grid-cols-2'>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <FieldSkeleton key={i} />
                  ))}
                </div>
              }
            >
              <div className='grid gap-5 sm:grid-cols-2'>
                {fields.map((field) => (
                  <InfoTile key={field.label} {...field} />
                ))}
              </div>
            </React.Suspense>
          </div>
        </div>

        <div
          className='overflow-hidden rounded-[18px] border border-white/[0.06] shadow-lg shadow-black/20'
          style={{
            background:
              'linear-gradient(135deg, rgba(20,26,36,0.95) 0%, rgba(15,20,30,0.98) 50%, rgba(20,26,36,0.95) 100%)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <div className='p-8'>
            <div className='mb-6 flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10'>
                  <Icons.teams className='size-5 text-indigo-400' />
                </div>
                <div>
                  <h2 className='text-lg font-semibold text-white'>
                    {ORGANIZATION_LABELS.members.sectionTitle}
                  </h2>
                  <p className='text-sm text-[#9CA3AF]'>
                    {organization.members.length > 0
                      ? `${organization.members.length} عضو`
                      : ORGANIZATION_LABELS.members.noMembers}
                  </p>
                </div>
              </div>
              <Button
                render={
                  <Link href={`/dashboard/organizations/${organization.id}/import-members`} />
                }
                className='rounded-xl border-white/[0.08] bg-white/[0.06] text-white shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.12] hover:shadow-md'
              >
                <Icons.fileImport className='size-4' />
                {ORGANIZATION_LABELS.members.importButton}
              </Button>
            </div>

            <MembersManager organizationId={organization.id} members={organization.members} />
          </div>
        </div>
      </div>
    </>
  );
}
