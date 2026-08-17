import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import type { Browser } from 'puppeteer-core';

import { APP_CREDIT, APP_CREDIT_AFFILIATION, copyrightYear } from '@/config/app-credit';

/**
 * Renders a route under `/print` to a PDF with headless Chromium.
 *
 * Headless Chromium rather than a JavaScript PDF library, because the documents
 * are Arabic. jsPDF, pdfkit and @react-pdf/renderer draw glyphs at coordinates —
 * none of them implement the bidirectional algorithm or Arabic contextual
 * shaping, so text comes out unjoined and in the wrong order. Chromium is the
 * same engine that renders the on-screen page, so the PDF is typographically
 * identical to the preview by construction.
 *
 * The Arabic font is not a system dependency *for the page body*:
 * `next/font/google` self-hosts IBM Plex Sans Arabic under
 * `/_next/static/media`, so the headless browser fetches it from this same
 * origin. A bare serverless container with no Arabic system font still renders
 * the body correctly — but only if the webfont has finished loading, which is
 * what the `document.fonts.ready` wait below guarantees.
 *
 * The margin boxes are the exception. Chromium renders the header and footer
 * templates as isolated documents that cannot reach the page's stylesheets, so
 * the letterhead falls back to whatever the *system* provides — hence the Noto
 * Arabic names in their font stacks, and the font package the self-host
 * Dockerfile installs. Without one, only the letterhead prints as boxes.
 *
 * Every caller is a `nodejs`-runtime route: Chromium cannot run on the edge.
 */

/** The ministry hierarchy and running title drawn into every page's margin. */
export type PrintLetterhead = {
  kingdom: string;
  ministry: string;
  directorate: string;
  /** Shown in the repeating page header, beside the emblem. */
  runningTitle: string;
  /** Provenance line in the repeating footer. */
  printedNote: string;
};

export type RenderPrintPageOptions = {
  /** The incoming request — its origin and session cookie are both reused. */
  request: NextRequest;
  /** Path of the printable route, e.g. `/print/organizations-report`. */
  printPath: string;
  /**
   * Query parameters to put on the print URL.
   *
   * Callers pass an explicit record rather than forwarding their own query
   * string wholesale, so this can never be used to make the headless browser
   * fetch an arbitrary internal URL.
   */
  searchParams?: Record<string, string | undefined>;
  letterhead: PrintLetterhead;
};

/** A render that failed in a way the caller should turn into a specific status. */
export class PrintRenderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PrintRenderError';
    this.status = status;
  }
}

/**
 * The emblem, inlined as a data URI and read once per server process.
 *
 * Header and footer templates are rendered by Chromium as isolated documents
 * with no access to the page's origin, stylesheets or network context — a
 * `<img src="/logo-mark.png">` there silently resolves to nothing. Base64 is the
 * only reliable way to get artwork into a margin box.
 */
let emblemDataUri: string | null = null;

async function getEmblem(): Promise<string> {
  if (emblemDataUri === null) {
    const file = await readFile(path.join(process.cwd(), 'public', 'logo-mark.png'));
    emblemDataUri = `data:image/png;base64,${file.toString('base64')}`;
  }
  return emblemDataUri;
}

/**
 * The repeating page header: ministry hierarchy, emblem, document title.
 *
 * Chromium renders margin-box templates at a default font-size of zero, so every
 * size here is explicit. The horizontal padding matches the page's side margins
 * so the header's rule lines up with the content below it.
 */
function buildHeaderTemplate(emblem: string, letterhead: PrintLetterhead): string {
  return `
    <div dir="rtl" style="width:100%;box-sizing:border-box;padding:0 14mm;
                          font-family:'IBM Plex Sans Arabic','Noto Naskh Arabic','Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;
                          font-size:8pt;color:#444;-webkit-print-color-adjust:exact;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8mm;
                  border-bottom:0.4mm solid #333;padding-bottom:1.5mm;">
        <div style="text-align:right;line-height:1.5;">
          <div style="font-weight:700;color:#000;">${letterhead.kingdom}</div>
          <div>${letterhead.ministry}</div>
          <div>${letterhead.directorate}</div>
        </div>
        <img src="${emblem}" alt="" style="height:13mm;width:auto;object-fit:contain;" />
        <div style="text-align:left;line-height:1.5;font-weight:700;color:#000;">
          ${letterhead.runningTitle}
        </div>
      </div>
    </div>
  `;
}

/**
 * The repeating page footer.
 *
 * Two rows: provenance and page number, then attribution and the rights line.
 * The attribution row is the only reason the credit survives the document —
 * a filed PDF outlives the app it came from, and page one's letterhead is the
 * issuing authority's, not the author's.
 *
 * `© 2026` is wrapped in its own `dir="ltr"` span: the mark and the digits are
 * bidi-neutral, so unmarked they get reordered to the far end of the RTL line
 * and the dash ends up leading it.
 */
function buildFooterTemplate(letterhead: PrintLetterhead): string {
  return `
    <div dir="rtl" style="width:100%;box-sizing:border-box;padding:0 14mm;
                          font-family:'IBM Plex Sans Arabic','Noto Naskh Arabic','Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;
                          font-size:8pt;color:#555;-webkit-print-color-adjust:exact;">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  border-top:0.3mm solid #999;padding-top:1.5mm;">
        <span>${letterhead.printedNote}</span>
        <span dir="ltr"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding-top:0.8mm;font-size:7pt;color:#777;">
        <!-- Middot, not a dash, between the name and the affiliation: the
             affiliation already contains an em dash, and two of them in one
             line read as a single run-on rather than two facts. -->
        <span>${APP_CREDIT.role}:
          <span style="color:#000;font-weight:700;">${APP_CREDIT.name}</span>
          · ${APP_CREDIT_AFFILIATION}
        </span>
        <span><span dir="ltr">© ${copyrightYear()}</span> — ${APP_CREDIT.rightsReserved}</span>
      </div>
    </div>
  `;
}

/** Where to find a Chromium build, which differs between local dev and deploy. */
async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');

  // An explicit path always wins — this is the escape hatch for local
  // development and for self-hosted Docker images that install their own
  // Chromium via the system package manager.
  const override = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (override) {
    return puppeteer.launch({
      executablePath: override,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      headless: true
    });
  }

  // Serverless: @sparticuz/chromium ships a Chromium built to fit inside a
  // Lambda-style bundle, which the stock download is far too large for. Its
  // binary is Linux-only, so on any other platform the failure is a
  // configuration mistake with a known fix — say so rather than surfacing
  // whatever ENOENT the launcher happens to throw.
  if (process.platform !== 'linux') {
    throw new Error(
      `@sparticuz/chromium ships a Linux-only binary and cannot run on ${process.platform}. ` +
        'Set PUPPETEER_EXECUTABLE_PATH in .env.local to a local Chrome/Edge executable, ' +
        'then restart the dev server.'
    );
  }

  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    headless: true
  });
}

/** Renders one printable route to PDF bytes. Throws `PrintRenderError` on a bad render. */
export async function renderPrintPageToPdf(options: RenderPrintPageOptions): Promise<Uint8Array> {
  const { request, printPath, searchParams, letterhead } = options;

  const printUrl = new URL(printPath, request.nextUrl.origin);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) printUrl.searchParams.set(key, value);
  }

  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // The print page carries the same permission check as the calling route.
    // Forwarding the caller's session cookie is what lets the headless browser
    // authenticate as them — it renders exactly what this user is allowed to
    // see, nothing more, and a caller who lost the permission between the two
    // checks is refused there as well.
    //
    // Build the cookie string from `request.cookies` rather than the raw
    // `Cookie` header: the proxy middleware may have rotated the Supabase
    // refresh token, updating the cookie store but invalidating the original
    // header value. Forwarding the stale header makes Chromium hit the proxy
    // with a dead token and land on the sign-in page.
    const cookieString = request.cookies
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    if (cookieString) await page.setExtraHTTPHeaders({ Cookie: cookieString });

    const response = await page.goto(printUrl.toString(), {
      waitUntil: 'networkidle0',
      timeout: 45_000
    });

    if (!response || !response.ok()) {
      throw new PrintRenderError('تعذّر إنشاء المستند.', 502);
    }

    // A redirect to sign-in returns 200 — a successful page load, just the
    // wrong page. Catch it by checking whether Chromium ended up on the URL
    // we asked for rather than somewhere else.
    const finalUrl = page.url();
    if (!finalUrl.includes('/print/')) {
      throw new PrintRenderError('انتهت الجلسة — أعد تسجيل الدخول وحاول مجددًا.', 401);
    }

    // Arabic shapes correctly only once the webfont is in place; without this
    // the PDF can capture a fallback-font first paint.
    await page.evaluateHandle('document.fonts.ready');

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      // Must mirror the `@page` rule in src/app/print/layout.tsx. Puppeteer's
      // margin option REPLACES the CSS one rather than deferring to it, and
      // these margins are the boxes the templates below are drawn into.
      margin: { top: '32mm', right: '14mm', bottom: '20mm', left: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(await getEmblem(), letterhead),
      footerTemplate: buildFooterTemplate(letterhead)
    });
  } finally {
    await browser?.close();
  }
}

/**
 * Turns a failed render into a response.
 *
 * In production the cause stays in the log — a Chromium stack trace names
 * internal paths. In development it goes to the browser, because these routes
 * are opened directly as a link and a bare "تعذّر" gives nothing to act on.
 */
export function printFailureResponse(error: unknown, context: string): Response {
  if (error instanceof PrintRenderError) {
    return new Response(error.message, {
      status: error.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  console.error(`${context} pdf generation failed`, error);

  const detail = error instanceof Error ? error.message : String(error);
  return new Response(
    process.env.NODE_ENV === 'production'
      ? 'تعذّر إنشاء ملف PDF.'
      : `تعذّر إنشاء ملف PDF.\n\n${detail}`,
    { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
