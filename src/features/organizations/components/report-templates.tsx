'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  deleteReportTemplateMutation,
  invalidateReportTemplates,
  saveReportTemplateMutation
} from '../api/mutations';
import { reportTemplatesQueryOptions } from '../api/queries';
import type { ReportDefinition } from '../api/types';
import { ORGANIZATION_LABELS } from '../constants/labels';

const BUILDER = ORGANIZATION_LABELS.builder;

/**
 * Saved report definitions.
 *
 * Reading the list is not gated — a template is a shape, not data, and hiding
 * the shapes from someone allowed to run reports only makes them rebuild one by
 * hand. Writing is: saving and deleting both sit behind
 * `REPORTS_TEMPLATE_MANAGE`, and the mutations re-check it server-side.
 */
interface ReportTemplatesCardProps {
  /** The definition a save would capture. */
  definition: ReportDefinition;
  /** Whether that definition is complete enough to be worth saving. */
  isValid: boolean;
  onLoad: (definition: ReportDefinition) => void;
}

export function ReportTemplatesCard({ definition, isValid, onLoad }: ReportTemplatesCardProps) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.REPORTS_TEMPLATE_MANAGE);

  const [templateName, setTemplateName] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const { data: templates = [] } = useQuery(reportTemplatesQueryOptions());

  const saveMutation = useMutation({
    ...saveReportTemplateMutation,
    // Overriding `onSuccess` replaces the options' own handler rather than
    // adding to it, so the invalidation has to be repeated here — without it
    // the new template does not appear until the page is reloaded.
    onSuccess: () => {
      invalidateReportTemplates();
      toast.success(BUILDER.templateSaved);
      setTemplateName('');
    },
    onError: (error) => toast.error(error.message || BUILDER.templateSaveFailed)
  });

  const deleteMutation = useMutation({
    ...deleteReportTemplateMutation,
    onSuccess: () => {
      invalidateReportTemplates();
      toast.success(BUILDER.templateDeleted);
      setPendingDelete(null);
    },
    onError: (error) => toast.error(error.message || BUILDER.templateDeleteFailed)
  });

  return (
    <Card>
      <AlertModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        loading={deleteMutation.isPending}
        title={BUILDER.deleteTemplateTitle}
        description={BUILDER.deleteTemplateDescription}
        confirmLabel={ORGANIZATION_LABELS.delete.confirm}
        cancelLabel={ORGANIZATION_LABELS.delete.cancel}
      />

      <CardHeader>
        <CardTitle className='text-base'>{BUILDER.templates}</CardTitle>
      </CardHeader>

      <CardContent className='flex flex-col gap-3'>
        {templates.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{BUILDER.noTemplates}</p>
        ) : (
          <ul className='-mx-2 flex flex-col'>
            {templates.map((template) => (
              <li key={template.id} className='hover:bg-accent/50 flex items-center rounded-md'>
                <button
                  type='button'
                  onClick={() => onLoad(template.definition)}
                  className='min-w-0 flex-1 truncate px-2 py-1.5 text-start text-sm'
                >
                  {template.name}
                </button>
                {canManage && (
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`${ORGANIZATION_LABELS.actions.delete}: ${template.name}`}
                    onClick={() => setPendingDelete(template.id)}
                    className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-7 shrink-0'
                  >
                    <Icons.trash className='size-4' />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className='flex gap-2 border-t pt-3'>
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder={BUILDER.templateName}
              aria-label={BUILDER.templateName}
              className='h-9'
            />
            <Button
              variant='outline'
              className='shrink-0'
              disabled={!templateName.trim() || !isValid || saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  name: templateName,
                  description: '',
                  definition
                })
              }
            >
              {BUILDER.saveTemplate}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
