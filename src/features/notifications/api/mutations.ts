import { mutationOptions } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';
import { notificationKeys } from './queries';
import { markAllNotificationsAsRead, markNotificationAsRead } from './service';

export const markNotificationAsReadMutation = mutationOptions({
  mutationFn: (id: string) => markNotificationAsRead(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  }
});

export const markAllNotificationsAsReadMutation = mutationOptions({
  mutationFn: () => markAllNotificationsAsRead(),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  }
});
