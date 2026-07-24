'use client';

import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ORGANIZATION_LABELS } from '../constants/labels';
import { OrganizationFormSheet } from './organization-form-sheet';

/**
 * Header action that opens an empty create form.
 *
 * The sheet is mounted only while open. It reads the facets query with
 * `useSuspenseQuery` to populate the district and classification selects, and
 * mounting it eagerly would make every page load wait on a query nobody has
 * asked for yet.
 */
export function OrganizationCreateButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button className='text-xs md:text-sm' onClick={() => setOpen(true)}>
        <Icons.add className='size-4' />
        {ORGANIZATION_LABELS.actions.create}
      </Button>
      {open && <OrganizationFormSheet open={open} onOpenChange={setOpen} />}
    </>
  );
}
