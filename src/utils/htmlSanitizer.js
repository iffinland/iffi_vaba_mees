const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'u',
  'ul',
]);

const ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'target', 'rel']),
};

const isSafeUrl = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('qdn://') ||
    normalized.startsWith('mailto:')
  );
};

export const sanitizeHtml = (html = '') => {
  const source = String(html || '');

  if (typeof DOMParser === 'undefined') {
    return source
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+=(["']).*?\1/gi, '')
      .replace(/\s(?:src|href)=["']javascript:[^"']*["']/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');

  const cleanNode = (node) => {
    Array.from(node.children).forEach((child) => {
      const tagName = child.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }

      Array.from(child.attributes).forEach((attribute) => {
        const allowed = ALLOWED_ATTRS[tagName]?.has(attribute.name);
        if (!allowed) {
          child.removeAttribute(attribute.name);
          return;
        }

        if (attribute.name === 'href' && !isSafeUrl(attribute.value)) {
          child.removeAttribute(attribute.name);
        }
      });

      if (tagName === 'a' && child.hasAttribute('href')) {
        child.setAttribute('rel', 'noopener noreferrer');
        if (!child.getAttribute('target')) {
          child.setAttribute('target', '_blank');
        }
      }

      cleanNode(child);
    });
  };

  cleanNode(doc.body);
  return doc.body.innerHTML;
};
