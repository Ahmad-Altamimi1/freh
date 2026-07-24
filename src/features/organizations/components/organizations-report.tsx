'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from 'recharts';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { formatDateAr, formatNumberAr, formatPercent } from '@/lib/format';
import { organizationReportQueryOptions } from '../api/queries';
import type { FilterDescription } from '../api/describe-filters';
import type { OrganizationFilters } from '../api/types';
import { ORGANIZATION_LABELS } from '../constants/labels';

const LABELS = ORGANIZATION_LABELS.report;

/** Categorical palette from the theme, cycled for however many categories exist. */
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

const chartConfig = { count: { label: 'العدد' } } satisfies ChartConfig;

interface OrganizationsReportProps {
  filters: OrganizationFilters;
  appliedFilters: FilterDescription[];
  /** Query string carrying the filter, so the export downloads the same rows. */
  queryString: string;
  generatedAt: string;
}

export function OrganizationsReport({
  filters,
  appliedFilters,
  queryString,
  generatedAt
}: OrganizationsReportProps) {
  const { data } = useSuspenseQuery(organizationReportQueryOptions(filters));
  const { summary } = data;

  const districtData = React.useMemo(
    () =>
      data.byDistrict.map((row, index) => ({
        ...row,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      })),
    [data.byDistrict]
  );

  const classificationData = React.useMemo(
    () =>
      data.byClassification.map((row, index) => ({
        ...row,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      })),
    [data.byClassification]
  );

  return (
    <div className='flex flex-col gap-4'>
      {/* Toolbar is navigation, not report content — excluded from print. */}
      <div className='flex flex-wrap items-center gap-2 print:hidden'>
        <Button
          variant='outline'
          size='sm'
          render={
            <Link
              href={`/dashboard/organizations${queryString}`}
              aria-label={ORGANIZATION_LABELS.actions.backToList}
            />
          }
        >
          <Icons.chevronLeft className='rtl:rotate-180' />
          {ORGANIZATION_LABELS.actions.backToList}
        </Button>
        <Button
          variant='outline'
          size='sm'
          render={
            <a
              href={`/api/organizations/export${queryString}`}
              aria-label={ORGANIZATION_LABELS.actions.exportExcel}
            />
          }
        >
          <Icons.download />
          {ORGANIZATION_LABELS.actions.exportExcel}
        </Button>
        <PrintButton />
      </div>

      <AppliedFilters applied={appliedFilters} generatedAt={generatedAt} />

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
        <SummaryCard label={LABELS.total} value={formatNumberAr(summary.total)} />
        <SummaryCard label={LABELS.districts} value={formatNumberAr(summary.districtCount)} />
        <SummaryCard
          label={LABELS.classifications}
          value={formatNumberAr(summary.classificationCount)}
        />
        <SummaryCard
          label={LABELS.withMobile}
          value={formatNumberAr(summary.withMobile)}
          hint={formatPercent(summary.withMobile, summary.total)}
        />
        <SummaryCard
          label={LABELS.withDirector}
          value={formatNumberAr(summary.withDirector)}
          hint={formatPercent(summary.withDirector, summary.total)}
        />
        <SummaryCard
          label={LABELS.range}
          value={
            summary.earliestYear && summary.latestYear
              ? `${summary.earliestYear} – ${summary.latestYear}`
              : '—'
          }
        />
      </div>

      {summary.total === 0 ? (
        <Card>
          <CardContent className='text-muted-foreground py-12 text-center'>
            {ORGANIZATION_LABELS.table.noResults}
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card className='break-inside-avoid'>
            <CardHeader>
              <CardTitle>{LABELS.byDistrict}</CardTitle>
              <CardDescription>{formatNumberAr(summary.total)}</CardDescription>
            </CardHeader>
            <CardContent>
              {/*
                `dir='ltr'` is load-bearing, not a style choice.

                Recharts positions tick text with SVG `text-anchor`, and in SVG
                `end` means the end of the text in its *inline* direction — the
                left edge for RTL. Inherited RTL therefore anchored each label's
                left edge to the axis, so the names ran rightward and disappeared
                underneath the bars rather than sitting in the gutter.

                Pinning the container to LTR makes the geometry predictable, and
                the chart is then mirrored explicitly: category axis on the right,
                bars growing leftward (`reversed`), counts at the bar's leading
                end. Arabic still shapes correctly — bidi orders glyphs within a
                text run regardless of the container's direction.
              */}
              <ChartContainer dir='ltr' config={chartConfig} className='min-h-[280px] w-full'>
                <BarChart data={districtData} layout='vertical' margin={{ left: 40, right: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type='number' dataKey='count' hide reversed />
                  <YAxis
                    type='category'
                    dataKey='label'
                    orientation='right'
                    tickLine={false}
                    axisLine={false}
                    /* Reserved gutter for tick text — Recharts does not measure
                       the labels, so this has to clear the longest district
                       name ("الاغوار الشمالية"). */
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey='count' radius={4}>
                    {districtData.map((row) => (
                      <Cell key={row.label} fill={row.fill} />
                    ))}
                    <LabelList
                      dataKey='count'
                      position='left'
                      fontSize={12}
                      className='fill-foreground'
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className='break-inside-avoid'>
            <CardHeader>
              <CardTitle>{LABELS.byClassification}</CardTitle>
              <CardDescription>{formatNumberAr(classificationData.length)}</CardDescription>
            </CardHeader>
            <CardContent className='flex items-center justify-center'>
              <ChartContainer
                dir='ltr'
                config={chartConfig}
                className='mx-auto aspect-square max-h-[280px] min-h-[240px]'
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey='label' hideLabel />} />
                  <Pie
                    data={classificationData}
                    dataKey='count'
                    nameKey='label'
                    innerRadius={45}
                    paddingAngle={3}
                    cornerRadius={6}
                  >
                    {classificationData.map((row) => (
                      <Cell key={row.label} fill={row.fill} />
                    ))}
                    <LabelList
                      dataKey='count'
                      stroke='none'
                      fontSize={12}
                      fontWeight={500}
                      fill='currentColor'
                      formatter={(value: number) => String(value)}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className='break-inside-avoid lg:col-span-2'>
            <CardHeader>
              <CardTitle>{LABELS.byYear}</CardTitle>
              <CardDescription>
                {summary.earliestYear} – {summary.latestYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer dir='ltr' config={chartConfig} className='min-h-[220px] w-full'>
                <LineChart data={data.byYear} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  {/* `reversed` so the time axis runs right-to-left with the page. */}
                  <XAxis
                    dataKey='year'
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    reversed
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                    orientation='right'
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey='count'
                    type='monotone'
                    stroke='var(--chart-1)'
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Print is a browser capability, not a server one — this must be a client
 * component, and it is the only reason any of this tree is one.
 */
function PrintButton() {
  return (
    <Button variant='outline' size='sm' onClick={() => window.print()}>
      <Icons.printer />
      {ORGANIZATION_LABELS.actions.print}
    </Button>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className='break-inside-avoid'>
      <CardContent className='pt-6'>
        <p className='text-muted-foreground text-sm'>{label}</p>
        <p className='text-2xl font-semibold tabular-nums'>{value}</p>
        {hint && <p className='text-muted-foreground text-xs tabular-nums'>{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * States what the report is a report of.
 *
 * Printed or exported, the numbers outlive the URL that produced them — without
 * this, a page reading "16 جمعية" is indistinguishable from a claim about the
 * whole registry.
 */
function AppliedFilters({
  applied,
  generatedAt
}: {
  applied: FilterDescription[];
  generatedAt: string;
}) {
  return (
    <Card className='break-inside-avoid'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>{LABELS.appliedFilters}</CardTitle>
        <CardDescription>
          {LABELS.generatedAt}: {formatDateAr(generatedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {applied.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{LABELS.noFilters}</p>
        ) : (
          <ul className='flex flex-col gap-1 text-sm'>
            {applied.map((line, index) => (
              <li key={`${line.label}-${index}`} className='flex flex-wrap gap-x-2'>
                <span className='text-muted-foreground'>{line.label}</span>
                <span className='font-medium'>{line.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
