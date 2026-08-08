'use client';

import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function OverviewError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className='flex flex-col items-start gap-3 p-4 md:px-6'>
      <Alert variant='destructive'>
        <Icons.alertCircle className='size-4' />
        <AlertTitle>تعذّر تحميل لوحة التحكم</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={reset}>
        <Icons.refresh />
        إعادة المحاولة
      </Button>
    </div>
  );
}
