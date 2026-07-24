import {
  createShortId,
  encodeObjectToBase64,
  requestQortium,
  sanitizeIdentifierSegment,
} from './qortium/qortiumClient';
import { getQortBalance, resolveNameAddress, sendQortTip } from './videoEngagementService';

export { getQortBalance, resolveNameAddress, sendQortTip };

const COMMENT_PREFIX = 'ivm_gc_';
const LIKE_PREFIX = 'ivm_gl_';
const PAGE_SIZE = 100;

const toEntityKey = (entityId) => sanitizeIdentifierSegment(entityId).slice(0, 24);
const toLikeEntityKey = (entityId) => {
  const value = String(entityId || '');
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return Math.abs(hash >>> 0).toString(36);
};
const toAuthorKey = (value) => sanitizeIdentifierSegment(value).slice(0, 16);

export const fetchGalleryComments = async (entityId, limit = 50) => {
  const comments = [];
  let offset = 0;
  const entityKey = toEntityKey(entityId);

  while (comments.length < limit) {
    const page = await requestQortium({
      action: 'SEARCH_QDN_RESOURCES',
      service: 'DOCUMENT',
      mode: 'ALL',
      identifier: `${COMMENT_PREFIX}${entityKey}_`,
      prefix: true,
      limit: PAGE_SIZE,
      offset,
      reverse: true,
      includeMetadata: true,
      excludeBlocked: true,
    });

    const summaries = Array.isArray(page) ? page : [];
    if (!summaries.length) break;

    const resolved = await Promise.all(
      summaries.map(async (summary) => {
        try {
          const payload = await requestQortium({
            action: 'FETCH_QDN_RESOURCE',
            service: 'DOCUMENT',
            name: summary.name,
            identifier: summary.identifier,
          });

          if (payload?.entityId !== entityId) return null;

          return {
            id: summary.identifier,
            identifier: summary.identifier,
            entityId,
            parentId: payload.parentId || '',
            authorName: payload.authorName || summary.name || 'Unknown',
            authorAddress: payload.authorAddress || '',
            messageHtml: payload.messageHtml || '',
            messageText: payload.messageText || '',
            created: Number(payload.created ?? summary.created ?? Date.now()),
            updated: Number(payload.updated ?? summary.updated ?? Date.now()),
          };
        } catch {
          return null;
        }
      }),
    );

    comments.push(...resolved.filter(Boolean));

    if (summaries.length < PAGE_SIZE) break;
    offset += summaries.length;
  }

  return comments
    .sort((a, b) => (a.created ?? 0) - (b.created ?? 0))
    .slice(0, limit);
};

export const publishGalleryComment = async ({
  entityId,
  entityTitle,
  parentId = '',
  authorName,
  authorAddress,
  messageHtml,
  messageText,
}) => {
  const timestamp = Date.now();
  const identifier = `${COMMENT_PREFIX}${toEntityKey(entityId)}_${createShortId()}`;
  const payload = {
    id: identifier,
    identifier,
    entityId,
    parentId,
    authorName,
    authorAddress,
    messageHtml,
    messageText,
    created: timestamp,
    updated: timestamp,
  };

  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: 'DOCUMENT',
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Comment on ${entityTitle || 'gallery image'}`.slice(0, 55),
    description: messageText.slice(0, 4000),
  });

  return payload;
};

export const updateGalleryComment = async ({
  comment,
  entityTitle,
  authorName,
  authorAddress,
  messageHtml,
  messageText,
}) => {
  const payload = {
    ...comment,
    authorName,
    authorAddress,
    messageHtml,
    messageText,
    updated: Date.now(),
  };

  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: 'DOCUMENT',
    identifier: comment.identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Comment on ${entityTitle || 'gallery image'}`.slice(0, 55),
    description: messageText.slice(0, 4000),
  });

  return payload;
};

export const fetchGalleryLikeCount = async (entityId) => {
  let totalCount = 0;
  let offset = 0;

  while (true) {
    const page = await requestQortium({
      action: 'SEARCH_QDN_RESOURCES',
      service: 'DOCUMENT',
      mode: 'ALL',
      identifier: `${LIKE_PREFIX}${toLikeEntityKey(entityId)}_`,
      prefix: true,
      limit: PAGE_SIZE,
      offset,
      reverse: true,
      includeMetadata: false,
      excludeBlocked: true,
    });

    const items = Array.isArray(page) ? page : [];
    totalCount += items.length;
    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }

  return totalCount;
};

export const publishGalleryLike = async ({
  entityId,
  entityTitle,
  authorName,
  authorAddress,
}) => {
  const identifier = `${LIKE_PREFIX}${toLikeEntityKey(entityId)}_${toAuthorKey(authorName || authorAddress)}`;
  const payload = {
    id: identifier,
    identifier,
    entityId,
    authorName,
    authorAddress,
    created: Date.now(),
  };

  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: 'DOCUMENT',
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Like on ${entityTitle || 'gallery image'}`.slice(0, 55),
    description: 'Gallery like',
  });

  return payload;
};
