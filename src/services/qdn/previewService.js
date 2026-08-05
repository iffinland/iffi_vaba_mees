// ── Ported from Blogs project — QDN preview service ──

import { requestQortium } from '../qortium/qortiumClient';
import {
  getQdnResourceUrl,
  waitForResourceReady,
} from './qdnService';
import { IMAGE_CAPABLE_SERVICES } from './qdnServiceTypes';

// ── Limits ──────────────────────────────────────────────────

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2 MB
const READINESS_TIMEOUT_MS = 30_000;

// ── MIME detection ──────────────────────────────────────────

const IMAGE_MIME = /^image\//;
const VIDEO_MIME = /^video\//;
const AUDIO_MIME = /^audio\//;
const PDF_MIME = 'application/pdf';
const JSON_MIME = 'application/json';
const MARKDOWN_EXT = /\.(md|markdown)$/i;
const TEXT_MIME = /^text\//;

export const canPreviewMime = (mimeType) => {
  if (!mimeType) return false;
  return (
    IMAGE_MIME.test(mimeType) ||
    VIDEO_MIME.test(mimeType) ||
    AUDIO_MIME.test(mimeType) ||
    mimeType === PDF_MIME ||
    mimeType === JSON_MIME ||
    TEXT_MIME.test(mimeType)
  );
};

const inferMimeFromFilename = (filename) => {
  if (!filename) return '';
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return '';
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', oga: 'audio/ogg',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain', csv: 'text/csv', log: 'text/plain',
    md: 'text/markdown', markdown: 'text/markdown',
  };
  return map[ext] || '';
};

// ── Properties ──────────────────────────────────────────────

const fetchProperties = async (service, name, identifier) => {
  try {
    const props = await requestQortium({
      action: 'GET_QDN_RESOURCE_PROPERTIES',
      service,
      name,
      identifier,
    });
    if (props && typeof props === 'object') {
      return {
        filename: typeof props.filename === 'string' ? props.filename : undefined,
        size: typeof props.size === 'number' ? props.size : undefined,
        mimeType: typeof props.mimeType === 'string' ? props.mimeType : undefined,
      };
    }
  } catch {
    // Properties unavailable — proceed without them
  }
  return {};
};

// ── Resolve MIME ────────────────────────────────────────────

const resolveMime = (props, filename) => {
  if (props.mimeType) return props.mimeType;
  const fromName = inferMimeFromFilename(props.filename || filename);
  if (fromName) return fromName;
  return 'application/octet-stream';
};

// ── Determine preview strategy ──────────────────────────────

const classifyMime = (mime) => {
  if (IMAGE_MIME.test(mime)) return 'image';
  if (VIDEO_MIME.test(mime)) return 'video';
  if (AUDIO_MIME.test(mime)) return 'audio';
  if (mime === PDF_MIME) return 'native-viewer';
  if (mime === JSON_MIME) return 'json';
  if (mime === 'text/markdown' || MARKDOWN_EXT.test(mime)) return 'markdown';
  if (TEXT_MIME.test(mime)) return 'text';
  if (mime === 'text/csv' || mime === 'text/tab-separated-values') return 'text';
  return 'unsupported';
};

// ── Public API ──────────────────────────────────────────────

/**
 * Resolve a QDN resource for preview.
 *
 * Flow:
 *   1. Fetch properties (filename, size, MIME)
 *   2. Wait for readiness with bounded polling
 *   3. Classify MIME → select render strategy
 *   4. Obtain renderable URL (media/PDF) or fetch text content (text/JSON/Markdown)
 *   5. Return typed QdnPreviewResult
 */
export const resolvePreview = async (target, signal) => {
  const { service, name, identifier, filename } = target;

  // 1. Properties
  const props = await fetchProperties(service, name, identifier);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const mime = resolveMime(props, filename);

  // 2. Readiness
  const ready = await waitForResourceReady(service, name, identifier, READINESS_TIMEOUT_MS);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (ready.status !== 'READY') {
    return { kind: 'unsupported', mimeType: mime, reason: 'Resource not available.' };
  }

  // 3. Classify
  const kind = classifyMime(mime);

  // 4. Render
  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    const url = await getQdnResourceUrl({ service, name, identifier });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!url) return { kind: 'unsupported', mimeType: mime, reason: 'Unable to resolve resource URL.' };
    return { kind, url, mimeType: mime };
  }

  if (kind === 'native-viewer') {
    // Delegate to Home's native document viewer
    return {
      kind: 'native-viewer',
      service,
      name,
      identifier,
      filename: props.filename || filename,
    };
  }

  // Text-based: fetch content
  if (kind === 'text' || kind === 'markdown' || kind === 'json') {
    try {
      const raw = await requestQortium({
        action: 'FETCH_QDN_RESOURCE',
        service,
        name,
        identifier,
      });

      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);

      if (text.length > MAX_TEXT_BYTES) {
        return { kind: 'unsupported', mimeType: mime, reason: 'Text content exceeds preview size limit.' };
      }

      if (kind === 'json') {
        let parsed = undefined;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Not valid JSON — show as text
          return { kind: 'text', text, mimeType: 'text/plain' };
        }
        return { kind: 'json', text, parsed, mimeType: mime };
      }

      return { kind, text, mimeType: mime };
    } catch {
      return { kind: 'unsupported', mimeType: mime, reason: 'Unable to fetch resource content.' };
    }
  }

  return { kind: 'unsupported', mimeType: mime, reason: 'Preview not available for this resource type.' };
};
