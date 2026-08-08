'use client';

import * as React from 'react';

/**
 * Opens the browser's print dialog once the document has painted.
 *
 * Mounted only when the URL carries `autoprint=1`, which the builder's
 * "print" button sets — opening the preview without it lets someone read the
 * document first. Printing is a browser capability, so this is the one client
 * component in the print tree; the document itself renders on the server.
 *
 * The double `requestAnimationFrame` waits for the first paint rather than for
 * hydration: calling `print()` in an effect can capture the page before the
 * fonts and the emblem have been laid out, which prints a blank first line.
 */
export function AutoPrint() {
  React.useEffect(() => {
    let cancelled = false;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) window.print();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
