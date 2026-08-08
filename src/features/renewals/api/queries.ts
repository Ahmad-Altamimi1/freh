import { queryOptions } from '@tanstack/react-query';

import { getRenewalBoard } from './service';

/**
 * Query key factory.
 *
 * The board takes no arguments — it is always the whole cycle — so there is one
 * list key rather than a filter-keyed family.
 */
export const renewalKeys = {
  all: ['board-renewals'] as const,
  board: () => [...renewalKeys.all, 'board'] as const
};

export const renewalBoardQueryOptions = () =>
  queryOptions({
    queryKey: renewalKeys.board(),
    queryFn: () => getRenewalBoard(),
    // Short rather than zero: several people work this board at once, and a
    // card that moved under someone else should surface on the next visit
    // without making every tab re-query on focus.
    staleTime: 30 * 1000
  });
