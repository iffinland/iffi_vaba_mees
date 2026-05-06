import {
  createShortId,
  encodeObjectToBase64,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';

export const VIDEO_METADATA_PREFIX = 'iffivabamees_video_';
const VIDEO_SERVICE = 'DOCUMENT';

const normalizeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildVideoIdentifier = ({ title, authorName }) => {
  const base =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'untitled-video';

  return `${VIDEO_METADATA_PREFIX}${base}_${Date.now()}_${createShortId()}`;
};

export const sanitizeVideoPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(VIDEO_METADATA_PREFIX)) {
    return null;
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const descriptionHtml =
    typeof payload.descriptionHtml === 'string' ? payload.descriptionHtml : '';
  const descriptionText =
    typeof payload.descriptionText === 'string'
      ? payload.descriptionText
      : toPlainText(descriptionHtml);
  const created = Number(payload.created ?? summary.created ?? Date.now());

  return {
    id: identifier,
    identifier,
    title,
    performer: typeof payload.performer === 'string' ? payload.performer.trim() : '',
    descriptionHtml,
    descriptionText,
    playlist: typeof payload.playlist === 'string' ? payload.playlist.trim() : '',
    publishedDate: normalizeDate(payload.publishedDate) || normalizeDate(created),
    sourceType: payload.sourceType || 'qtube',
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim() : '',
    thumbnailUrl:
      typeof payload.thumbnailUrl === 'string' ? payload.thumbnailUrl.trim() : '',
    qdnVideo: payload.qdnVideo || null,
    authorName:
      typeof payload.authorName === 'string' && payload.authorName.trim()
        ? payload.authorName.trim()
        : summary.name || '',
    authorAddress:
      typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
    likes: Number(payload.likes ?? 0),
  };
};

export const getCurrentUserProfile = async () => {
  const account = await requestQortal({ action: 'GET_USER_ACCOUNT' });
  if (!account?.address) {
    return { address: '', name: '', names: [] };
  }

  const namesResponse = await requestQortal({
    action: 'GET_ACCOUNT_NAMES',
    address: account.address,
    limit: 20,
    offset: 0,
    reverse: false,
  });

  const names = Array.isArray(namesResponse)
    ? namesResponse
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
        .filter(Boolean)
    : [];

  return {
    address: account.address,
    name: names[0] ?? '',
    names,
  };
};

const fetchSummaries = async ({ limit, offset, sortOrder }) =>
  requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: VIDEO_SERVICE,
    mode: 'ALL',
    identifier: VIDEO_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

const fetchVideoFromSummary = async (summary) => {
  const resource = await requestQortal({
    action: 'FETCH_QDN_RESOURCE',
    service: VIDEO_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  return sanitizeVideoPayload(resource ?? {}, summary);
};

export const fetchVideoByIdentifier = async (identifier) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: VIDEO_SERVICE,
    mode: 'ALL',
    identifier,
    prefix: false,
    limit: 1,
    offset: 0,
    reverse: true,
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

  const summary = Array.isArray(summaries) ? summaries[0] : null;
  if (!summary) {
    return null;
  }

  return fetchVideoFromSummary(summary);
};

export const fetchVideoPage = async ({
  page = 1,
  pageSize = 9,
  playlist = '',
  searchQuery = '',
  sortOrder = 'newest',
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedPlaylist = playlist.trim().toLowerCase();
  const offset = Math.max(0, page - 1) * pageSize;

  if (normalizedQuery || normalizedPlaylist) {
    const matches = [];
    let qdnOffset = 0;
    let hasMore = true;
    const scanLimit = 50;
    const requiredMatches = offset + pageSize + 1;

    while (hasMore && matches.length < requiredMatches) {
      const summaries = await fetchSummaries({
        limit: scanLimit,
        offset: qdnOffset,
        sortOrder,
      });
      const pageItems = Array.isArray(summaries) ? summaries : [];
      if (!pageItems.length) break;

      for (const summary of pageItems) {
        try {
          const video = await fetchVideoFromSummary(summary);
          if (!video) continue;

          const searchable = `${video.title} ${video.descriptionText}`.toLowerCase();
          const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
          const matchesPlaylist =
            !normalizedPlaylist || video.playlist.toLowerCase() === normalizedPlaylist;

          if (matchesQuery && matchesPlaylist) {
            matches.push(video);
          }
        } catch (error) {
          console.error('Failed to fetch video metadata', summary?.identifier, error);
        }
      }

      hasMore = pageItems.length === scanLimit;
      qdnOffset += pageItems.length;
    }

    return {
      videos: matches.slice(offset, offset + pageSize),
      hasNextPage: matches.length > offset + pageSize,
    };
  }

  const summaries = await fetchSummaries({
    limit: pageSize,
    offset,
    sortOrder,
  });

  const pageItems = Array.isArray(summaries) ? summaries : [];
  const videos = [];

  for (const summary of pageItems) {
    try {
      const video = await fetchVideoFromSummary(summary);
      if (video) videos.push(video);
    } catch (error) {
      console.error('Failed to fetch video metadata', summary?.identifier, error);
    }
  }

  return {
    videos,
    hasNextPage: pageItems.length === pageSize,
  };
};

export const fetchVideoPlaylists = async () => {
  const playlists = new Set();
  let offset = 0;
  const scanLimit = 50;

  while (true) {
    const summaries = await fetchSummaries({
      limit: scanLimit,
      offset,
      sortOrder: 'newest',
    });
    const pageItems = Array.isArray(summaries) ? summaries : [];
    if (!pageItems.length) break;

    for (const summary of pageItems) {
      try {
        const video = await fetchVideoFromSummary(summary);
        if (video?.playlist) {
          playlists.add(video.playlist);
        }
      } catch (error) {
        console.error('Failed to fetch video playlist metadata', summary?.identifier, error);
      }
    }

    if (pageItems.length < scanLimit) break;
    offset += pageItems.length;
  }

  return Array.from(playlists).sort((a, b) => a.localeCompare(b));
};

export const publishVideo = async ({ form, authorName, authorAddress }) => {
  const now = Date.now();
  const identifier = buildVideoIdentifier({ title: form.title, authorName });
  let qdnVideo = null;

  if (form.sourceType === 'upload' && form.videoFile) {
    const videoResponse = await requestQortal({
      action: 'PUBLISH_QDN_RESOURCE',
      name: authorName,
      service: 'VIDEO',
      identifier,
      file: form.videoFile,
      filename: form.videoFile.name || `${identifier}.mp4`,
      title: form.title || 'Untitled video',
      description: toPlainText(form.descriptionHtml).slice(0, 4000),
    });

    qdnVideo = {
      service: 'VIDEO',
      name: videoResponse?.name || authorName,
      identifier: videoResponse?.identifier || identifier,
      filename: form.videoFile.name || '',
    };
  }

  const payload = sanitizeVideoPayload({
    id: identifier,
    identifier,
    title: form.title,
    performer: form.performer,
    descriptionHtml: form.descriptionHtml,
    descriptionText: toPlainText(form.descriptionHtml),
    playlist: form.playlist,
    publishedDate: form.publishedDate,
    sourceType: form.sourceType,
    sourceUrl: form.sourceUrl,
    thumbnailUrl: form.thumbnailUrl,
    qdnVideo,
    authorName,
    authorAddress,
    created: now,
    updated: now,
  });

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: VIDEO_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: payload.title || 'Untitled video',
    description: payload.descriptionText.slice(0, 4000),
  });

  return payload;
};

export const updateVideoDescription = async ({ video, descriptionHtml, authorName }) => {
  const updatedVideo = sanitizeVideoPayload({
    ...video,
    descriptionHtml,
    descriptionText: toPlainText(descriptionHtml),
    updated: Date.now(),
  });

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: VIDEO_SERVICE,
    identifier: updatedVideo.identifier,
    data64: encodeObjectToBase64(updatedVideo),
    encoding: 'base64',
    title: updatedVideo.title || 'Untitled video',
    description: updatedVideo.descriptionText.slice(0, 4000),
  });

  return updatedVideo;
};
