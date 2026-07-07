import {
  createShortId,
  encodeObjectToBase64,
  requestQortium,
  sanitizeIdentifierSegment,
} from './qortium/qortiumClient';

const COMMENT_PREFIX = 'ivm_vc_';
const LIKE_PREFIX = 'ivm_vl_';
const PAGE_SIZE = 100;

const toEntityKey = (videoId) => sanitizeIdentifierSegment(videoId).slice(0, 24);
const toLikeEntityKey = (videoId) => {
  const value = String(videoId || '');
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return Math.abs(hash >>> 0).toString(36);
};
const toAuthorKey = (value) => sanitizeIdentifierSegment(value).slice(0, 16);

export const fetchVideoComments = async (videoId, limit = 50) => {
  const comments = [];
  let offset = 0;

  while (comments.length < limit) {
    const page = await requestQortium({
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
          const payload = await requestQortium({
            action: 'FETCH_QDN_RESOURCE',
            service: 'DOCUMENT',
            name: summary.name,
            identifier: summary.identifier,
          });

          if (payload?.videoId !== videoId) return null;

          return {
            id: summary.identifier,
            identifier: summary.identifier,
            videoId,
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

export const publishVideoComment = async ({
  videoId,
  videoTitle,
  parentId = '',
  authorName,
  authorAddress,
  messageHtml,
  messageText,
}) => {
  const timestamp = Date.now();
  const identifier = `${COMMENT_PREFIX}${toEntityKey(videoId)}_${createShortId()}`;
  const payload = {
    id: identifier,
    identifier,
    videoId,
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
    title: `Comment on ${videoTitle || 'video'}`.slice(0, 55),
    description: messageText.slice(0, 4000),
  });

  return payload;
};

export const updateVideoComment = async ({
  comment,
  videoTitle,
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
    title: `Comment on ${videoTitle || 'video'}`.slice(0, 55),
    description: messageText.slice(0, 4000),
  });

  return payload;
};

export const fetchVideoLikeCount = async (videoId) => {
  const page = await requestQortium({
    action: 'SEARCH_QDN_RESOURCES',
    service: 'DOCUMENT',
    mode: 'ALL',
    identifier: `${LIKE_PREFIX}${toLikeEntityKey(videoId)}_`,
    prefix: true,
    limit: PAGE_SIZE,
    offset: 0,
    reverse: true,
    includeMetadata: false,
    excludeBlocked: true,
  });

  return Array.isArray(page) ? page.length : 0;
};

export const publishVideoLike = async ({ videoId, videoTitle, authorName, authorAddress }) => {
  const identifier = `${LIKE_PREFIX}${toLikeEntityKey(videoId)}_${toAuthorKey(authorName || authorAddress)}`;
  const payload = {
    id: identifier,
    identifier,
    videoId,
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
    title: `Like on ${videoTitle || 'video'}`.slice(0, 55),
    description: 'Video like',
  });

  return payload;
};

export const getQortBalance = async () =>
  requestQortium({
    action: 'GET_WALLET_BALANCE',
    coin: 'QORT',
  });

export const resolveNameAddress = async (name) => {
  if (!name) return '';
  const response = await requestQortium({
    action: 'GET_NAME_DATA',
    name,
  });

  return response?.owner || '';
};

export const sendQortTip = async ({ recipient, amount }) =>
  requestQortium({
    action: 'SEND_COIN',
    coin: 'QORT',
    recipient,
    amount,
  });
