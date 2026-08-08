import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/components/themes/font.config';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';

const META_THEME_COLORS = {
  light: '#efe8dd',
  dark: '#1a1512'
};

export const metadata: Metadata = {
  // `template` so page titles read "الجمعيات | وزارة الثقافة" without every
  // page having to repeat the suffix.
  title: {
    default: 'وزارة الثقافة — سجل الجمعيات الثقافية',
    template: '%s | وزارة الثقافة'
  },
  description: 'سجل الجمعيات الثقافية في محافظة إربد — بحث وتصفية وتقارير.'
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The app ships a single theme, so data-theme is static. Light/dark is a
    // separate axis, handled by next-themes via the `class` attribute.
    //
    // `dir='rtl'` is set here rather than on the dashboard shell so that
    // portalled overlays — which Base UI renders at the end of <body> — inherit
    // it too. Set it lower down and every popover, dialog and toast would
    // silently revert to left-to-right.
    // `fontVariables` belongs on <html>, not <body>: the theme declares
    // `--font-sans: var(--font-plex-arabic), …` on this same element. A custom
    // property that references an undefined variable resolves to nothing, so
    // with the font classes one level down the whole declaration would be
    // invalid and every surface would silently fall back to the system sans.
    <html
      lang='ar'
      dir='rtl'
      suppressHydrationWarning
      data-theme={DEFAULT_THEME}
      className={fontVariables}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Set meta theme color
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body className={cn('bg-background overflow-x-hidden overscroll-none font-sans antialiased')}>
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
