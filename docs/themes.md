# Theming

The app ships a **single theme** (`vercel`). There is no theme picker — the value is set statically on `<html>`.

Light/dark is a separate axis, handled by [next-themes](https://github.com/pacocoursey/next-themes) via a `class` on `<html>`, and is still switchable from the header toggle or Cmd+K.

## How it is wired

| Piece | File |
| --- | --- |
| Active theme name | `src/components/themes/theme.config.ts` (`DEFAULT_THEME`) |
| Applied to `<html>` | `src/app/layout.tsx` (`data-theme={DEFAULT_THEME}`) |
| Color tokens | `src/styles/themes/vercel.css` |
| CSS import | `src/styles/theme.css` |
| Fonts | `src/components/themes/font.config.ts` |
| Light/dark provider | `src/components/themes/theme-provider.tsx` |
| Light/dark toggle | `src/components/themes/theme-mode-toggle.tsx` |

## Token structure

A theme file defines three blocks, all scoped to the theme's `data-theme` value:

```css
[data-theme='vercel'] {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0 0 0);
  --primary: oklch(0 0 0);
  /* …plus --card, --popover, --muted, --accent, --destructive,
     --border, --input, --ring, --sidebar-*, --chart-1..5, fonts, radius */
}

[data-theme='vercel'].dark {
  /* the same token names, dark values */
}

[data-theme='vercel'] {
  @theme inline {
    /* maps the CSS variables into Tailwind utilities */
    --color-background: var(--background);
    --font-sans: var(--font-sans);
  }
}
```

Colors are [OKLCH](https://oklch.com) — perceptually uniform, so adjusting lightness does not shift hue.

The `.dark` block must be `[data-theme='x'].dark`, not `.dark [data-theme='x']`. next-themes puts the `dark` class on the same `<html>` element that carries `data-theme`, so a descendant selector never matches.

## Changing the theme

1. Add `src/styles/themes/<name>.css`, scoped to `[data-theme='<name>']`.
2. Import it in `src/styles/theme.css`.
3. Set `DEFAULT_THEME = '<name>'` in `src/components/themes/theme.config.ts`.
4. If the theme uses different fonts, update `font.config.ts` — see below.

Restart the dev server; `@theme inline` is resolved at build time.

## Fonts

`font.config.ts` exports `fontVariables`, applied to **`<html>`** in the root layout. Every loader listed there is fetched at build time and its CSS variable injected on every page, so **an unused entry is pure overhead** — keep the list matched to the `--font-*` values your theme actually references.

The vercel theme uses IBM Plex Sans Arabic, Geist Mono, and system Georgia for serif, so only two loaders are declared. The sans face must carry Arabic glyphs — the UI is Arabic. A Latin-only family does not fail loudly; the browser silently substitutes a system serif for every Arabic string.

Two rules keep the wiring unambiguous:

- **A loader must not publish as `--font-sans` directly.** The theme declares `--font-sans` on `[data-theme='…']`, and `<html>` carries both that attribute and the font class — two declarations of equal specificity whose winner depends on stylesheet injection order. Loaders publish their own name (`--font-plex-arabic`), and the theme points `--font-sans` at it.
- **`fontVariables` belongs on `<html>`, not `<body>`.** A custom property referencing an undefined variable resolves to nothing, so with the font class one level below the theme's `var()` reference, `--font-sans` would compute to empty and everything would fall back to the system sans.

To add one:

```ts
import { Outfit } from 'next/font/google';

const fontOutfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const fontVariables = cn(fontSans.variable, fontMono.variable, fontOutfit.variable);
```

Then reference it in the theme CSS: `--font-sans: var(--font-outfit), sans-serif;`

## Restoring a theme picker

Multi-theme switching was removed along with the extra themes. To bring it back you would need a client context holding the active theme name, a cookie so the server can render the right `data-theme` without a flash, and a `<select>` in the header. The original implementation is in the upstream template (`active-theme.tsx` and `theme-selector.tsx`) if you want a reference.

## Troubleshooting

**Colors do not change** — confirm the CSS file is imported in `theme.css` and its selector matches `DEFAULT_THEME` exactly. Check `<html data-theme="…">` in devtools.

**Dark mode does not apply** — the block must be `[data-theme='x'].dark` on the same element.

**Fonts do not apply** — check `getComputedStyle(document.documentElement).getPropertyValue('--font-sans')` in devtools. If it is **empty**, the theme is referencing a loader variable that is not defined on `<html>`: verify the name in the theme CSS matches the loader's `variable` in `font.config.ts`, and that `fontVariables` is on `<html>` rather than `<body>`.

**Arabic text renders in the wrong face** — the loader's `subsets` must include `'arabic'`, and the family must actually ship Arabic glyphs. There is no error when it does not; the browser just substitutes.
