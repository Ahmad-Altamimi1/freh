'use client';

import * as React from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ORGANIZATION_LABELS } from '../constants/labels';
import { parseReportQuery, type ParsedReportQuery } from '../lib/report-query';

const ASK = ORGANIZATION_LABELS.ask;

interface ReportAskBarProps {
  /** Distinct district values, for exact-match detection in the query. */
  districts: string[];
  /** Distinct classification values. */
  classifications: string[];
  /** Applies the parsed query to the workspace's criteria and shape. */
  onApply: (parsed: ParsedReportQuery) => void;
}

/**
 * The natural-language entry point to the report builder.
 *
 * A thin control: it parses on submit with the local `parseReportQuery` (no
 * network, no key) and hands the result up. It keeps the last parse's
 * `understood` list on screen so the user can see exactly what the sentence was
 * turned into — the report below is the real output, this is just the fast way
 * in. `print:hidden` because it is a control, not part of the document.
 */
export function ReportAskBar({ districts, classifications, onApply }: ReportAskBarProps) {
  const [query, setQuery] = React.useState('');
  const [lastParsed, setLastParsed] = React.useState<ParsedReportQuery | null>(null);

  const submit = React.useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const parsed = parseReportQuery({ query: trimmed, districts, classifications });
    setLastParsed(parsed);
    onApply(parsed);
  }, [query, districts, classifications, onApply]);

  return (
    <section
      aria-label={ASK.label}
      className='bg-card overflow-hidden rounded-xl border shadow-xs print:hidden'
    >
      <div className='flex flex-col gap-2 p-3'>
        <div className='flex items-center gap-2'>
          <Icons.sparkles aria-hidden className='text-primary size-4 shrink-0' />
          <div className='min-w-0'>
            <p className='text-sm font-medium'>{ASK.label}</p>
            <p className='text-muted-foreground text-xs'>{ASK.description}</p>
          </div>
        </div>

        <form
          className='flex flex-wrap items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ASK.placeholder}
            aria-label={ASK.label}
            className='h-9 min-w-0 flex-1'
          />
          <Button type='submit' size='sm' disabled={!query.trim()}>
            <Icons.send className='size-4' />
            {ASK.submit}
          </Button>
        </form>

        {lastParsed && (
          <div className='text-xs'>
            {lastParsed.matched ? (
              <div className='flex flex-wrap items-center gap-1.5'>
                <span className='text-muted-foreground'>{ASK.understood}</span>
                {lastParsed.understood.map((line, index) => (
                  <Badge key={`${line}-${index}`} variant='secondary'>
                    {line}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground'>{ASK.fallback}</p>
            )}
          </div>
        )}

        {!lastParsed && (
          <div className='flex flex-wrap items-center gap-1.5 text-xs'>
            <span className='text-muted-foreground'>{ASK.examplesTitle}:</span>
            {ASK.examples.map((example) => (
              <Button
                key={example}
                type='button'
                variant='outline'
                size='sm'
                className='h-6 px-2 text-xs font-normal'
                onClick={() => setQuery(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
