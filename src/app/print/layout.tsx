import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

/**
 * Chrome-free shell for printable documents.
 *
 * Deliberately outside `/dashboard` so the sidebar, header and info panel are
 * absent from the DOM entirely rather than hidden with `print:hidden`. The
 * headless-Chromium PDF route renders these same URLs, and anything present but
 * hidden is still laid out — an off-screen sidebar would shift the A4 content
 * box and silently mis-align every page.
 *
 * Authorization is not weakened by leaving `/dashboard`: `requireUser()` in the
 * page is the boundary (the proxy is a UX redirect), and `src/proxy.ts` covers
 * `/print` as well.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* A4 with the margins a Jordanian government document is filed at.
           Mirrored by the PDF route's \`page.pdf({ margin })\` — Puppeteer's
           margin option overrides @page rather than reading it, so if the two
           disagree the repeating header and footer have no margin to occupy.
           The top margin is the larger of the two because the running header
           carries the emblem. */
        @page {
          size: A4;
          margin: 32mm 14mm 20mm;
        }

        /* On screen the document is shown as a centred sheet so the preview
           matches the printed page; in print the sheet IS the page, so the
           frame, shadow and background are dropped. */
        .doc-sheet {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 26mm 14mm 22mm;
          background: #fff;
          color: #111;
          box-shadow: 0 1px 3px rgb(0 0 0 / 0.12), 0 8px 24px rgb(0 0 0 / 0.08);
        }

        /*
          There is deliberately NO CSS running header/footer here.

          The usual trick — \`position: fixed\` repeated per page — does not
          position reliably against a Puppeteer-supplied margin box: Chrome
          resolves the offsets against the page area, but the paginated layout
          then re-anchors them, and the elements land on top of the table rows
          instead of in the margin. The repeating header and footer are supplied
          by \`headerTemplate\`/\`footerTemplate\` in the PDF route, which is the
          mechanism Chrome actually supports for margin-box content.

          Consequence worth knowing: printing this page straight from the browser
          (Ctrl+P) gets the masthead on page one only, plus whatever header and
          footer the browser's own print dialog adds. The PDF download is the
          path that produces the fully-formed document.
        */

        @media print {
          html, body {
            background: #fff !important;
            margin: 0;
            padding: 0;
          }

          .doc-sheet {
            width: auto;
            min-height: 0;
            margin: 0;
            padding: 0;
            box-shadow: none;
          }

          /* Repeat the detail table's column headings on every page. */
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr, img, .avoid-break { break-inside: avoid; }

          /* Chrome drops background fills when printing unless asked. Table
             header shading is structural here, not decoration. */
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {children}
    </>
  );
}
