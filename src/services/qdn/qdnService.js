// ── Ported from Blogs project — QDN service (adapted to target's existing services) ──

import { requestQortium } from '../qortium/qortiumClient';
import {
  getQdnResourceUrl as targetGetQdnResourceUrl,
  getQdnResourceStatus,
  waitForQdnResourceReady,
  normalizeQdnStatus,
} from '../qdnResourceService';
import { encodeJsonToBase64 } from './encoding';

// ── Re-export target functions with source-compatible names ──

export const getQdnResourceUrl = async (ref) => {
  // The source passes a QdnResourceRef object; target expects { service, name, identifier }
  const url = await targetGetQdnResourceUrl({
    service: ref.service,
    name: ref.name,
    identifier: ref.identifier,
  });
  return url;
};

export const getResourceStatus = async (service, name, identifier) => {
  const status = await getQdnResourceStatus({ service, name, identifier });
  return normalizeQdnStatus(status);
};

export const waitForResourceReady = async (service, name, identifier, timeoutMs = 45_000) => {
  const result = await waitForQdnResourceReady({
    service,
    name,
    identifier,
    timeoutMs,
  });
  return result;
};

// ── Additional helpers used by media/preview services ──

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isQdnErrorEnvelope = (value) =>
  isRecord(value) &&
  typeof value.error === 'number' &&
  typeof value.message === 'string';

export class QdnResourceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QdnResourceError';
    this.code = code;
  }
}

const parseJsonLike = (raw) => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try base64 decode
    try {
      const binary = atob(trimmed);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return raw;
    }
  }
};

export const fetchJsonResource = async (service, name, identifier) => {
  const raw = await requestQortium({
    action: 'FETCH_QDN_RESOURCE',
    service,
    name,
    identifier,
  });

  if (isQdnErrorEnvelope(raw)) {
    throw new QdnResourceError(raw.error, raw.message);
  }

  return parseJsonLike(raw);
};

export const publishJsonResource = async ({
  service,
  name,
  identifier,
  payload,
  title,
  description,
  tags,
  filename = 'data.json',
}) => {
  const data64 = encodeJsonToBase64(payload);
  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    service,
    name,
    identifier,
    filename,
    data64,
    title,
    description,
    ...(tags?.length ? { tags: tags.slice(0, 5) } : {}),
  });

  await waitForResourceReady(service, name, identifier);
};
