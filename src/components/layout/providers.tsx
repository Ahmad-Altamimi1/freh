'use client';
import React from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import QueryProvider from './query-provider';

/**
 * `DirectionProvider` is what makes RTL work for every Base UI primitive at
 * once — menus, selects, popovers, tooltips, sliders. Those components position
 * themselves in JavaScript and read direction from this context rather than
 * from the `dir` attribute, so without it `align='start'` would keep resolving
 * to the left edge on an otherwise right-to-left page.
 *
 * Must agree with the `dir` on <html> in `app/layout.tsx`.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider direction='rtl'>
      <QueryProvider>{children}</QueryProvider>
    </DirectionProvider>
  );
}
