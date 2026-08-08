import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AppLogo, APP_NAME, APP_TAGLINE } from '@/components/layout/app-logo';
import { APP_CREDIT, APP_CREDIT_AFFILIATION, copyrightYear } from '@/config/app-credit';
import { InteractiveGridPattern } from './interactive-grid';
import { SignInForm } from './sign-in-form';

export default function SignInViewPage({ redirectTo }: { redirectTo?: string }) {
  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-5 lg:px-0'>
      {/* The brand panel: a large photo of the directorate under a maroon scrim.
          It claims 3 of 5 columns so the image reads as a hero, not a rail.
          `bg-sidebar` is the fallback colour — if `/login-hero.jpg` is absent the
          photo layer is simply empty and the panel shows as a solid maroon slab,
          which still looks deliberate. */}
      <div className='bg-sidebar relative hidden h-full flex-col justify-between overflow-hidden p-10 lg:col-span-3 lg:flex'>
        {/* Photo layer. A plain CSS background rather than next/image so a missing
            file degrades to the maroon fallback instead of throwing. */}
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: 'url(/login-hero.jpeg)' }}
        />
        {/* Brand tint — multiplies the photo toward the sidebar maroon so the
            hero belongs to the identity rather than sitting as a stock photo. */}
        <div className='bg-sidebar/55 absolute inset-0 mix-blend-multiply' />
        {/* Legibility scrim — darker at top and bottom where text sits. */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/45' />

        {/* Interactive grid, laid over the photo in faint white so it reads as a
            deliberate overlay rather than the grey default. The radial mask fades
            it out at the edges; content sits above at z-20 and stays clickable. */}
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(500px_circle_at_center,white,transparent)]',
            'inset-0 h-full w-full skew-y-12 border-white/10'
          )}
          squaresClassName='stroke-white/15'
        />

        <div className='relative z-20 flex items-center gap-3 text-white'>
          <AppLogo className='size-11' />
          <div className='grid leading-tight'>
            <span className='text-lg font-semibold'>{APP_NAME}</span>
            <span className='text-sm text-white/75'>{APP_TAGLINE}</span>
          </div>
        </div>

        <div className='relative z-20 text-white'>
          <h2 className='text-3xl leading-snug font-bold drop-shadow-sm'>{APP_TAGLINE}</h2>
          <div className='mt-6'>
            <CreditBlock />
          </div>
          <p className='mt-6 text-xs text-white/60'>
            <span dir='ltr'>© {copyrightYear()}</span> — {APP_CREDIT.rightsReserved}
          </p>
        </div>
      </div>

      <div className='flex h-full items-center justify-center p-4 lg:col-span-2 lg:p-8'>
        <div className='flex w-full max-w-sm flex-col justify-center space-y-6'>
          <div className='flex flex-col items-center space-y-4 text-center'>
            <AppLogo className='size-16' />
            <div>
              <p className='text-muted-foreground text-sm font-medium'>وزارة الثقافة</p>
              <h1 className='text-2xl font-bold tracking-tight'>نظام الهيئات الثقافية</h1>
              <p className='text-muted-foreground mt-1 text-sm'>مديرية ثقافة اربد</p>
            </div>
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
 * `compact` renders the on-theme version for the mobile footer (muted tokens on
 * a cream surface). The default renders over the hero photo, so it forces white
 * text and a cream accent rule regardless of theme.
 *
 * Two notes on the styling:
 * - The accent rule is `border-s`; a physical `border-l` lands on the wrong
 *   edge under `dir='rtl'`.
 * - No `tracking-*` anywhere. Latin small-caps labels take letter-spacing well,
 *   but Arabic is cursive — spacing the letters pulls the joins apart and the
 *   word stops reading as a word.
 */
function CreditBlock({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className='border-primary border-s-4 ps-4'>
        <p className='text-xs opacity-60'>{APP_CREDIT.role}</p>
        <p className='mt-1 text-xl leading-tight font-bold'>{APP_CREDIT.name}</p>
        <p className='mt-2 text-xs opacity-75'>{APP_CREDIT_AFFILIATION}</p>
      </div>
    );
  }

  return (
    <div className='border-s-4 border-white/60 ps-6 text-white'>
      <p className='text-sm text-white/70'>{APP_CREDIT.role}</p>
      <p className='mt-1 text-2xl leading-tight font-bold'>{APP_CREDIT.name}</p>
      <p className='mt-2 text-base text-white/80'>{APP_CREDIT_AFFILIATION}</p>
    </div>
  );
}
