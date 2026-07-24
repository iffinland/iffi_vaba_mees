const getQortiumBridge = () => {
  const qdnBridge =
    (typeof window !== 'undefined' && window.qdnRequest) ||
    (typeof globalThis !== 'undefined' && globalThis.qdnRequest) ||
    null;

  return typeof qdnBridge === 'function' ? qdnBridge : null;
};

export const hasQortiumBridge = () => typeof getQortiumBridge() === 'function';

export const requestQortium = async (payload) => {
  const qdnBridge = getQortiumBridge();

  if (typeof qdnBridge === 'function') {
    return qdnBridge(payload);
  }

  throw new Error('Qortium request bridge is not available. Open this app inside Qortium Home.');
};

export const encodeObjectToBase64 = (payload) => {
  const json = JSON.stringify(payload);

  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(json)));
  }

  if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
    return globalThis.Buffer.from(json, 'utf-8').toString('base64');
  }

  throw new Error('Unable to encode payload to base64.');
};

export const selectQdnPublishSource = async () => {
  const result = await requestQortium({
    action: 'SELECT_QDN_PUBLISH_SOURCE',
  });

  if (result?.canceled) {
    throw new Error('File selection was cancelled.');
  }

  if (!result?.sourceToken) {
    throw new Error('No publication source token was returned.');
  }

  return result;
};

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Unable to read file for QDN publishing.'));
    reader.readAsDataURL(file);
  });

export const sanitizeIdentifierSegment = (value) => {
  if (typeof value !== 'string') return '';

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
};

export const createShortId = () => Math.random().toString(36).slice(2, 10);

export const normalizeQortiumNames = (value) => {
  const rawNames =
    value?.names ??
    value?.registeredNames ??
    value?.nameData ??
    value?.accountNames ??
    value?.account?.names ??
    [];

  const names = (Array.isArray(rawNames) ? rawNames : [rawNames])
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
        return entry.name.trim();
      }
      return '';
    })
    .filter(Boolean);

  const selectedName =
    (typeof value?.name === 'string' && value.name.trim()) ||
    (typeof value?.selectedName === 'string' && value.selectedName.trim()) ||
    (typeof value?.activeName === 'string' && value.activeName.trim()) ||
    (typeof value?.account?.name === 'string' && value.account.name.trim()) ||
    '';

  return Array.from(new Set([selectedName, ...names].filter(Boolean)));
};

export const getSelectedQortiumProfile = async () => {
  const account = await requestQortium({ action: 'GET_SELECTED_ACCOUNT' });
  const address =
    (typeof account?.address === 'string' && account.address) ||
    (typeof account?.account?.address === 'string' && account.account.address) ||
    '';
  const names = normalizeQortiumNames(account);

  return {
    address,
    name: names[0] ?? '',
    names,
    raw: account,
  };
};
