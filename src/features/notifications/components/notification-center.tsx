'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  markAllNotificationsAsReadMutation,
  markNotificationAsReadMutation
} from '../api/mutations';
import { notificationsQueryOptions } from '../api/queries';
import { NOTIFICATION_LABELS } from '../constants/labels';

const LABELS = NOTIFICATION_LABELS.center;
const MAX_VISIBLE = 5;

/** Same-sized ghost button, no badge — the Suspense fallback while the list streams in. */
export function NotificationCenterSkeleton() {
  return (
    <Button variant='ghost' size='icon' className='relative h-8 w-8' disabled>
      <Icons.notification className='h-4 w-4' />
      <span className='sr-only'>{LABELS.title}</span>
    </Button>
  );
}

export function NotificationCenter() {
  const { data } = useSuspenseQuery(notificationsQueryOptions());
  const router = useRouter();
  const notifications = data.data;

  const markAsReadMutation = useMutation({
    ...markNotificationAsReadMutation,
    onError: (error) => toast.error(error.message || LABELS.markReadFailed)
  });

  const markAllAsReadMutation = useMutation({
    ...markAllNotificationsAsReadMutation,
    onError: (error) => toast.error(error.message || LABELS.markAllReadFailed)
  });

  const unreadCount = notifications.filter((n) => n.status === 'unread').length;
  const visibleNotifications = notifications.slice(0, MAX_VISIBLE);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant='ghost' size='icon' className='relative h-8 w-8' />}>
        <Icons.notification className='h-4 w-4' />
        {unreadCount > 0 && (
          <span className='bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className='sr-only'>{LABELS.title}</span>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[calc(100vw-2rem)] p-0 sm:w-[380px]' sideOffset={8}>
        <div className='flex items-center justify-between px-4 py-3'>
          <Link href='/dashboard/notifications' className='group flex items-center gap-1'>
            <h4 className='text-sm font-semibold group-hover:underline'>{LABELS.title}</h4>
            <Icons.chevronRight className='text-muted-foreground h-3.5 w-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-0.5' />
          </Link>
          <div className='flex items-center gap-2'>
            {unreadCount > 0 && (
              <span className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs'>
                {LABELS.newCount(unreadCount)}
              </span>
            )}
            {unreadCount > 0 && (
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground h-auto px-2 py-1 text-xs'
                onClick={() => markAllAsReadMutation.mutate()}
              >
                {LABELS.markAllRead}
              </Button>
            )}
          </div>
        </div>
        <Separator />
        <ScrollArea className='h-[400px]'>
          {notifications.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12'>
              <Icons.notification className='text-muted-foreground/40 mb-2 h-8 w-8' />
              <p className='text-muted-foreground text-sm'>{LABELS.empty}</p>
            </div>
          ) : (
            <div className='flex flex-col gap-1 p-2'>
              {visibleNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  id={notification.id}
                  title={notification.title}
                  body={notification.body}
                  status={notification.status}
                  createdAt={notification.createdAt}
                  actions={notification.actions}
                  onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                  onAction={(notificationId, actionId) => {
                    const target = notifications.find((n) => n.id === notificationId);
                    const action = target?.actions.find((a) => a.id === actionId);
                    if (action?.href) {
                      markAsReadMutation.mutate(notificationId);
                      router.push(action.href);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
