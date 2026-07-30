'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { FileUploader } from '@/components/file-uploader';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useBreadcrumbOverride } from '@/hooks/use-breadcrumbs';
import { organizationByIdOptions } from '../api/queries';
import { importMembers, previewMembersImport } from '../api/service';
import type { ImportIssue, ImportPreview, ImportResult } from '../api/types';
import { ORGANIZATION_LABELS } from '../constants/labels';

const IMPORT_LABELS = ORGANIZATION_LABELS.import;
const FORM_LABELS = ORGANIZATION_LABELS.form;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const XLSX_ACCEPT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

type Step = 'upload' | 'preview' | 'result';

const STEP_ORDER: Step[] = ['upload', 'preview', 'result'];
const STEP_TITLES: Record<Step, string> = {
  upload: IMPORT_LABELS.steps.upload,
  preview: IMPORT_LABELS.steps.preview,
  result: IMPORT_LABELS.steps.result
};

interface MembersImportProps {
  organizationId: string;
}

const SAMPLE_FIELDS = ['name', 'nationalId', 'mobile', 'jobTitle'] as const;

const FIELD_LABELS: Record<string, string> = {
  name: FORM_LABELS.memberName,
  nationalId: FORM_LABELS.memberNationalId,
  mobile: FORM_LABELS.memberMobile,
  jobTitle: FORM_LABELS.memberJobTitle
};

export function MembersImport({ organizationId }: MembersImportProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: organization } = useSuspenseQuery(organizationByIdOptions(organizationId));
  const { setSegmentOverride } = useBreadcrumbOverride();
  const [step, setStep] = React.useState<Step>('upload');

  React.useEffect(() => {
    if (organization) {
      setSegmentOverride(2, organization.name);
    }
    return () => setSegmentOverride(2, null);
  }, [organization, setSegmentOverride]);
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
        const parsed = await previewMembersImport(formData);
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
        const imported = await importMembers(organizationId, formData);
        setResult(imported);
        setStep('result');
        toast.success(ORGANIZATION_LABELS.members.importSuccess);
        queryClient.invalidateQueries({ queryKey: ['organizations', 'detail', organizationId] });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : ORGANIZATION_LABELS.members.importFailed
        );
      }
    });
  }, [file, organizationId, queryClient]);

  const canCommit =
    preview !== null && preview.missingRequired.length === 0 && preview.rowCount > 0;

  return (
    <div className='mx-auto max-w-3xl space-y-6'>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => router.push(`/dashboard/organizations/${organizationId}`)}
          className='text-[#9CA3AF] transition-colors hover:text-white'
        >
          <Icons.chevronRight className='size-4 rtl:rotate-180' />
          {ORGANIZATION_LABELS.members.backToDetail}
        </Button>
      </div>

      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>
          {ORGANIZATION_LABELS.members.importTitle}
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          {ORGANIZATION_LABELS.members.importDescription}
        </p>
      </div>

      <StepIndicator current={step} />

      <div className='min-h-0'>
        {step === 'upload' && (
          <div className='space-y-4'>
            <FileUploader
              value={files}
              onValueChange={setFiles}
              accept={XLSX_ACCEPT}
              maxSize={MAX_UPLOAD_BYTES}
              maxFiles={1}
              disabled={isPending}
            />
            <div className='flex justify-between'>
              <Button
                variant='outline'
                render={
                  <a
                    href='/api/organizations/members-template'
                    aria-label={IMPORT_LABELS.template}
                    download
                  />
                }
              >
                <Icons.download />
                {IMPORT_LABELS.template}
              </Button>
              <Button onClick={runPreview} disabled={!file} isLoading={isPending}>
                {IMPORT_LABELS.steps.preview}
                <Icons.chevronRight className='rtl:rotate-180' />
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && <PreviewStep preview={preview} />}
        {step === 'result' && result && (
          <ResultStep result={result} organizationId={organizationId} />
        )}
      </div>

      {step === 'preview' && (
        <div className='flex justify-between'>
          <Button variant='outline' onClick={reset} disabled={isPending}>
            {IMPORT_LABELS.back}
          </Button>
          <Button onClick={runImport} disabled={!canCommit} isLoading={isPending}>
            <Icons.upload />
            {IMPORT_LABELS.confirm}
          </Button>
        </div>
      )}

      {step === 'result' && (
        <div className='flex justify-between'>
          <Button variant='outline' onClick={reset}>
            <Icons.refresh />
            {ORGANIZATION_LABELS.members.importAnother}
          </Button>
          <Button onClick={() => router.push(`/dashboard/organizations/${organizationId}`)}>
            <Icons.check />
            {ORGANIZATION_LABELS.members.backToDetail}
          </Button>
        </div>
      )}
    </div>
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

function PreviewStep({ preview }: { preview: ImportPreview }) {
  return (
    <div className='flex flex-col gap-4'>
      <div>
        <p className='font-medium'>{preview.fileName}</p>
        <p className='text-muted-foreground text-sm'>
          {IMPORT_LABELS.detectedColumns}: {preview.detectedHeaders.length} — {preview.rowCount} صف
        </p>
      </div>

      <div className='flex flex-wrap gap-1.5'>
        {Object.entries(preview.mapping).map(([header, field]) => (
          <Badge key={header} variant='secondary' className='font-normal'>
            <span dir='ltr'>{header}</span>
            <Icons.arrowRight className='mx-1 size-3 rtl:rotate-180' />
            {FIELD_LABELS[field as string] ?? field}
          </Badge>
        ))}
      </div>

      {preview.unmappedHeaders.length > 0 && (
        <p className='text-muted-foreground text-sm'>
          {IMPORT_LABELS.unmapped}: <span dir='ltr'>{preview.unmappedHeaders.join('، ')}</span>
        </p>
      )}

      {preview.missingRequired.length > 0 && (
        <p className='text-destructive text-sm font-medium'>
          {IMPORT_LABELS.missingRequired}: {preview.missingRequired.join('، ')}
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
                      {FIELD_LABELS[field]}
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

function ResultStep({ result, organizationId }: { result: ImportResult; organizationId: string }) {
  const router = useRouter();

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <StatTile label={IMPORT_LABELS.inserted} value={result.inserted} />
        <StatTile label={IMPORT_LABELS.skipped} value={result.skipped} />
        <StatTile label={IMPORT_LABELS.errors} value={result.errors.length} tone='destructive' />
      </div>

      <IssueTable title={IMPORT_LABELS.errors} issues={result.errors} tone='destructive' />
      <IssueTable title={IMPORT_LABELS.warnings} issues={result.warnings} />
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
                <TableHead className='w-20'>{IMPORT_LABELS.issueRow}</TableHead>
                <TableHead className='w-40'>{IMPORT_LABELS.issueColumn}</TableHead>
                <TableHead>{IMPORT_LABELS.issueMessage}</TableHead>
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
