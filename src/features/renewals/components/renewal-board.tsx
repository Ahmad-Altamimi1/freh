'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useCan } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { formatDateAr, formatNumberAr } from '@/lib/format';
import { invalidateRenewals, setRenewalStageMutation } from '../api/mutations';
import { renewalBoardQueryOptions } from '../api/queries';
import { FINAL_RENEWAL_STAGE, RENEWAL_STAGES } from '../api/types';
import type { RenewalCard, RenewalStage } from '../api/types';
import {
  RENEWAL_LABELS,
  RENEWAL_STAGE_ACTIONS,
  RENEWAL_STAGE_HINTS,
  RENEWAL_STAGE_LABELS
} from '../constants/labels';
import { RenewalDetailsSheet } from './renewal-details-sheet';

const CARD = RENEWAL_LABELS.card;

/** The stage after this one, or null at the end of the procedure. */
function nextStage(stage: RenewalStage): RenewalStage | null {
  const index = RENEWAL_STAGES.indexOf(stage);
  return index >= 0 && index < RENEWAL_STAGES.length - 1 ? RENEWAL_STAGES[index + 1] : null;
}

/**
 * The renewal board.
 *
 * A column per stage of the directorate's procedure, read left-to-right in the
 * order the work actually happens (so right-to-left on this page). Cards carry
 * the one number the board exists for: how late each society is.
 *
 * Deliberately not drag-and-drop. A move is a recorded procedural act with a
 * next step that is almost always the next stage, so an explicit button states
 * what is about to be recorded — and it works on a touchscreen and a keyboard
 * without a gesture layer to maintain.
 */
export function RenewalBoard() {
  const { data: board } = useSuspenseQuery(renewalBoardQueryOptions());
  const canManage = useCan(PERMISSIONS.RENEWALS_MANAGE);
  const [detailsCard, setDetailsCard] = React.useState<RenewalCard | null>(null);

  const mutation = useMutation({
    ...setRenewalStageMutation,
    onSuccess: ({ stage }) => {
      // Spreading the options above and then supplying our own onSuccess
      // replaces theirs, so the invalidation is re-run here by hand — otherwise
      // the card moves in the DB but the board doesn't refetch.
      invalidateRenewals();
      toast.success(RENEWAL_LABELS.toast.moved(RENEWAL_STAGE_LABELS[stage]), {
        // Closing a renewal without entering the new board leaves the registry
        // saying what the previous term said, which is the one way this whole
        // cycle can end in the wrong place.
        description: stage === FINAL_RENEWAL_STAGE ? RENEWAL_LABELS.toast.closedHint : undefined
      });
    },
    onError: (error) => toast.error(error.message || RENEWAL_LABELS.toast.moveFailed)
  });

  const move = React.useCallback(
    (card: RenewalCard, stage: RenewalStage) => {
      mutation.mutate({
        organizationId: card.organizationId,
        termEndAt: card.termEndAt,
        stage
      });
    },
    [mutation]
  );

  const allCards = board.columns.flatMap((column) => column.cards);
  const overdueCount = allCards.filter((card) => card.overdueDays > 0).length;

  if (allCards.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 py-24 text-center'>
        <Icons.check className='size-8 text-muted-foreground' />
        <p className='font-medium'>{RENEWAL_LABELS.page.empty}</p>
        <p className='max-w-md text-sm text-muted-foreground'>{RENEWAL_LABELS.page.emptyHint}</p>
      </div>
    );
  }

  return (
    <>
      {detailsCard && (
        <RenewalDetailsSheet
          card={detailsCard}
          open={detailsCard !== null}
          onOpenChange={(open) => !open && setDetailsCard(null)}
        />
      )}

      <div className='space-y-6'>
        <SummaryStrip
          open={allCards.length}
          overdue={overdueCount}
          completed={board.completedCount}
          noticeDays={board.noticeDays}
        />

        {/* Fluid columns: `flex-1` lets the seven stages share the width evenly
            when they fit, so a wide screen has no dead space and a narrow one
            scrolls instead of squashing. `min-w-0` on the scroll region keeps
            that scroll inside it rather than stretching the whole page. The
            columns stay one horizontal sequence — wrapping them would break the
            left-to-right reading of the procedure. */}
        <div className='-mx-2 min-w-0 overflow-x-auto px-2 pb-2'>
          <div className='flex gap-3'>
            {board.columns.map((column) => (
              <section key={column.stage} className='min-w-[13rem] flex-1'>
                <header className='mb-2 px-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <h2 className='text-sm font-semibold'>{RENEWAL_STAGE_LABELS[column.stage]}</h2>
                    <Badge variant='secondary' className='tabular-nums'>
                      {formatNumberAr(column.cards.length)}
                    </Badge>
                  </div>
                  <p className='mt-0.5 text-xs leading-5 text-muted-foreground'>
                    {RENEWAL_STAGE_HINTS[column.stage]}
                  </p>
                </header>

                <div className='space-y-2'>
                  {column.cards.map((card) => (
                    <Card
                      key={`${card.organizationId}-${card.termEndAt}`}
                      card={card}
                      canManage={canManage}
                      isPending={mutation.isPending}
                      onMove={move}
                      onEdit={() => setDetailsCard(card)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function SummaryStrip({
  open,
  overdue,
  completed,
  noticeDays
}: {
  open: number;
  overdue: number;
  completed: number;
  noticeDays: number;
}) {
  const cells = [
    { label: RENEWAL_LABELS.summary.open, value: open, tone: '' },
    { label: RENEWAL_LABELS.summary.overdue, value: overdue, tone: 'text-destructive' },
    { label: RENEWAL_LABELS.summary.completed, value: completed, tone: '' }
  ];

  return (
    <section className='overflow-hidden rounded-2xl border border-border bg-card shadow-sm'>
      <div className='grid grid-cols-3 gap-px bg-border'>
        {cells.map((cell) => (
          <div key={cell.label} className='bg-card px-3 py-3 sm:px-5 sm:py-4'>
            <p className='text-xs font-medium text-muted-foreground'>{cell.label}</p>
            <p dir='ltr' className={`mt-1.5 text-xl font-semibold tabular-nums ${cell.tone}`}>
              {formatNumberAr(cell.value)}
            </p>
          </div>
        ))}
      </div>
      <p className='border-t border-border px-5 py-2 text-xs text-muted-foreground'>
        {RENEWAL_LABELS.summary.window(noticeDays)}
      </p>
    </section>
  );
}

/** How late this society is — the reason the board exists, so it leads the card. */
function LatenessBadge({ overdueDays }: { overdueDays: number }) {
  if (overdueDays > 0) {
    return (
      <Badge variant='destructive' className='gap-1'>
        <Icons.warning className='size-3' />
        {CARD.overdue(overdueDays)}
      </Badge>
    );
  }

  return (
    <Badge variant='secondary' className='gap-1'>
      <Icons.clock className='size-3' />
      {overdueDays === 0 ? CARD.dueToday : CARD.dueIn(-overdueDays)}
    </Badge>
  );
}

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-2'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium'>{children}</span>
    </div>
  );
}

function Card({
  card,
  canManage,
  isPending,
  onMove,
  onEdit
}: {
  card: RenewalCard;
  canManage: boolean;
  isPending: boolean;
  onMove: (card: RenewalCard, stage: RenewalStage) => void;
  onEdit: () => void;
}) {
  const next = nextStage(card.stage);

  return (
    <article className='rounded-xl border border-border bg-card p-3 shadow-sm'>
      <div className='flex items-start justify-between gap-2'>
        <Link
          href={`/dashboard/organizations/${card.organizationId}`}
          className='text-sm leading-6 font-medium hover:underline'
        >
          {card.organizationName}
        </Link>
        {canManage && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={<Button variant='ghost' className='size-7 shrink-0 p-0' />}
            >
              <span className='sr-only'>{CARD.moveTo}</span>
              <Icons.ellipsis className='size-4' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{CARD.moveTo}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {RENEWAL_STAGES.filter((stage) => stage !== card.stage).map((stage) => (
                  <DropdownMenuItem
                    key={stage}
                    disabled={isPending}
                    onClick={() => onMove(card, stage)}
                  >
                    {RENEWAL_STAGE_ACTIONS[stage]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Icons.edit className='size-4' />
                  {CARD.edit}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      href={`/dashboard/organizations/${card.organizationId}`}
                      aria-label={CARD.updateMembers}
                    />
                  }
                >
                  <Icons.user className='size-4' />
                  {CARD.updateMembers}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className='mt-2 flex flex-wrap items-center gap-1.5'>
        <LatenessBadge overdueDays={card.overdueDays} />
        <Badge variant='outline'>{card.district}</Badge>
      </div>

      <div className='mt-2.5 space-y-1 text-xs'>
        <CardRow label={CARD.termEnd}>
          <span dir='ltr'>{formatDateAr(card.termEndAt)}</span>
        </CardRow>
        {card.electionDate && (
          <CardRow label={CARD.electionDate}>
            <span dir='ltr'>{formatDateAr(card.electionDate)}</span>
          </CardRow>
        )}
        {card.delegateName && <CardRow label={CARD.delegate}>{card.delegateName}</CardRow>}
        <CardRow label={CARD.members}>
          <span dir='ltr' className='tabular-nums'>
            {formatNumberAr(card.membersCount)}
          </span>
        </CardRow>
      </div>

      {card.notes && (
        <p className='mt-2 line-clamp-3 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground'>
          {card.notes}
        </p>
      )}

      {canManage && next && (
        <Button
          variant='outline'
          size='sm'
          className='mt-3 w-full'
          disabled={isPending}
          onClick={() => onMove(card, next)}
        >
          {RENEWAL_STAGE_ACTIONS[next]}
          {/* Named as it would be in LTR and mirrored — picking the RTL-correct
              glyph *and* rotating it would point it backwards. */}
          <Icons.arrowRight className='size-3.5 rtl:rotate-180' />
        </Button>
      )}
    </article>
  );
}
