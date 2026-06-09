import {
  createShortId,
  encodeObjectToBase64,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';

const COMMENT_PREFIX = 'ivm_bc_';
const LIKE_PREFIX = 'ivm_bl_';
const PAGE_SIZE = 100;

const toEntityKey = (postId) => sanitizeIdentifierSegment(postId).slice(0, 24);
const toLikeEntityKey = (postId) => {
  const value = String(postId || '');
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return Math.abs(hash >>> 0).toString(36);
};
const toAuthorKey = (value) => sanitizeIdentifierSegment(value).slice(0, 16);

export const fetchBlogComments = async (postId, limit = 50) => {
  const comments = [];
  let offset = 0;

  while (comments.length < limit) {
    const page = await requestQortal({
      action: 'SEARCH_QDN_RESOURCES',
      service: 'DOCUMENT',
      mode: 'ALL',
      identifier: COMMENT_PREFIX,
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
          const payload = await requestQortal({
            action: 'FETCH_QDN_RESOURCE',
            service: 'DOCUMENT',
            name: summary.name,
            identifier: summary.identifier,
          });

          if (payload?.postId !== postId) return null;

          return {
            id: summary.identifier,
            identifier: summary.identifier,
            postId,
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

export const publishBlogComment = async ({
  postId,
  postTitle,
  parentId = '',
  authorName,
  authorAddress,
  messageHtml,
  messageText,
}) => {
  const timestamp = Date.now();
  const identifier = `${COMMENT_PREFIX}${toEntityKey(postId)}_${createShortId()}`;
  const payload = {
    id: identifier,
    identifier,
    postId,
    parentId,
    authorName,
    authorAddress,
    messageHtml,
    messageText,
    created: timestamp,
    updated: timestamp,
  };

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: 'DOCUMENT',
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Comment on ${postTitle || 'blog post'}`.slice(0, 55),
    description: messageText.slice(0, 4000),
  });

  return payload;
};

export const updateBlogComment = async ({
  comment,
  postTitle,
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

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: 'DOCUMENT',
    identifier: comment.identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Comment on ${postTitle || 'blog post'}`.slice(0, 55),
    description: messageText.slice(0, 4000),
  });

  return payload;
};

export const fetchBlogLikeCount = async (postId) => {
  const page = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: 'DOCUMENT',
    mode: 'ALL',
    identifier: `${LIKE_PREFIX}${toLikeEntityKey(postId)}_`,
    prefix: true,
    limit: PAGE_SIZE,
    offset: 0,
    reverse: true,
    includeMetadata: false,
    excludeBlocked: true,
  });

  return Array.isArray(page) ? page.length : 0;
};

export const publishBlogLike = async ({ postId, postTitle, authorName, authorAddress }) => {
  const identifier = `${LIKE_PREFIX}${toLikeEntityKey(postId)}_${toAuthorKey(authorName || authorAddress)}`;
  const payload = {
    id: identifier,
    identifier,
    postId,
    authorName,
    authorAddress,
    created: Date.now(),
  };

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: 'DOCUMENT',
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Like on ${postTitle || 'blog post'}`.slice(0, 55),
    description: 'Blog post like',
  });

  return payload;
};
