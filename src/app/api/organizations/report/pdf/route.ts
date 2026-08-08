import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import type { Browser } from 'puppeteer-core';

import { ORGANIZATION_LABELS } from '@/features/organizations/constants/labels';
import { can } from '@/lib/auth/access';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { pdfResponse } from '../../response';

const DOC = ORGANIZATION_LABELS.document;

/**
 * Renders the printable report route to a PDF.
 *
 * Headless Chromium rather than a JavaScript PDF library, because the document
 * is Arabic. jsPDF, pdfkit and @react-pdf/renderer draw glyphs at coordinates —
 * none of them implement the bidirectional algorithm or Arabic contextual
 * shaping, so text comes out unjoined and in the wrong order. Chromium is the
 * same engine that renders the on-screen page, so the PDF is typographically
 * identical to the preview by construction.
 *
 * The Arabic font is not a system dependency: `next/font/google` self-hosts IBM
 * Plex Sans Arabic under `/_next/static/media`, so the headless browser fetches
 * it from this same origin. A bare serverless container with no Arabic system
 * font still renders correctly — but only if the webfont has finished loading,
 * which is what the `document.fonts.ready` wait below guarantees.
 */

// Chromium cannot run on the edge runtime, and the render needs longer than the
// default serverless ceiling on a report with a few thousand detail rows.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
 * The repeating page header: ministry hierarchy, emblem, report title.
 *
 * Chromium renders margin-box templates at a default font-size of zero, so every
 * size here is explicit. The horizontal padding matches the page's side margins
 * so the header's rule lines up with the content below it.
 */
function buildHeaderTemplate(emblem: string): string {
  return `
    <div dir="rtl" style="width:100%;box-sizing:border-box;padding:0 14mm;
                          font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;
                          font-size:8pt;color:#444;-webkit-print-color-adjust:exact;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8mm;
                  border-bottom:0.4mm solid #333;padding-bottom:1.5mm;">
        <div style="text-align:right;line-height:1.5;">
          <div style="font-weight:700;color:#000;">${DOC.kingdom}</div>
          <div>${DOC.ministry}</div>
          <div>${DOC.directorate}</div>
        </div>
        <img src="${emblem}" alt="" style="height:13mm;width:auto;object-fit:contain;" />
        <div style="text-align:left;line-height:1.5;font-weight:700;color:#000;">
          ${DOC.runningTitle}
        </div>
      </div>
    </div>
  `;
}

/** The repeating page footer: provenance on one side, page number on the other. */
function buildFooterTemplate(): string {
  return `
    <div dir="rtl" style="width:100%;box-sizing:border-box;padding:0 14mm;
                          font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;
                          font-size:8pt;color:#555;-webkit-print-color-adjust:exact;">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  border-top:0.3mm solid #999;padding-top:1.5mm;">
        <span>${DOC.printedNote}</span>
        <span dir="ltr"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!(await can(PERMISSIONS.REPORTS_EXPORT_PDF))) {
    return new Response('Forbidden', { status: 403 });
  }

  // The report is described entirely by the print route's own query string, so
  // this endpoint forwards rather than re-parses it. Only the two parameters
  // that identify a report are copied — never the whole query — so this cannot
  // be used to make the browser fetch an arbitrary internal URL.
  const printUrl = new URL('/print/organizations-report', request.nextUrl.origin);
  for (const key of ['d', 'template'] as const) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) printUrl.searchParams.set(key, value);
  }

  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // The print page carries the same `reports:export:pdf` check as this route.
    // Forwarding the caller's session cookie is what lets the headless browser
    // authenticate as them — it renders exactly what this user is allowed to
    // see, nothing more, and a caller who lost the permission between the two
    // checks is refused there as well.
    const cookie = request.headers.get('cookie');
    if (cookie) await page.setExtraHTTPHeaders({ Cookie: cookie });

    const response = await page.goto(printUrl.toString(), {
      waitUntil: 'networkidle0',
      timeout: 45_000
    });

    // A redirect to sign-in returns 200 with a login page, so status alone is
    // not enough — but a hard failure should not be silently rendered as a PDF
    // of an error page either.
    if (!response || !response.ok()) {
      return new Response('تعذّر إنشاء التقرير.', { status: 502 });
    }

    // Arabic shapes correctly only once the webfont is in place; without this
    // the PDF can capture a fallback-font first paint.
    await page.evaluateHandle('document.fonts.ready');

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      // Must mirror the `@page` rule in src/app/print/layout.tsx. Puppeteer's
      // margin option REPLACES the CSS one rather than deferring to it, and
      // these margins are the boxes the templates below are drawn into.
      margin: { top: '32mm', right: '14mm', bottom: '20mm', left: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(await getEmblem()),
      footerTemplate: buildFooterTemplate()
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return pdfResponse(buffer, `تقرير-الجمعيات-${stamp}.pdf`);
  } catch (error) {
    console.error('report pdf generation failed', error);

    // In production the cause stays in the log — a Chromium stack trace names
    // internal paths. In development it goes to the browser, because this route
    // is opened directly as a link and a bare "تعذّر" gives nothing to act on.
    const detail = error instanceof Error ? error.message : String(error);
    return new Response(
      process.env.NODE_ENV === 'production'
        ? 'تعذّر إنشاء ملف PDF.'
        : `تعذّر إنشاء ملف PDF.\n\n${detail}`,
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  } finally {
    await browser?.close();
  }
}
