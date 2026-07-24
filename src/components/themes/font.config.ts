import { Geist_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';

import { cn } from '@/lib/utils';

/**
 * Fonts referenced by the active theme.
 *
 * Keep this list in sync with the `--font-*` values in
 * `src/styles/themes/*.css`. Every loader here is fetched at build time and its
 * CSS variable injected on every page, so an unused entry is pure overhead.
 *
 * The UI is Arabic, so the sans face must carry Arabic glyphs. Geist — the
 * template's default — has none, which does not fail loudly: the browser
 * silently falls back to a system serif for every Arabic string, so the whole
 * app renders in a font nobody chose. IBM Plex Sans Arabic covers both scripts,
 * keeping Arabic body text and Latin identifiers visually consistent.
 */

/**
 * The loaders publish their own variable names, which the theme then points
 * `--font-sans` / `--font-mono` at.
 *
 * They must not publish directly as `--font-sans`: the theme sets that same
 * property on the same element (`<html>` carries both `data-theme` and the
 * font class), giving two declarations of equal specificity whose winner
 * depends on stylesheet injection order. One indirection makes the theme the
 * single place a family is chosen.
 */
const fontSans = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  // This family has no variable axis, so every weight used must be listed.
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-arabic'
});

/**
 * Kept for national IDs, phone numbers and other tabular figures, which read
 * better monospaced and are always Latin-digit.
 */
const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono'
});

export const fontVariables = cn(fontSans.variable, fontMono.variable);
