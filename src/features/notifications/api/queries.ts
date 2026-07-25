import { queryOptions } from '@tanstack/react-query';

import { getNotifications } from './service';

/**
 * Query key factory.
 *
 * A single list query serves both the navbar popover (top 5) and the full
 * page (client-side All/Unread/Read filter) — at this app's volume, a
 * separate unread-count query would just be a second cache entry that can
 * drift from the list it's counting.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const
};

export const notificationsQueryOptions = () =>
  queryOptions({
    queryKey: notificationKeys.list(),
    queryFn: () => getNotifications(),
    staleTime: 30 * 1000
  });
