const directVideoExtensionPattern = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const qTubeLinkPattern = /qortal:\/\/APP\/Q-Tube\/video\/([^"'<>\s]+)\/([^"'<>\s]+)/i;
const qdnVideoLinkPattern = /qortal:\/\/VIDEO\/([^"'<>\s]+)\/([^"'<>\s]+)/i;

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');
const APP_QORTAL_NAME = 'iffi vaba mees';

const encodeQortalComponent = (value) => encodeURIComponent(value);

const decodePathPart = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractEmbeddedSource = (value) => {
  const input = trimString(value);
  if (!input) return '';

  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/gi;
  const matches = Array.from(input.matchAll(attributePattern)).map((match) => match[1]);
  const preferred = matches.find((match) =>
    /^\/arbitrary\/VIDEO\//i.test(match) ||
    /^qortal:\/\/APP\/Q-Tube\/video\//i.test(match) ||
    /^qortal:\/\/VIDEO\//i.test(match) ||
    directVideoExtensionPattern.test(match),
  );

  if (preferred) return preferred;

  const qTubeMatch = input.match(qTubeLinkPattern);
  if (qTubeMatch) return qTubeMatch[0];

  const qdnVideoMatch = input.match(qdnVideoLinkPattern);
  if (qdnVideoMatch) return qdnVideoMatch[0];

  return input;
};

const toUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost';
      return new URL(value, baseUrl);
    } catch {
      return null;
    }
  }
};

export const buildVideoPageLink = (video) => {
  return `qortal://APP/${encodeQortalComponent(APP_QORTAL_NAME)}#/videos/${encodeQortalComponent(video.identifier)}`;
};

export const copyTextToClipboard = async (text) => {
  if (!text) {
    throw new Error('Nothing to copy.');
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path used in Qortal iframe contexts.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('Copy command was rejected.');
    }
    return true;
  } finally {
    document.body.removeChild(textarea);
  }
};

export const getVideoQdnResource = (video) => {
  if (video?.qdnVideo?.name && video?.qdnVideo?.identifier) {
    return {
      service: video.qdnVideo.service || 'VIDEO',
      name: video.qdnVideo.name,
      identifier: video.qdnVideo.identifier,
      filename: video.qdnVideo.filename || '',
    };
  }

  const source = extractEmbeddedSource(video?.sourceUrl);
  if (!source) return null;

  const rawQTubeMatch = source.match(qTubeLinkPattern);
  if (rawQTubeMatch) {
    const name = decodePathPart(rawQTubeMatch[1]);
    const identifier = decodePathPart(rawQTubeMatch[2]).replace(/_metadata$/, '');
    if (name && identifier) {
      return { service: 'VIDEO', name, identifier, filename: '' };
    }
  }

  const rawQdnVideoMatch = source.match(qdnVideoLinkPattern);
  if (rawQdnVideoMatch) {
    const name = decodePathPart(rawQdnVideoMatch[1]);
    const identifier = decodePathPart(rawQdnVideoMatch[2]);
    if (name && identifier) {
      return { service: 'VIDEO', name, identifier, filename: '' };
    }
  }

  const url = toUrl(source);
  if (!url) return null;

  const pathParts = url.pathname.split('/').filter(Boolean).map(decodePathPart);
  const arbitraryIndex = pathParts.findIndex((part) => part.toLowerCase() === 'arbitrary');
  const service = pathParts[arbitraryIndex + 1];
  const name = pathParts[arbitraryIndex + 2];
  const identifier = pathParts[arbitraryIndex + 3];

  if (arbitraryIndex >= 0 && service?.toUpperCase() === 'VIDEO' && name && identifier) {
    return { service: 'VIDEO', name, identifier, filename: '' };
  }

  return null;
};

export const buildVideoChatEmbedLink = (video) => {
  const resource = getVideoQdnResource(video);
  if (!resource) return '';

  const fileName = resource.filename || `${resource.identifier}.mp4`;
  const searchParams = [
    ['name', resource.name],
    ['identifier', resource.identifier],
    ['service', resource.service],
    ['mimeType', 'video/mp4'],
    ['fileName', fileName],
  ]
    .map(([key, value]) => `${key}=${encodeQortalComponent(value)}`)
    .join('&');

  return `qortal://use-embed/VIDEO?${searchParams}`;
};
