import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AppLogo, APP_NAME, APP_TAGLINE } from '@/components/layout/app-logo';
import { APP_CREDIT, APP_CREDIT_AFFILIATION, copyrightYear } from '@/config/app-credit';
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

        {/* The credit claims the panel's dead middle rather than hiding in a
            corner — `flex-1` between the logo and the rights line centres it in
            everything left over. `pointer-events-none` hands the pointer back to
            the grid pattern underneath, which is hover-interactive. */}
        <div className='text-sidebar-foreground pointer-events-none relative z-20 flex flex-1 items-center'>
          <CreditBlock />
        </div>

        <p className='text-sidebar-foreground/50 relative z-20 text-xs'>
          <span dir='ltr'>© {copyrightYear()}</span> — {APP_CREDIT.rightsReserved}
        </p>
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

          {/* The brand panel that carries the credit is `hidden lg:flex`, so on
              narrow viewports it is absent from the page entirely. This is the
              same block at a size that suits a column, shown only where that
              one is not. */}
          <div className='border-t pt-6 lg:hidden'>
            <CreditBlock compact />
            <p className='text-muted-foreground mt-4 text-xs'>
              <span dir='ltr'>© {copyrightYear()}</span> — {APP_CREDIT.rightsReserved}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Attribution for the system, with the name as the focal point.
 *
 * The role sits above in small muted type and the affiliation below, so the eye
 * lands on the name rather than reading a run-on sentence — the name is the
 * only line at full contrast, and the only one carrying real size.
 *
 * Two notes on the styling:
 * - The accent rule is `border-s`; a physical `border-l` lands on the wrong
 *   edge under `dir='rtl'`.
 * - No `tracking-*` anywhere. Latin small-caps labels take letter-spacing well,
 *   but Arabic is cursive — spacing the letters pulls the joins apart and the
 *   word stops reading as a word.
 */
function CreditBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('border-s-4 border-primary', compact ? 'ps-4' : 'ps-6')}>
      <p className={cn('opacity-60', compact ? 'text-xs' : 'text-sm')}>{APP_CREDIT.role}</p>
      <p className={cn('mt-1 leading-tight font-bold', compact ? 'text-xl' : 'text-4xl')}>
        {APP_CREDIT.name}
      </p>
      <p className={cn('mt-2 opacity-75', compact ? 'text-xs' : 'text-base')}>
        {APP_CREDIT_AFFILIATION}
      </p>
    </div>
  );
}
