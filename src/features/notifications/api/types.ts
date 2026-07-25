import type { NotificationAction, NotificationStatus } from '@/components/ui/notification-card';
import type { NotificationRow } from '@/db/schema/notifications';

/**
 * A notification as the UI sees it.
 *
 * `recipientId`/`dedupeKey` are write-time/matching concerns with no UI use —
 * same rationale as `organizations`' `Organization` type dropping its derived
 * columns. `actionHref`/`actionLabel` are collapsed into a single `actions`
 * array so `NotificationCard` (which predates this real data layer) needs no
 * change beyond the `href` field already added to `NotificationAction`.
 */
export type Notification = Omit<
  NotificationRow,
  'recipientId' | 'dedupeKey' | 'actionHref' | 'actionLabel' | 'status'
> & {
  status: NotificationStatus;
  actions: NotificationAction[];
};

export type NotificationsResponse = {
  data: Notification[];
};
