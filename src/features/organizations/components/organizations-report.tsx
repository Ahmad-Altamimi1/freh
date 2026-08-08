'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { formatNumberAr } from '@/lib/format';
import { organizationReportQueryOptions } from '../api/queries';
import type { OrganizationFilters } from '../api/types';
import { ORGANIZATION_LABELS } from '../constants/labels';

const LABELS = ORGANIZATION_LABELS.report;

/**
 * Categorical palette from the theme, cycled for however many categories exist.
 * Only the pie needs it — slices are distinguished by nothing but colour. The
 * district bars are one measure ranked by size, where a second encoding would
 * be noise, so they take a single colour.
 */
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

const chartConfig = { count: { label: 'العدد' } } satisfies ChartConfig;

/**
 * The on-screen chart view of the current criteria.
 *
 * Deliberately holds no toolbar and no statement of what is filtered: the
 * workspace above owns both, and repeating them here would put the same
 * conditions and the same export buttons on the page twice. The *printed*
 * document is a different matter — it outlives the URL that produced it, so
 * `report-document.tsx` still prints the criteria block.
 */
interface OrganizationsReportProps {
  filters: OrganizationFilters;
}

export function OrganizationsReport({ filters }: OrganizationsReportProps) {
  const { data } = useSuspenseQuery(organizationReportQueryOptions(filters));
  const { summary } = data;

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
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <SummaryCard label={LABELS.total} value={formatNumberAr(summary.total)} />
        <SummaryCard label={LABELS.districts} value={formatNumberAr(summary.districtCount)} />
        <SummaryCard
          label={LABELS.classifications}
          value={formatNumberAr(summary.classificationCount)}
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
                <BarChart data={data.byDistrict} layout='vertical' margin={{ left: 40, right: 8 }}>
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
                  <Bar dataKey='count' radius={4} fill='var(--chart-1)'>
                    {/*
                      `position='right'`, counter-intuitively, is the bar's far
                      tip here. A vertical bar is laid out as `x = scale(0)`,
                      `width = scale(value) - scale(0)`, so the `reversed` axis
                      makes the width negative: `x` is the axis edge and the bar
                      extends left of it. Recharts flips a label's anchors on a
                      negative width, which turns `'left'` into "just inside the
                      axis, running outward" — straight under the tick names.
                    */}
                    <LabelList
                      dataKey='count'
                      position='right'
                      offset={8}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className='break-inside-avoid'>
      <CardContent className='pt-6'>
        <p className='text-muted-foreground text-sm'>{label}</p>
        <p className='text-2xl font-semibold tabular-nums'>{value}</p>
      </CardContent>
    </Card>
  );
}
