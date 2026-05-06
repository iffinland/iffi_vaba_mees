export const requestQortal = async (payload) => {
  const qortalBridge =
    (typeof window !== 'undefined' && window.qortalRequest) ||
    (typeof globalThis !== 'undefined' && globalThis.qortalRequest) ||
    null;

  if (typeof qortalBridge === 'function') {
    return qortalBridge(payload);
  }

  if (typeof window !== 'undefined') {
    try {
      const parent = window.parent;
      if (parent && parent !== window && typeof parent.qortalRequest === 'function') {
        return parent.qortalRequest(payload);
      }
    } catch {
      // Cross-origin parent access can fail; continue with other fallbacks.
    }

    try {
      const topWindow = window.top;
      if (topWindow && topWindow !== window && typeof topWindow.qortalRequest === 'function') {
        return topWindow.qortalRequest(payload);
      }
    } catch {
      // Cross-origin top access can fail; continue with other fallbacks.
    }
  }

  // Qortal UI can expose qortalRequest as an injected global function.
  if (typeof qortalRequest !== 'undefined' && typeof qortalRequest === 'function') {
    // eslint-disable-next-line no-undef
    return qortalRequest(payload);
  }

  throw new Error('Qortal request API is not available. Open the Qortal UI first.');
};

export const encodeObjectToBase64 = (payload) => {
  const json = JSON.stringify(payload);

  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(json)));
  }

  if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
    return globalThis.Buffer.from(json, 'utf-8').toString('base64');
  }

  throw new Error('Unable to encode payload to base64.');
};

export const sanitizeIdentifierSegment = (value) => {
  if (typeof value !== 'string') return '';

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
};

export const createShortId = () => Math.random().toString(36).slice(2, 10);
