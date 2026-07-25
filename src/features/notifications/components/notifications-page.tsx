'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  markAllNotificationsAsReadMutation,
  markNotificationAsReadMutation
} from '../api/mutations';
import { notificationsQueryOptions } from '../api/queries';
import type { Notification } from '../api/types';
import { NOTIFICATION_LABELS } from '../constants/labels';

const LABELS = NOTIFICATION_LABELS;

export default function NotificationsPage() {
  const { data } = useSuspenseQuery(notificationsQueryOptions());
  const router = useRouter();
  const notifications = data.data;

  const markAsReadMutation = useMutation({
    ...markNotificationAsReadMutation,
    onError: (error) => toast.error(error.message || LABELS.center.markReadFailed)
  });

  const markAllAsReadMutation = useMutation({
    ...markAllNotificationsAsReadMutation,
    onError: (error) => toast.error(error.message || LABELS.center.markAllReadFailed)
  });

  const unreadNotifications = notifications.filter((n) => n.status === 'unread');
  const readNotifications = notifications.filter((n) => n.status === 'read');
  const unreadCount = unreadNotifications.length;

  const renderList = (items: Notification[]) => {
    if (items.length === 0) {
      return (
        <div className='flex flex-col items-center justify-center py-16'>
          <Icons.notification className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm'>{LABELS.empty}</p>
        </div>
      );
    }

    return (
      <div className='flex flex-col gap-2'>
        {items.map((notification) => (
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
    );
  };

  return (
    <PageContainer
      pageTitle={LABELS.page.title}
      pageDescription={LABELS.page.description}
      pageHeaderAction={
        unreadCount > 0 ? (
          <Button variant='outline' size='sm' onClick={() => markAllAsReadMutation.mutate()}>
            {LABELS.center.markAllRead}
          </Button>
        ) : undefined
      }
    >
      <Tabs defaultValue='all'>
        <TabsList>
          <TabsTrigger value='all'>{LABELS.tabs.all(notifications.length)}</TabsTrigger>
          <TabsTrigger value='unread'>{LABELS.tabs.unread(unreadNotifications.length)}</TabsTrigger>
          <TabsTrigger value='read'>{LABELS.tabs.read(readNotifications.length)}</TabsTrigger>
        </TabsList>
        <TabsContent value='all' className='mt-4'>
          {renderList(notifications)}
        </TabsContent>
        <TabsContent value='unread' className='mt-4'>
          {renderList(unreadNotifications)}
        </TabsContent>
        <TabsContent value='read' className='mt-4'>
          {renderList(readNotifications)}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
