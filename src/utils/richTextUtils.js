/**
 * Rich-text formatting utilities — ported from the Blogs project.
 *
 * Uses BBCode-like custom markup in a textarea, with formatting
 * functions that produce sanitised HTML for QDN storage.
 */

// ── Format tag definitions ──────────────────────────────────

export const RICH_TEXT_FORMAT_TAGS = {
  bold: ['[b]', '[/b]'],
  italic: ['[i]', '[/i]'],
  underline: ['[u]', '[/u]'],
  heading2: ['[h2]', '[/h2]'],
  heading3: ['[h3]', '[/h3]'],
  quote: ['[quote]', '[/quote]'],
  code: ['[code]', '[/code]'],
  link: ['[url=qdn://]', '[/url]'],
};

// ── Selection helpers ───────────────────────────────────────

export const applyWrapFormat = ({
  value,
  selectionStart,
  selectionEnd,
  openTag,
  closeTag,
  placeholder = 'text',
}) => {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = value.slice(start, end) || placeholder;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const inserted = `${openTag}${selected}${closeTag}`;

  return {
    value: `${before}${inserted}${after}`,
    nextSelectionStart: start + openTag.length,
    nextSelectionEnd: start + openTag.length + selected.length,
  };
};

export const applyLinkFormat = ({
  value,
  selectionStart,
  selectionEnd,
  url,
  label,
}) => {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const cleanUrl = url.trim();
  const selected = value.slice(start, end).trim();
  const linkLabel = (label?.trim() || selected || cleanUrl).trim();
  const openTag = `[url=${cleanUrl}]`;
  const inserted = `${openTag}${linkLabel}[/url]`;

  return {
    value: `${value.slice(0, start)}${inserted}${value.slice(end)}`,
    nextSelectionStart: start + openTag.length,
    nextSelectionEnd: start + openTag.length + linkLabel.length,
  };
};

export const applyColorFormat = ({
  value,
  selectionStart,
  selectionEnd,
  color,
}) => {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#111827';
  return applyWrapFormat({
    value,
    selectionStart,
    selectionEnd,
    openTag: `[color=${safeColor}]`,
    closeTag: '[/color]',
    placeholder: 'text',
  });
};

export const applyListFormat = ({
  value,
  selectionStart,
  selectionEnd,
  ordered,
}) => {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = value.slice(start, end) || 'List item';
  const lines = selected.split(/\r?\n/);
  const formatted = lines
    .map((line, index) =>
      `${ordered ? `${index + 1}.` : '-'} ${line.replace(/^(\d+\.|-)\s+/, '')}`,
    )
    .join('\n');

  return {
    value: `${value.slice(0, start)}${formatted}${value.slice(end)}`,
    nextSelectionStart: start,
    nextSelectionEnd: start + formatted.length,
  };
};

export const insertAtSelection = ({
  value,
  selectionStart,
  selectionEnd,
  snippet,
}) => {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  return {
    value: `${value.slice(0, start)}${snippet}${value.slice(end)}`,
    nextSelectionStart: start + snippet.length,
    nextSelectionEnd: start + snippet.length,
  };
};

// ── BBCode → HTML conversion (for QDN storage) ──────────────

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Detect if a URL uses a safe scheme
const isSafeUrl = (href) => {
  const lower = String(href || '').trim().toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('qdn://') ||
    lower.startsWith('home://') ||
    lower.startsWith('core://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('/') ||
    lower.startsWith('#') ||
    lower.startsWith('?')
  );
};

/**
 * Convert BBCode markup to sanitised HTML suitable for QDN storage.
 * Handles: b, i, u, h2, h3, quote, code, url, color, and list markers.
 */
export const bbcodeToHtml = (value) => {
  if (!value || typeof value !== 'string') return '';

  let html = value;

  // 1. Wrap text (inline formatting)
  html = html.replace(
    /\[b\]([\s\S]*?)\[\/b\]/gi,
    (_, content) => `<strong>${bbcodeToHtml(content)}</strong>`,
  );
  html = html.replace(
    /\[i\]([\s\S]*?)\[\/i\]/gi,
    (_, content) => `<em>${bbcodeToHtml(content)}</em>`,
  );
  html = html.replace(
    /\[u\]([\s\S]*?)\[\/u\]/gi,
    (_, content) => `<u>${bbcodeToHtml(content)}</u>`,
  );
  html = html.replace(
    /\[color=(#[0-9a-f]{6})\]([\s\S]*?)\[\/color\]/gi,
    (_, color, content) =>
      `<span style="color:${color}">${bbcodeToHtml(content)}</span>`,
  );
  html = html.replace(
    /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
    (_, href, content) => {
      if (!isSafeUrl(href)) return bbcodeToHtml(content);
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${bbcodeToHtml(content)}</a>`;
    },
  );

  // 2. Block-level formatting
  html = html.replace(
    /\[h2\]([\s\S]*?)\[\/h2\]/gi,
    (_, content) => `<h2>${bbcodeToHtml(content)}</h2>`,
  );
  html = html.replace(
    /\[h3\]([\s\S]*?)\[\/h3\]/gi,
    (_, content) => `<h3>${bbcodeToHtml(content)}</h3>`,
  );
  html = html.replace(
    /\[quote\]([\s\S]*?)\[\/quote\]/gi,
    (_, content) => `<blockquote>${bbcodeToHtml(content)}</blockquote>`,
  );
  html = html.replace(
    /\[code\]([\s\S]*?)\[\/code\]/gi,
    (_, content) => `<pre><code>${escapeHtml(content)}</code></pre>`,
  );

  // 3. Convert remaining text to paragraphs, preserving list markers
  // Process line by line for lists and plain paragraphs
  const lines = html.split(/\r?\n/);
  const result = [];
  let inList = null; // 'ul' | 'ol' | null
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const tag = inList === 'ol' ? 'ol' : 'ul';
    result.push(`<${tag}>${listItems.join('')}</${tag}>`);
    listItems = [];
    inList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^-\s+(.+)/);
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);

    if (bulletMatch) {
      if (inList !== 'ul') {
        flushList();
        inList = 'ul';
      }
      listItems.push(`<li>${bulletMatch[1]}</li>`);
    } else if (orderedMatch) {
      if (inList !== 'ol') {
        flushList();
        inList = 'ol';
      }
      listItems.push(`<li>${orderedMatch[2]}</li>`);
    } else {
      flushList();
      if (trimmed === '') {
        result.push('');
      } else if (
        trimmed.startsWith('<h2>') ||
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<blockquote>') ||
        trimmed.startsWith('<pre>')
      ) {
        result.push(trimmed);
      } else {
        result.push(`<p>${trimmed}</p>`);
      }
    }
  }
  flushList();

  return result.filter((r) => r !== '').join('\n');
};

// ── HTML → BBCode conversion (for editor preload) ───────────

/**
 * Convert stored HTML back to BBCode for editing.
 * Handles the subset of HTML produced by bbcodeToHtml.
 */
export const htmlToBbcode = (html) => {
  if (!html || typeof html !== 'string') return '';

  // Use DOM parser if available for structured conversion
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return domToBbcode(doc.body);
    } catch {
      // Fall through to regex approach
    }
  }

  // Fallback: regex-based conversion
  return fallbackHtmlToBbcode(html);
};

const domToBbcode = (node) => {
  if (!node) return '';

  let result = '';

  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      // Text node
      result += child.textContent;
    } else if (child.nodeType === 1) {
      // Element node
      const tag = child.tagName.toLowerCase();
      const innerContent = domToBbcode(child);

      switch (tag) {
        case 'strong':
        case 'b':
          result += `[b]${innerContent}[/b]`;
          break;
        case 'em':
        case 'i':
          result += `[i]${innerContent}[/i]`;
          break;
        case 'u':
          result += `[u]${innerContent}[/u]`;
          break;
        case 'h2':
          result += `\n[h2]${innerContent}[/h2]\n`;
          break;
        case 'h3':
          result += `\n[h3]${innerContent}[/h3]\n`;
          break;
        case 'blockquote':
          result += `\n[quote]${innerContent}[/quote]\n`;
          break;
        case 'pre':
          result += `\n[code]${child.textContent || ''}[/code]\n`;
          break;
        case 'code':
          // Skip <code> inside <pre> — already handled
          if (child.parentNode?.nodeName?.toLowerCase() !== 'pre') {
            result += `[code]${child.textContent || ''}[/code]`;
          }
          break;
        case 'a': {
          const href = child.getAttribute('href') || '';
          if (href) {
            result += `[url=${href}]${innerContent}[/url]`;
          } else {
            result += innerContent;
          }
          break;
        }
        case 'span': {
          const style = child.getAttribute('style') || '';
          const colorMatch = style.match(/color:\s*(#[0-9a-f]{6})/i);
          if (colorMatch) {
            result += `[color=${colorMatch[1]}]${innerContent}[/color]`;
          } else {
            result += innerContent;
          }
          break;
        }
        case 'ul':
        case 'ol': {
          const items = [];
          for (const li of child.children) {
            if (li.tagName.toLowerCase() === 'li') {
              const itemText = domToBbcode(li);
              items.push(tag === 'ol' ? `1. ${itemText}` : `- ${itemText}`);
            }
          }
          result += `\n${items.join('\n')}\n`;
          break;
        }
        case 'li':
          // Handled by parent ul/ol
          result += innerContent;
          break;
        case 'p':
          result += `\n${innerContent}\n`;
          break;
        case 'br':
          result += '\n';
          break;
        case 'div':
          result += `\n${innerContent}\n`;
          break;
        default:
          result += innerContent;
      }
    }
  }

  return result;
};

const fallbackHtmlToBbcode = (html) => {
  let text = html
    // Remove block-level HTML wrappers
    .replace(/<\/?(p|div|span|li)(\s[^>]*)?>/gi, '')
    // Replace <br> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Bold
    .replace(/<\/?strong>/gi, (m) => (m.startsWith('</') ? '[/b]' : '[b]'))
    .replace(/<\/?b>/gi, (m) => (m.startsWith('</') ? '[/b]' : '[b]'))
    // Italic
    .replace(/<\/?em>/gi, (m) => (m.startsWith('</') ? '[/i]' : '[i]'))
    .replace(/<\/?i>/gi, (m) => (m.startsWith('</') ? '[/i]' : '[i]'))
    // Underline
    .replace(/<\/?u>/gi, (m) => (m.startsWith('</') ? '[/u]' : '[u]'))
    // Headings
    .replace(/<\/?h2>/gi, (m) => (m.startsWith('</') ? '[/h2]' : '[h2]'))
    .replace(/<\/?h3>/gi, (m) => (m.startsWith('</') ? '[/h3]' : '[h3]'))
    // Blockquote
    .replace(/<\/?blockquote>/gi, (m) =>
      m.startsWith('</') ? '[/quote]' : '[quote]',
    )
    // Code/pre
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '[code]$1[/code]')
    .replace(/<\/?code>/gi, (m) => (m.startsWith('</') ? '[/code]' : '[code]'))
    // Links
    .replace(
      /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      '[url=$1]$2[/url]',
    )
    // Color spans
    .replace(
      /<span\s+style="color:\s*(#[0-9a-f]{6})"[^>]*>([\s\S]*?)<\/span>/gi,
      '[color=$1]$2[/color]',
    )
    // Lists
    .replace(/<\/?(ul|ol)>/gi, '')
    .replace(/<li>([\s\S]*?)<\/li>/gi, '- $1')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
};

// ── Empty-content detection ─────────────────────────────────

/**
 * Check whether BBCode content is effectively empty (no visible text).
 */
export const isContentEmpty = (value) => {
  if (!value || typeof value !== 'string') return true;
  // Strip all BBCode tags and whitespace
  const stripped = value
    .replace(/\[(\/)?(b|i|u|h2|h3|quote|code)\]/gi, '')
    .replace(/\[color=#[0-9a-f]{6}\]([\s\S]*?)\[\/color\]/gi, '$1')
    .replace(/\[url=[^\]]+\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length === 0;
};

// ── Plain-text extraction (for excerpts/search) ─────────────

export const stripRichTextMarkup = (value) =>
  String(value || '')
    .replace(/\[(\/)?(b|i|u|h2|h3|quote|code)\]/gi, '')
    .replace(/\[color=#[0-9a-f]{6}\]([\s\S]*?)\[\/color\]/gi, '$1')
    .replace(/\[url=[^\]]+\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
