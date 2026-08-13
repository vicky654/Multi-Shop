/**
 * File-download helpers, shared by every export/sample button.
 *
 * WHY A SHARED HELPER
 *   The old inline download had four separate problems, and each one would have
 *   to be fixed again in every new export button:
 *
 *   1. The filename was invented client-side (`products-${Date.now()}.csv`),
 *      ignoring the descriptive one the server sends in Content-Disposition.
 *   2. The MIME type was hardcoded to text/csv, so an .xlsx download was handed
 *      to the browser as a CSV and some browsers renamed or mangled it.
 *   3. `URL.revokeObjectURL` ran on the line after `.click()`. The click is
 *      asynchronous, so revoking immediately can cancel the download — and the
 *      anchor was never added to the document, which Firefox requires.
 *   4. With `responseType: 'blob'`, an error response body is ALSO a blob. So a
 *      403 or a 500 was saved to disk as a file full of JSON, or surfaced as a
 *      generic "Export failed" with the real reason locked inside the blob.
 */

/** Parse the filename out of a Content-Disposition header. */
export function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  // RFC 5987 form first (filename*=UTF-8''...), then the plain quoted form.
  const utf8 = /filename\*=UTF-8''([^;\n]+)/i.exec(disposition);
  if (utf8) {
    try { return decodeURIComponent(utf8[1]); } catch { /* fall through */ }
  }
  const plain = /filename="?([^";\n]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : fallback;
}

/**
 * A blob response that is actually a JSON error.
 *
 * The server sends application/json for failures and a spreadsheet MIME type for
 * successes, so the content type is the reliable signal — the status alone is not
 * available once axios has rejected.
 */
export async function errorFromBlob(blob) {
  if (!blob || typeof blob.text !== 'function') return null;
  const type = blob.type || '';
  if (!type.includes('json') && !type.includes('text/plain')) return null;
  try {
    const parsed = JSON.parse(await blob.text());
    return parsed?.message || null;
  } catch {
    return null;
  }
}

/**
 * Save a Blob to the user's downloads.
 *
 * @param {Blob}   blob
 * @param {string} filename
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  // Firefox ignores a click on an anchor that is not in the document.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  // Give the browser a turn to start the download before tearing the URL down.
  // Revoking synchronously after click() aborts it in Safari and older Chrome.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

/**
 * Run a blob-returning request and save the result, using the server's filename.
 *
 * @param {() => Promise<import('axios').AxiosResponse>} request
 * @param {string} fallbackName used only if the server sends no filename
 * @returns {Promise<{filename:string, count:number|null, size:number}>}
 * @throws {Error} with the server's real message when the body is a JSON error
 */
export async function downloadResponse(request, fallbackName) {
  let res;
  try {
    res = await request();
  } catch (err) {
    // axios rejected: the body may still be a blob holding the real message.
    const fromBlob = await errorFromBlob(err?.response?.data);
    throw new Error(fromBlob || err?.message || 'Download failed');
  }

  const blob = res.data;
  // A 200 whose body is JSON means the server reported a problem without using
  // an error status. Surface it instead of saving a .csv full of JSON.
  const jsonMessage = await errorFromBlob(blob);
  if (jsonMessage) throw new Error(jsonMessage);

  if (!blob || blob.size === 0) {
    // A genuinely empty file is a bug worth naming: an export always has at
    // least a header row.
    throw new Error('The server returned an empty file');
  }

  const filename = filenameFromDisposition(
    res.headers?.['content-disposition'],
    // Prefer the explicit header when the proxy strips Content-Disposition.
    res.headers?.['x-export-filename'] || fallbackName
  );

  saveBlob(blob, filename);

  const rawCount = res.headers?.['x-export-count'];
  return {
    filename,
    count: rawCount == null ? null : Number(rawCount),
    size: blob.size,
  };
}
