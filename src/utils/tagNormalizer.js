/**
 * Blog tag normalization utility.
 *
 * Canonical comparison form for matching and deduplication.
 * Display spelling is preserved separately; this is only for comparison.
 */

/**
 * Normalize a tag value for comparison purposes.
 * Rules:
 *   - Unicode NFC normalization
 *   - Trim leading/trailing whitespace
 *   - Collapse repeated internal spaces to single space
 *   - Lowercase (locale-aware)
 *
 * Tags differing only by case, whitespace, or Unicode normalization
 * are treated as identical.
 *
 * @param {string} value
 * @returns {string}
 */
export const normalizeTagForComparison = (value) =>
  String(value || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();

/**
 * Check whether two tag values are canonical duplicates.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const areTagsEquivalent = (a, b) =>
  normalizeTagForComparison(a) === normalizeTagForComparison(b);

/**
 * Acceptable maximums for blog tags.
 * These match the existing normalizeTags() cap of 12.
 */
export const MAX_BLOG_TAGS = 12;
export const MAX_BLOG_TAG_LENGTH = 80;

/**
 * Validate a single raw tag string.
 * Returns an error message string or null.
 *
 * @param {string} value
 * @returns {string|null}
 */
export const validateTag = (value) => {
  if (!value || typeof value !== 'string') return 'Tag cannot be empty.';
  const trimmed = value.trim();
  if (!trimmed) return 'Tag cannot be empty.';
  if (trimmed.replace(/\s+/g, ' ').length > MAX_BLOG_TAG_LENGTH) {
    return `Tag must be shorter than ${MAX_BLOG_TAG_LENGTH} characters.`;
  }
  return null;
};

/**
 * Build a deduplicated tag inventory from blog posts.
 * Preserves the first-encountered canonical display spelling
 * and returns tags sorted alphabetically.
 *
 * @param {Array<{ tags: string[] }>} posts
 * @returns {{ display: string, normalized: string }[]}
 */
export const buildTagInventory = (posts) => {
  if (!Array.isArray(posts)) return [];

  const map = new Map(); // normalized -> canonical display

  for (const post of posts) {
    const tags = post?.tags;
    if (!Array.isArray(tags)) continue;

    for (const tag of tags) {
      if (!tag || typeof tag !== 'string') continue;
      const display = tag.trim().replace(/\s+/g, ' ');
      if (!display) continue;

      const normalized = normalizeTagForComparison(display);
      if (!map.has(normalized)) {
        map.set(normalized, display);
      }
    }
  }

  return Array.from(map.entries())
    .map(([normalized, display]) => ({ display, normalized }))
    .sort((a, b) => a.display.localeCompare(b.display));
};
