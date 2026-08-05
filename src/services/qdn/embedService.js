// ── Ported from Blogs project — QDN embed encode/decode/URI parsing ──

const MAX_EMBED_PAYLOAD_BYTES = 8_192;

// ── QDN URI Parser ──────────────────────────────────────────

const QDN_URI_PATTERN = /^qdn:\/\/([^/?#]+)\/([^/?#]+)(?:\/([^/?#]*))?(?:(\/[^?#]*))?(?:\?.*)?$/i;

/**
 * Parse a qdn:// URI into structured canonical identity.
 *
 * Format: qdn://SERVICE/Name[/identifier][/path][?query]
 *
 * - Scheme is case-insensitive.
 * - SERVICE and Name are required.
 * - identifier defaults to 'default' when absent.
 * - path includes leading slash segments after identifier.
 * - Query string is discarded (not stored by this parser).
 *
 * Returns null for invalid URIs.
 */
export const parseQdnUri = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(QDN_URI_PATTERN);
  if (!match) return null;

  const service = match[1].toUpperCase();
  const name = decodeURIComponent(match[2]);
  const identifier = match[3] ? decodeURIComponent(match[3]) : 'default';
  const path = match[4] || undefined;

  if (!service || !name) return null;

  return { service, name, identifier, path };
};

// ── Public API ──────────────────────────────────────────────

/**
 * Serialize a QdnEmbed into the rich-text tag format:
 *   [qdnembed]{base64url-encoded JSON}[/qdnembed]
 */
export const encodeQdnEmbedTag = (embed) => {
  const json = JSON.stringify(embed);
  if (new TextEncoder().encode(json).length > MAX_EMBED_PAYLOAD_BYTES) {
    throw new Error('Embed payload exceeds maximum size.');
  }
  const encoded = btoa(json);
  return `[qdnembed]${encoded}[/qdnembed]`;
};

/**
 * Parse a [qdnembed] payload back into a QdnEmbed.
 * Returns null for malformed or oversized payloads.
 */
export const decodeQdnEmbedPayload = (payload) => {
  try {
    const raw = atob(payload.trim());
    if (new TextEncoder().encode(raw).length > MAX_EMBED_PAYLOAD_BYTES) return null;
    const parsed = JSON.parse(raw);
    if (!isQdnEmbed(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Build a qdn:// address from a canonical (service, name, identifier).
 */
export const buildQdnAddress = (service, name, identifier) => {
  const base = `qdn://${encodeURIComponent(service)}/${encodeURIComponent(name)}`;
  return identifier ? `${base}/${encodeURIComponent(identifier)}` : base;
};

// ── Validation ──────────────────────────────────────────────

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value) => typeof value === 'string';

const isValidTarget = (target) => {
  if (!isRecord(target)) return false;
  if (!isString(target.service) || !target.service) return false;
  if (!isString(target.name) || !target.name) return false;
  if (target.identifier !== undefined && !isString(target.identifier)) return false;
  if (target.path !== undefined && !isString(target.path)) return false;
  return true;
};

const isValidImageRef = (ref) => {
  if (!isRecord(ref)) return false;
  if (!isString(ref.service) || !ref.service) return false;
  if (!isString(ref.name) || !ref.name) return false;
  if (!isString(ref.identifier) || !ref.identifier) return false;
  return true;
};

const isQdnEmbed = (value) => {
  if (!isRecord(value)) return false;
  if (!isValidTarget(value.target)) return false;

  const pres = value.presentation;
  if (pres === undefined || pres === null) {
    // Target-only embed is valid
    return true;
  }

  if (!isRecord(pres)) return false;

  if (pres.label !== undefined && !isString(pres.label)) return false;
  if (pres.description !== undefined && !isString(pres.description)) return false;
  if (pres.image !== undefined && !isValidImageRef(pres.image)) return false;

  return true;
};
