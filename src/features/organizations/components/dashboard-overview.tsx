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
  Pie,
  PieChart,
  XAxis,
  YAxis
} from 'recharts';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { dashboardOverviewQueryOptions } from '../api/queries';
import type { DashboardOverview as DashboardData, DataGap } from '../api/types';
import { formatOrganizationCountAr, ORGANIZATION_LABELS } from '../constants/labels';
import {
  dataGapHref,
  organizationHref,
  termStatusHref,
  type TermStatusKey
} from '../lib/registry-links';

const LABELS = ORGANIZATION_LABELS.dashboard;

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
 * The registry's home page.
 *
 * Organised around one question — what needs doing — rather than around what
 * happens to be countable. The missing-data alerts come first and every number
 * on the page is a link: a count nobody can act on is decoration, and this
 * registry is maintained by hand, so "which records are incomplete" is the
 * standing task.
 */
export function DashboardOverview() {
  const { data } = useSuspenseQuery(dashboardOverviewQueryOptions());

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
        <StatCard
          label={ORGANIZATION_LABELS.report.total}
          value={data.total}
          icon={<Icons.building className='size-4' />}
          href='/dashboard/organizations'
        />
        <StatCard
          label={ORGANIZATION_LABELS.report.districts}
          value={data.districtCount}
          icon={<Icons.workspace className='size-4' />}
        />
        <StatCard
          label={ORGANIZATION_LABELS.report.classifications}
          value={data.classificationCount}
          icon={<Icons.adjustments className='size-4' />}
        />
        <StatCard
          label={LABELS.term.endingSoon}
          value={data.termStatus.endingSoon}
          icon={<Icons.clock className='size-4' />}
          href={termStatusHref('endingSoon', data.termWindow)}
          tone={data.termStatus.endingSoon > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <DataGapsCard gaps={data.gaps} className='lg:col-span-2' />
        <TermStatusCard termStatus={data.termStatus} termWindow={data.termWindow} />
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>{ORGANIZATION_LABELS.report.byDistrict}</CardTitle>
            <CardDescription>{formatOrganizationCountAr(data.total)}</CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              `dir='ltr'` is load-bearing — Recharts positions tick text with SVG
              `text-anchor`, whose `start`/`end` follow the inline direction, so
              inherited RTL anchors each label's left edge to the axis and the
              names run underneath the bars. The chart is then mirrored back
              explicitly: category axis on the right, bars growing leftward.
            */}
            <ChartContainer dir='ltr' config={chartConfig} className='min-h-[260px] w-full'>
              <BarChart data={data.byDistrict} layout='vertical' margin={{ left: 40, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type='number' dataKey='count' hide reversed />
                <YAxis
                  type='category'
                  dataKey='label'
                  orientation='right'
                  tickLine={false}
                  axisLine={false}
                  /* Reserved gutter for tick text — Recharts does not measure the
                     labels, so this has to clear the longest district name. */
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey='count' radius={4} fill='var(--chart-1)'>
                  {/*
                    `position='right'` is the bar's far tip here: the `reversed`
                    axis gives the bar a negative width, and Recharts flips a
                    label's anchors on negative width — so `'left'` would draw
                    just inside the axis, on top of the tick names.
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

        <Card>
          <CardHeader>
            <CardTitle>{ORGANIZATION_LABELS.report.byClassification}</CardTitle>
            <CardDescription>{formatNumberAr(classificationData.length)}</CardDescription>
          </CardHeader>
          <CardContent className='flex items-center justify-center'>
            <ChartContainer
              dir='ltr'
              config={chartConfig}
              className='mx-auto aspect-square max-h-[260px] min-h-[220px]'
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
      </div>

      <RecentCard recent={data.recent} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon,
  href,
  tone = 'default'
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  tone?: 'default' | 'warning';
}) {
  const body = (
    <CardContent className='flex items-center justify-between gap-3 pt-6'>
      <div>
        <p className='text-muted-foreground text-sm'>{label}</p>
        <p
          className={
            tone === 'warning'
              ? 'text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-500'
              : 'text-2xl font-semibold tabular-nums'
          }
        >
          {formatNumberAr(value)}
        </p>
      </div>
      <span
        className={
          tone === 'warning' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'
        }
      >
        {icon}
      </span>
    </CardContent>
  );

  if (!href) return <Card>{body}</Card>;

  return (
    <Card className='hover:border-primary/40 transition-colors'>
      <Link href={href} className='block'>
        {body}
      </Link>
    </Card>
  );
}

/**
 * The missing-data alerts.
 *
 * Each row offers two ways in, deliberately: the whole filtered list for
 * someone working through the backlog, and the named organizations themselves
 * for someone who just wants to fix the one in front of them.
 */
function DataGapsCard({ gaps, className }: { gaps: DataGap[]; className?: string }) {
  const outstanding = gaps.filter((gap) => gap.count > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Icons.warning className='size-4 text-amber-600 dark:text-amber-500' />
          {LABELS.alerts.title}
        </CardTitle>
        <CardDescription>{LABELS.alerts.description}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>
        {outstanding.length === 0 ? (
          <div className='text-muted-foreground flex items-center gap-2 py-6 text-sm'>
            <Icons.circleCheck className='size-4 text-emerald-600 dark:text-emerald-500' />
            {LABELS.alerts.allClear}
          </div>
        ) : (
          outstanding.map((gap) => <DataGapRow key={gap.key} gap={gap} />)
        )}
      </CardContent>
    </Card>
  );
}

function DataGapRow({ gap }: { gap: DataGap }) {
  const remaining = gap.count - gap.samples.length;

  return (
    <div className='rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <span className='font-medium'>{LABELS.issues[gap.key]}</span>
          <Badge variant='secondary' className='tabular-nums'>
            {formatNumberAr(gap.count)}
          </Badge>
        </div>
        <Button
          variant='ghost'
          size='sm'
          nativeButton={false}
          render={
            <Link
              href={dataGapHref(gap.key)}
              aria-label={`${LABELS.alerts.openList} — ${LABELS.issues[gap.key]}`}
            />
          }
        >
          {LABELS.alerts.openList}
          <Icons.chevronRight className='rtl:rotate-180' />
        </Button>
      </div>

      <div className='mt-2 flex flex-wrap items-center gap-1.5'>
        {gap.samples.map((sample) => (
          <Link
            key={sample.id}
            href={organizationHref(sample.id)}
            className='bg-muted/60 hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors'
            title={sample.district}
          >
            <Icons.add className='size-3' />
            {sample.name}
          </Link>
        ))}
        {remaining > 0 && (
          <span className='text-muted-foreground text-xs'>{LABELS.alerts.andMore(remaining)}</span>
        )}
      </div>
    </div>
  );
}

function TermStatusCard({
  termStatus,
  termWindow
}: {
  termStatus: DashboardData['termStatus'];
  termWindow: DashboardData['termWindow'];
}) {
  // Chronological, not by count — the buckets have a meaningful sequence.
  const order: TermStatusKey[] = ['ended', 'endingSoon', 'active', 'unset'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{LABELS.term.title}</CardTitle>
        <CardDescription>{LABELS.term.description(termWindow.noticeDays)}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-1'>
        {order.map((key) => (
          <Link
            key={key}
            href={termStatusHref(key, termWindow)}
            className='hover:bg-accent flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors'
          >
            <span className='flex items-center gap-2'>
              <span aria-hidden='true' className={`size-2 rounded-full ${TERM_TONES[key]}`} />
              {LABELS.term[key]}
            </span>
            <span className='flex items-center gap-1'>
              <span className='font-semibold tabular-nums'>{formatNumberAr(termStatus[key])}</span>
              <Icons.chevronRight className='text-muted-foreground size-4 rtl:rotate-180' />
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/** Dot colours for the term buckets — red through to neutral, in that order. */
const TERM_TONES: Record<TermStatusKey, string> = {
  ended: 'bg-destructive',
  endingSoon: 'bg-amber-500',
  active: 'bg-emerald-500',
  unset: 'bg-muted-foreground/40'
};

function RecentCard({ recent }: { recent: DashboardData['recent'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{LABELS.recent.title}</CardTitle>
        <CardDescription>{LABELS.recent.description}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-1'>
        {recent.length === 0 ? (
          <p className='text-muted-foreground py-4 text-sm'>{LABELS.recent.empty}</p>
        ) : (
          recent.map((row) => (
            <Link
              key={row.id}
              href={organizationHref(row.id)}
              className='hover:bg-accent flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors'
            >
              <span className='min-w-0'>
                <span className='block truncate font-medium'>{row.name}</span>
                <span className='text-muted-foreground text-xs'>{row.district}</span>
              </span>
              {/* Dates are an LTR island — the bidi algorithm otherwise reorders
                  the digit groups. */}
              <span dir='ltr' className='text-muted-foreground shrink-0 text-xs'>
                {formatDateAr(row.updatedAt)}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
