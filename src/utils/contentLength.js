/**
 * Effective content-length utility for rich-text (BBCode) content.
 *
 * Strips BBCode tags, HTML tags, and QDN shortcode payloads to
 * produce a character count that approximates visible text length.
 */

const BBCode_TAG_RE = /\[(\/)?(b|i|u|h2|h3|quote|code|url|color|imageqdn|videoqdn|fileqdn|qdnembed)[^\]]*\]/gi;
const HTML_TAG_RE = /<[^>]*>/g;
const WHITESPACE_COLLAPSE_RE = /\s+/g;

/**
 * Return an approximate visible-character count for BBCode or HTML content.
 *
 * - Strips all BBCode formatting tags
 * - Strips all HTML tags
 * - Collapses whitespace
 * - Does NOT count QDN shortcode payload as visible characters
 *
 * @param {string} content  BBCode or HTML string
 * @returns {number}
 */
export function getEffectiveContentLength(content) {
  if (!content || typeof content !== 'string') return 0;

  let cleaned = content;

  // 1. Strip BBCode tags (formatting + QDN embeds)
  cleaned = cleaned.replace(BBCode_TAG_RE, '');

  // 2. Strip any residual HTML tags
  cleaned = cleaned.replace(HTML_TAG_RE, '');

  // 3. Collapse whitespace and trim
  cleaned = cleaned.replace(WHITESPACE_COLLAPSE_RE, ' ').trim();

  return cleaned.length;
}

/**
 * Content collapse threshold (effective characters).
 * Content at or above this length starts collapsed in edit mode.
 */
export const BLOG_CONTENT_COLLAPSE_THRESHOLD = 20_000;
