'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ALL_PERMISSIONS, permissionLabel } from '@/lib/auth/permissions';
import { deleteRoleMutation, invalidateRoles } from '../api/mutations';
import { rolesQueryOptions } from '../api/queries';
import type { Role } from '../api/types';
import { ROLE_DELETE_LABELS, ROLE_FIELD_LABELS, ROLE_TABLE_LABELS } from '../constants/labels';
import { RoleFormSheet } from './role-form-sheet';

/**
 * The roles list.
 *
 * Cards rather than a data table: a role's substance is *which permissions it
 * grants*, which is a wrapping set of a dozen chips, not a cell. There are only
 * ever a handful of roles, so paging, sorting and faceted filtering — the
 * reasons to reach for `useDataTable` — would all be scaffolding around a list
 * that fits on one screen.
 */
export function RolesListing() {
  const { data: roles } = useSuspenseQuery(rolesQueryOptions());
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Role | null>(null);

  const deleteMutation = useMutation({
    ...deleteRoleMutation,
    // See the note on `invalidateRoles`: this override replaces the handler in
    // the mutation options, so the invalidation is repeated here.
    onSuccess: () => {
      invalidateRoles();
      toast.success(ROLE_DELETE_LABELS.success);
      setPendingDelete(null);
    },
    onError: (error: Error) => toast.error(error.message || ROLE_DELETE_LABELS.failed)
  });

  if (roles.length === 0) {
    return <p className='text-muted-foreground py-12 text-center'>{ROLE_TABLE_LABELS.empty}</p>;
  }

  return (
    <>
      <AlertModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        loading={deleteMutation.isPending}
        title={ROLE_DELETE_LABELS.title}
        // Naming the role being deleted is what makes the confirmation worth
        // showing — "are you sure?" alone is a reflex click.
        description={`«${pendingDelete?.name ?? ''}» — ${ROLE_DELETE_LABELS.description}`}
        confirmLabel={ROLE_DELETE_LABELS.confirm}
        cancelLabel={ROLE_DELETE_LABELS.cancel}
      />

      {/* Mounted only while open so the form seeds from this row and is torn
          down afterwards, rather than holding a stale copy of every role. */}
      {editing && (
        <RoleFormSheet
          role={editing}
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      <div className='grid gap-4 lg:grid-cols-2'>
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            onEdit={() => setEditing(role)}
            onDelete={() => setPendingDelete(role)}
          />
        ))}
      </div>
    </>
  );
}

function RoleCard({
  role,
  onEdit,
  onDelete
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className='space-y-3 pt-6'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='font-medium'>{role.name}</h3>
              {role.isSystem && <Badge variant='secondary'>{ROLE_TABLE_LABELS.systemBadge}</Badge>}
              {/* LTR island: the key is ASCII, and the bidi algorithm would
                  otherwise reorder it against the Arabic around it. */}
              <code className='text-muted-foreground text-xs' dir='ltr'>
                {role.key}
              </code>
            </div>
            {role.description && (
              <p className='text-muted-foreground mt-1 text-sm'>{role.description}</p>
            )}
          </div>

          <div className='flex shrink-0 items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              aria-label={ROLE_TABLE_LABELS.edit}
              onClick={onEdit}
            >
              <Icons.edit className='size-4' />
            </Button>
            {/* The system role has no delete affordance at all — the service
                refuses it, and offering a button that always fails is worse
                than not offering one. */}
            {!role.isSystem && (
              <Button
                variant='ghost'
                size='icon'
                aria-label={ROLE_TABLE_LABELS.delete}
                onClick={onDelete}
                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              >
                <Icons.trash className='size-4' />
              </Button>
            )}
          </div>
        </div>

        <p className='text-muted-foreground text-xs'>
          {ROLE_FIELD_LABELS.members}:{' '}
          {role.memberCount === 0
            ? ROLE_TABLE_LABELS.noMembers
            : ROLE_TABLE_LABELS.memberCount(role.memberCount)}
        </p>

        <PermissionChips role={role} />
      </CardContent>
    </Card>
  );
}

/** Collapses a full grant to one chip — thirty chips say less than "all". */
function PermissionChips({ role }: { role: Role }) {
  if (role.permissions.length === 0) {
    return <p className='text-muted-foreground text-xs'>{ROLE_TABLE_LABELS.noPermissions}</p>;
  }

  if (role.permissions.length === ALL_PERMISSIONS.length) {
    return <Badge variant='outline'>{ROLE_TABLE_LABELS.allPermissions}</Badge>;
  }

  return (
    <div className='flex flex-wrap gap-1'>
      {role.permissions.map((permission) => (
        <Badge key={permission} variant='outline' className='font-normal'>
          {permissionLabel(permission)}
        </Badge>
      ))}
    </div>
  );
}
