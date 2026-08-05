// ── Filename preparation helper for QDN upload safety ──
//
// Responsibilities:
//  - Unicode NFC normalization
//  - Produce a safe technical filename for bridge/core
//  - Preserve original filename for display
//  - Remove path separators and control characters
//  - Handle edge cases: empty basename, path traversal, long names

/**
 * Prepares a user-uploaded filename for safe publication to QDN.
 *
 * Returns the original (NFC-normalized) display name and a
 * bridge-safe technical filename suitable for the `filename`
 * field in PUBLISH_QDN_RESOURCE requests.
 *
 * @param {string} originalFilename - Raw file.name from the browser File API
 * @returns {{
 *   originalFilename: string,
 *   technicalFilename: string,
 *   extension: string,
 * }}
 */
export const prepareUploadFilename = (originalFilename) => {
  if (!originalFilename || typeof originalFilename !== 'string') {
    const fallback = 'upload.bin';
    return {
      originalFilename: fallback,
      technicalFilename: fallback,
      extension: 'bin',
    };
  }

  // ── 1. NFC normalize (handle NFD from macOS / cross-platform) ──
  const normalized = originalFilename.normalize('NFC');

  // ── 2. Extract extension ──
  const lastDot = normalized.lastIndexOf('.');
  let basename;
  let extension;
  if (lastDot > 0 && lastDot < normalized.length - 1) {
    basename = normalized.slice(0, lastDot);
    extension = normalized.slice(lastDot + 1).toLowerCase();
  } else {
    basename = normalized;
    extension = '';
  }

  // ── 3. Build safe technical basename ──
  let tech = basename
    .normalize('NFKD')                                // Decompose: ä → a + combining diaeresis
    .replace(/[\u0300-\u036f]/g, '')                   // Remove combining diacritical marks
    .replace(/[<>:"/\\|?*]/g, '')                      // Remove unsafe ASCII filename characters
    .replace(/\s+/g, '-')                               // Whitespace → single dash
    .replace(/[^a-zA-Z0-9._-]/g, '-')                  // Remaining non-ASCII → dash
    .replace(/-{2,}/g, '-')                             // Collapse repeated dashes
    .replace(/^[-.]+|[-.]+$/g, '')                      // Trim leading/trailing dashes and dots
    .slice(0, 200);                                     // Length cap

  // ── 4. Handle empty basename after sanitization ──
  if (!tech) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    tech = `upload-${ts}`;
  }

  // ── 5. Remove path traversal remnants ──
  tech = tech.replace(/\.\./g, '').replace(/^\.+/, '');
  if (!tech) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    tech = `upload-${ts}`;
  }

  // ── 6. Assemble technical filename ──
  const technicalFilename = extension ? `${tech}.${extension}` : tech;

  // ── 7. Final fallback ──
  const finalTech = technicalFilename || 'upload.bin';
  const finalExt = extension || 'bin';

  return {
    originalFilename: normalized,
    technicalFilename: finalTech,
    extension: finalExt,
  };
};

/**
 * Quick check: would this filename need technical normalization?
 * Returns true for ASCII-only safe names that can be used as-is.
 */
export const isSafeAsciiFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return false;
  const normalized = filename.normalize('NFC');
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,178}[a-zA-Z0-9._-]$/.test(normalized)
    || /^[a-zA-Z0-9]$/.test(normalized);
};
