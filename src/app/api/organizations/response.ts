const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Streams a workbook as a download.
 *
 * The filename is sent twice on purpose. `filename=` carries an ASCII fallback
 * because the header must be Latin-1; `filename*=UTF-8''…` carries the real
 * Arabic name (RFC 5987) and is what every current browser actually uses. With
 * only the first, the file saves under a name of question marks; with only the
 * second, older clients see no name at all.
 */
export function xlsxResponse(buffer: ArrayBuffer, filename: string): Response {
  return downloadResponse(buffer, filename, XLSX_CONTENT_TYPE);
}

/** Streams a generated report as a PDF download. Same header rules as above. */
export function pdfResponse(buffer: ArrayBuffer | Uint8Array, filename: string): Response {
  return downloadResponse(buffer, filename, 'application/pdf');
}

function downloadResponse(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Response {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const body = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(body.byteLength),
      // A filtered export is a snapshot of a query; caching it would serve stale
      // rows to the next person who asks for the same URL.
      'Cache-Control': 'no-store'
    }
  });
}
