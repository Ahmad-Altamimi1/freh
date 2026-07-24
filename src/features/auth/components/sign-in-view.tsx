import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AppLogo, APP_NAME, APP_TAGLINE } from '@/components/layout/app-logo';
import { InteractiveGridPattern } from './interactive-grid';
import { SignInForm } from './sign-in-form';

export default function SignInViewPage({ redirectTo }: { redirectTo?: string }) {
  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='bg-sidebar absolute inset-0' />
        <div className='text-sidebar-foreground relative z-20 flex items-center gap-3'>
          <AppLogo className='size-10' />
          <div className='grid leading-tight'>
            <span className='text-lg font-medium'>{APP_NAME}</span>
            <span className='text-sidebar-foreground/70 text-sm'>{APP_TAGLINE}</span>
          </div>
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
      </div>

      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-sm flex-col justify-center space-y-6'>
          <div className='flex flex-col space-y-2 text-center'>
            <h1 className='text-2xl font-semibold tracking-tight'>تسجيل الدخول</h1>
            <p className='text-muted-foreground text-sm'>أدخل بياناتك للوصول إلى لوحة التحكم</p>
          </div>

          <SignInForm redirectTo={redirectTo} />

          <p className='text-muted-foreground px-8 text-center text-sm'>
            بالمتابعة، أنت توافق على{' '}
            <Link
              href='/terms-of-service'
              className='hover:text-primary underline underline-offset-4'
            >
              شروط الخدمة
            </Link>{' '}
            و{' '}
            <Link
              href='/privacy-policy'
              className='hover:text-primary underline underline-offset-4'
            >
              سياسة الخصوصية
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
