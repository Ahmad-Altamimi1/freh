import { Geist, Geist_Mono } from 'next/font/google';

import { cn } from '@/lib/utils';

/**
 * Fonts referenced by the active theme.
 *
 * Keep this list in sync with the `--font-*` values in
 * `src/styles/themes/*.css`. Every loader here is fetched at build time and its
 * CSS variable injected on every page, so an unused entry is pure overhead.
 *
 * The vercel theme uses Geist, Geist Mono, and system Georgia for serif.
 */

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans'
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono'
});

export const fontVariables = cn(fontSans.variable, fontMono.variable);
