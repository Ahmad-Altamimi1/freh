'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { usePathname } from 'next/navigation';
import { getQueryClient } from '@/lib/query-client';
import type * as React from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const pathname = usePathname();

  /**
   * `/print` renders documents that get captured as PDFs, and the devtools
   * launcher is a floating element that lands on the page as a coloured blob.
   * Not rendered at all rather than hidden with `print:hidden`: headless
   * Chromium screenshots the same DOM, and a hidden-but-present overlay still
   * participates in layout.
   */
  const isPrintDocument = pathname?.startsWith('/print') ?? false;

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {!isPrintDocument && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
