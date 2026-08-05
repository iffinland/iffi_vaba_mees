// ── Ported from Blogs project — QDN search service ──

import { requestQortium } from '../qortium/qortiumClient';

/**
 * Search public QDN resources with optional service, publisher-name,
 * and free-text filters.
 *
 * Uses the Core SEARCH_QDN_RESOURCES action with metadata-first results.
 * No FETCH is performed per result — callers get search metadata only.
 */
export const searchQdnResources = async (params) => {
  const response = await requestQortium({
    action: 'SEARCH_QDN_RESOURCES',
    mode: 'ALL',
    reverse: true,
    excludeBlocked: true,
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    includeMetadata: true,
    ...(params.service ? { service: params.service } : {}),
    ...(params.name ? { name: params.name, exactMatchNames: true } : {}),
    ...(params.query ? { query: params.query } : {}),
  });

  if (!Array.isArray(response)) return [];

  return response.map((item) => ({
    name: typeof item.name === 'string' ? item.name : '',
    service: (typeof item.service === 'string' ? item.service : 'FILE'),
    identifier: typeof item.identifier === 'string' ? item.identifier : '',
    title: typeof item.title === 'string' ? item.title : undefined,
    filename: typeof item.filename === 'string' ? item.filename : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    created: typeof item.created === 'number' ? item.created : undefined,
    updated: typeof item.updated === 'number' ? item.updated : undefined,
    size: typeof item.size === 'number' ? item.size : undefined,
  }));
};

// ── Display-name resolver ────────────────────────────────────

/**
 * Derive the most human-readable display name from search metadata.
 */
export const resolveDisplayName = (result) => {
  if (result.title?.trim()) return result.title.trim();
  if (result.filename?.trim()) return result.filename.trim();
  if (result.name?.trim()) return result.name.trim();
  return result.identifier || '(unknown)';
};

/**
 * Derive a secondary label showing publisher and identifier.
 */
export const resolveSecondaryLabel = (result) => {
  const publisher = result.name?.trim();
  const id = result.identifier?.trim();
  if (publisher && id && publisher !== id) return `${publisher} · ${id}`;
  if (publisher && id) return publisher;
  if (id) return id;
  return publisher || '';
};

// ── Search-term highlighting ─────────────────────────────────

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Split text into segments, marking case-insensitive matches of
 * the query.  Safe for regex-special characters.
 * Returns text unchanged when query is empty.
 */
export const highlightMatch = (text, query) => {
  if (!query.trim() || !text) return [{ kind: 'text', value: text }];

  try {
    const escaped = escapeRegex(query.trim());
    const pattern = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(pattern);

    return parts
      .filter((part) => part !== '')
      .map((part) => {
        if (part.toLowerCase() === query.trim().toLowerCase()) {
          return { kind: 'match', value: part };
        }
        return { kind: 'text', value: part };
      });
  } catch {
    return [{ kind: 'text', value: text }];
  }
};
