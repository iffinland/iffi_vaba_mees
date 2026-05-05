export const requestQortal = async (payload) => {
  const qortalBridge =
    (typeof window !== 'undefined' && window.qortalRequest) ||
    (typeof globalThis !== 'undefined' && globalThis.qortalRequest) ||
    null;

  if (typeof qortalBridge !== 'function') {
    throw new Error('Qortal request API is not available. Open the Qortal UI first.');
  }

  return qortalBridge(payload);
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
