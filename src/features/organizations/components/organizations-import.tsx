'use client';

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { FileUploader } from '@/components/file-uploader';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { importOrganizations, previewOrganizationsImport } from '../api/import';
import { organizationKeys } from '../api/queries';
import type { ImportIssue, ImportPreview, ImportResult } from '../api/types';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';

const LABELS = ORGANIZATION_LABELS.import;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const XLSX_ACCEPT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

/**
 * Three-step import, in a dialog over the registry it writes to.
 *
 * A dialog rather than its own route because importing is an action performed
 * *on* the table, not a place: the point of the flow is to see the rows change,
 * and navigating away and back loses the filter and scroll position that made
 * the user want to import in the first place. Committing invalidates the
 * queries, so the table behind the dialog updates in place.
 *
 * The middle step exists because the input is someone else's spreadsheet. The
 * preview runs the identical parser the commit will run, so "137 rows, these
 * eight columns mapped" states what is going to happen rather than estimating
 * it — a mis-mapped or short file is caught while nothing has been written.
 *
 * Step state is plain `useState` rather than the template's `useFormStepper`,
 * which is built around per-step Zod validation of TanStack Form values. There
 * is no form here — one file, and a server round trip between steps.
 */
type Step = 'upload' | 'preview' | 'result';

const STEP_ORDER: Step[] = ['upload', 'preview', 'result'];
const STEP_TITLES: Record<Step, string> = {
  upload: LABELS.steps.upload,
  preview: LABELS.steps.preview,
  result: LABELS.steps.result
};

interface OrganizationImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizationImportDialog({ open, onOpenChange }: OrganizationImportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState<Step>('upload');
  const [files, setFiles] = React.useState<File[]>([]);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const file = files[0];

  const reset = React.useCallback(() => {
    setFiles([]);
    setPreview(null);
    setResult(null);
    setStep('upload');
  }, []);

  const runPreview = React.useCallback(() => {
    if (!file) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const parsed = await previewOrganizationsImport(formData);
        setPreview(parsed);
        setStep('preview');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'تعذّر قراءة الملف.');
      }
    });
  }, [file]);

  const runImport = React.useCallback(() => {
    if (!file) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const imported = await importOrganizations(formData);
        setResult(imported);
        setStep('result');
        toast.success(`تم الاستيراد: ${imported.inserted} مضاف، ${imported.updated} محدّث.`);
        // The table, the facet lists and the report are all downstream of this
        // write, and they all hang off the root key.
        queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'تعذّر إتمام الاستيراد.');
      }
    });
  }, [file, queryClient]);

  /**
   * Closing discards the flow.
   *
   * Reopening mid-preview with a file the user has forgotten choosing is worse
   * than starting over — and once a result is on screen the work is finished, so
   * there is nothing to preserve either way. Blocked while a request is in
   * flight so a commit cannot be abandoned halfway.
   */
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (isPending) return;
      if (!next) reset();
      onOpenChange(next);
    },
    [isPending, onOpenChange, reset]
  );

  const canCommit =
    preview !== null && preview.missingRequired.length === 0 && preview.rowCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='flex max-h-[85vh] w-full flex-col gap-4 sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{ORGANIZATION_LABELS.page.importTitle}</DialogTitle>
          <DialogDescription>{ORGANIZATION_LABELS.page.importDescription}</DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} />

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {step === 'upload' && (
            <FileUploader
              value={files}
              onValueChange={setFiles}
              accept={XLSX_ACCEPT}
              maxSize={MAX_UPLOAD_BYTES}
              maxFiles={1}
              disabled={isPending}
            />
          )}

          {step === 'preview' && preview && <PreviewStep preview={preview} />}
          {step === 'result' && result && <ResultStep result={result} />}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button
                variant='outline'
                render={
                  // A plain anchor, not <Link>: this is a file download from a
                  // route handler, and client-side navigation would try to
                  // render the .xlsx bytes as a page.
                  // oxlint-disable-next-line no-html-link-for-pages
                  <a href='/api/organizations/template' aria-label={LABELS.template} download />
                }
              >
                <Icons.download />
                {LABELS.template}
              </Button>
              <Button onClick={runPreview} disabled={!file} isLoading={isPending}>
                {LABELS.steps.preview}
                <Icons.chevronRight className='rtl:rotate-180' />
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant='outline' onClick={reset} disabled={isPending}>
                {LABELS.back}
              </Button>
              <Button onClick={runImport} disabled={!canCommit} isLoading={isPending}>
                <Icons.upload />
                {LABELS.confirm}
              </Button>
            </>
          )}

          {step === 'result' && (
            <>
              <Button variant='outline' onClick={reset}>
                <Icons.refresh />
                {LABELS.importAnother}
              </Button>
              <Button onClick={() => handleOpenChange(false)}>
                <Icons.check />
                {LABELS.close}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Header button that opens the import dialog. */
export function OrganizationImportButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant='outline' className='text-xs md:text-sm' onClick={() => setOpen(true)}>
        <Icons.fileImport className='size-4' />
        {ORGANIZATION_LABELS.actions.import}
      </Button>
      {open && <OrganizationImportDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <ol className='flex flex-wrap items-center gap-2 text-sm'>
      {STEP_ORDER.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={step} className='flex items-center gap-2'>
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-xs tabular-nums',
                isCurrent && 'bg-primary text-primary-foreground border-primary',
                isDone && 'bg-muted text-muted-foreground'
              )}
            >
              {isDone ? <Icons.check className='size-3' /> : index + 1}
            </span>
            <span className={cn(!isCurrent && 'text-muted-foreground')}>{STEP_TITLES[step]}</span>
            {index < STEP_ORDER.length - 1 && (
              <Icons.chevronRight className='text-muted-foreground size-4 rtl:rotate-180' />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const SAMPLE_FIELDS = [
  'name',
  'district',
  'classification',
  'nationalId',
  'establishedAt',
  'directorName',
  'mobile'
] as const;

function PreviewStep({ preview }: { preview: ImportPreview }) {
  return (
    <div className='flex flex-col gap-4'>
      <div>
        <p className='font-medium'>{preview.fileName}</p>
        <p className='text-muted-foreground text-sm'>
          {LABELS.detectedColumns}: {preview.detectedHeaders.length} — {preview.rowCount} صف
        </p>
      </div>

      <div className='flex flex-wrap gap-1.5'>
        {Object.entries(preview.mapping).map(([header, field]) => (
          <Badge key={header} variant='secondary' className='font-normal'>
            <span dir='ltr'>{header}</span>
            <Icons.arrowRight className='mx-1 size-3 rtl:rotate-180' />
            {ORGANIZATION_FIELD_LABELS[field as keyof typeof ORGANIZATION_FIELD_LABELS] ?? field}
          </Badge>
        ))}
      </div>

      {preview.unmappedHeaders.length > 0 && (
        <p className='text-muted-foreground text-sm'>
          {LABELS.unmapped}: <span dir='ltr'>{preview.unmappedHeaders.join('، ')}</span>
        </p>
      )}

      {preview.missingRequired.length > 0 && (
        <p className='text-destructive text-sm font-medium'>
          {LABELS.missingRequired}: {preview.missingRequired.join('، ')}
        </p>
      )}

      {preview.sampleRows.length > 0 && (
        <div className='rounded-lg border'>
          <ScrollArea className='w-full'>
            <Table>
              <TableHeader>
                <TableRow>
                  {SAMPLE_FIELDS.map((field) => (
                    <TableHead key={field} className='whitespace-nowrap'>
                      {ORGANIZATION_FIELD_LABELS[field]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.sampleRows.map((row, index) => (
                  <TableRow key={index}>
                    {SAMPLE_FIELDS.map((field) => (
                      <TableCell key={field} className='whitespace-nowrap'>
                        {row[field] || '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function ResultStep({ result }: { result: ImportResult }) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <StatTile label={LABELS.inserted} value={result.inserted} />
        <StatTile label={LABELS.updated} value={result.updated} />
        <StatTile label={LABELS.skipped} value={result.skipped} />
        <StatTile label={LABELS.errors} value={result.errors.length} tone='destructive' />
      </div>

      <IssueTable title={LABELS.errors} issues={result.errors} tone='destructive' />
      <IssueTable title={LABELS.warnings} issues={result.warnings} />
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'destructive' }) {
  return (
    <div className='rounded-lg border p-3'>
      <p className='text-muted-foreground text-sm'>{label}</p>
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'destructive' && value > 0 && 'text-destructive'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function IssueTable({
  title,
  issues,
  tone
}: {
  title: string;
  issues: ImportIssue[];
  tone?: 'destructive';
}) {
  if (issues.length === 0) return null;

  return (
    <div className='flex flex-col gap-2'>
      <p className={cn('text-sm font-medium', tone === 'destructive' && 'text-destructive')}>
        {title} ({issues.length})
      </p>
      <div className='rounded-lg border'>
        <ScrollArea className='max-h-56'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-20'>{LABELS.issueRow}</TableHead>
                <TableHead className='w-40'>{LABELS.issueColumn}</TableHead>
                <TableHead>{LABELS.issueMessage}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, index) => (
                <TableRow key={`${issue.row}-${issue.column ?? ''}-${index}`}>
                  <TableCell className='tabular-nums'>{issue.row}</TableCell>
                  <TableCell dir='ltr'>{issue.column ?? '—'}</TableCell>
                  <TableCell>{issue.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
