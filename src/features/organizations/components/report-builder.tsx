'use client';

import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  REPORT_COLUMNS,
  REPORT_GROUP_BY,
  REPORT_SECTIONS,
  type ReportColumn,
  type ReportDefinition,
  type ReportGroupBy,
  type ReportSection
} from '../api/types';
import { ORGANIZATION_FIELD_LABELS, ORGANIZATION_LABELS } from '../constants/labels';

const BUILDER = ORGANIZATION_LABELS.builder;

/**
 * Edits the *shape* of the document — everything except which rows it covers.
 *
 * Controlled rather than stateful: the definition is also what the export links
 * encode and what a saved template restores, so a single owner above holds it
 * and this component only describes how it is edited.
 *
 * Sections and columns are toggle pills rather than checkbox lists. Eleven
 * checkboxes in a three-column grid read as a form to fill in; the same eleven
 * as pills read as a set with some members chosen, which is what they are — and
 * the pills wrap to the available width instead of forcing a fixed grid.
 */
interface ReportBuilderProps {
  definition: ReportDefinition;
  onDefinitionChange: React.Dispatch<React.SetStateAction<ReportDefinition>>;
}

export function ReportBuilder({ definition, onDefinitionChange }: ReportBuilderProps) {
  function toggleSection(section: ReportSection) {
    onDefinitionChange((current) => ({
      ...current,
      // Filtering the canonical list keeps the printed blocks in a stable order
      // no matter which order they were ticked in.
      sections: current.sections.includes(section)
        ? current.sections.filter((item) => item !== section)
        : [...REPORT_SECTIONS].filter((item) => item === section || current.sections.includes(item))
    }));
  }

  function toggleColumn(column: ReportColumn) {
    onDefinitionChange((current) => ({
      ...current,
      columns: current.columns.includes(column)
        ? current.columns.filter((item) => item !== column)
        : [...REPORT_COLUMNS].filter((item) => item === column || current.columns.includes(item))
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{BUILDER.shape}</CardTitle>
        <CardDescription>{BUILDER.shapeDescription}</CardDescription>
      </CardHeader>

      <CardContent className='flex flex-col gap-6'>
        <div className='grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]'>
          <div className='grid gap-2'>
            <Label htmlFor='report-title'>{BUILDER.reportTitle}</Label>
            <Input
              id='report-title'
              value={definition.title}
              onChange={(event) =>
                onDefinitionChange((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='report-group-by'>{BUILDER.groupBy}</Label>
            <Select
              items={REPORT_GROUP_BY.map((value) => ({
                value,
                label: ORGANIZATION_LABELS.groupBy[value]
              }))}
              value={definition.groupBy}
              onValueChange={(value) =>
                onDefinitionChange((current) => ({
                  ...current,
                  groupBy: (value as ReportGroupBy) ?? current.groupBy
                }))
              }
            >
              <SelectTrigger id='report-group-by' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_GROUP_BY.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ORGANIZATION_LABELS.groupBy[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <FieldSet
          legend={BUILDER.sections}
          hint={BUILDER.sectionsHint}
          error={definition.sections.length === 0 ? BUILDER.selectAtLeastOneSection : null}
        >
          {REPORT_SECTIONS.map((section) => (
            <TogglePill
              key={section}
              selected={definition.sections.includes(section)}
              onClick={() => toggleSection(section)}
            >
              {ORGANIZATION_LABELS.sections[section]}
            </TogglePill>
          ))}
        </FieldSet>

        <FieldSet
          legend={BUILDER.columns}
          hint={BUILDER.columnsHint}
          error={definition.columns.length === 0 ? BUILDER.selectAtLeastOneColumn : null}
          aside={
            <div className='flex items-center gap-1'>
              <span className='text-muted-foreground me-1 text-xs tabular-nums'>
                {BUILDER.columnsCount(definition.columns.length, REPORT_COLUMNS.length)}
              </span>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs'
                disabled={definition.columns.length === REPORT_COLUMNS.length}
                onClick={() =>
                  onDefinitionChange((current) => ({
                    ...current,
                    columns: [...REPORT_COLUMNS]
                  }))
                }
              >
                {BUILDER.selectAllColumns}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs'
                disabled={definition.columns.length === 0}
                onClick={() => onDefinitionChange((current) => ({ ...current, columns: [] }))}
              >
                {BUILDER.clearColumns}
              </Button>
            </div>
          }
        >
          {REPORT_COLUMNS.map((column) => (
            <TogglePill
              key={column}
              selected={definition.columns.includes(column)}
              onClick={() => toggleColumn(column)}
            >
              {ORGANIZATION_FIELD_LABELS[column]}
            </TogglePill>
          ))}
        </FieldSet>
      </CardContent>
    </Card>
  );
}

function FieldSet({
  legend,
  hint,
  error,
  aside,
  children
}: {
  legend: string;
  hint: string;
  error: string | null;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <legend className='text-sm font-medium'>{legend}</legend>
          <p className='text-muted-foreground text-xs'>{hint}</p>
        </div>
        {aside}
      </div>
      <div className='flex flex-wrap gap-2'>{children}</div>
      {error && <p className='text-destructive text-xs'>{error}</p>}
    </fieldset>
  );
}

/**
 * A checkbox that looks like what it controls.
 *
 * `role='checkbox'` with `aria-checked` rather than a styled `<input>`: the
 * control is a single button whose whole surface toggles, and a visually hidden
 * input would give screen readers a second, differently-named target for it.
 */
function TogglePill({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      role='checkbox'
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-full border py-1.5 ps-1.5 pe-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
        selected
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/30'
        )}
      >
        {selected && <Icons.check className='size-3' />}
      </span>
      {children}
    </button>
  );
}
