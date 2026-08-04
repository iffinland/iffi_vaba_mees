import {
  createShortId,
  encodeObjectToBase64,
  requestQortium,
  sanitizeIdentifierSegment,
} from './qortium/qortiumClient';
import { isOwnerName, isOwnerProfile, OWNER_QORTIUM_NAME } from '../utils/siteConfig';
import {
  buildResourceKey,
  getQdnResourceUrl,
  publishMultipleQdnResources,
  validateBatchResult,
} from './qdnResourceService';
import { getCurrentUserProfile } from './videoService';

export { getCurrentUserProfile };

export const BLOG_METADATA_PREFIX = 'ivm_blog_';
const BLOG_SERVICE = 'DOCUMENT';
const COVER_SERVICE = 'THUMBNAIL';
const MAX_QDN_IDENTIFIER_LENGTH = 60;
const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_COVER_BYTES = 500000;
const COVER_CANVAS_MAX_SIZE = 1600;
const MAX_QDN_METADATA_TITLE_LENGTH = 80;
const MAX_QDN_METADATA_DESCRIPTION_LENGTH = 240;

const loadImageFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Cover image could not be processed.'));
    };
    image.src = url;
  });

const getBase64ByteSize = (base64) => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const renderCoverBase64 = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Cover must be an image file.');
  }

  if (file.size > MAX_COVER_UPLOAD_BYTES) {
    throw new Error('Cover image is too large. Maximum upload size is 5 MB.');
  }

  const image = await loadImageFile(file);
  const ratio = Math.min(1, COVER_CANVAS_MAX_SIZE / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * ratio));
  let height = Math.max(1, Math.round(image.height * ratio));

  for (let scaleAttempt = 0; scaleAttempt < 5; scaleAttempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Cover image processing is not available.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';

      if (getBase64ByteSize(base64) <= MAX_QDN_COVER_BYTES) {
        return base64;
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  throw new Error('Cover image could not be optimized for QDN.');
};

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

const toQdnMetadataText = (value, maxLength) => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const toQdnTitle = (value, fallback) =>
  toQdnMetadataText(value || fallback, MAX_QDN_METADATA_TITLE_LENGTH) || fallback;

const toQdnDescription = (value, fallback = '') =>
  toQdnMetadataText(value || fallback, MAX_QDN_METADATA_DESCRIPTION_LENGTH);

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12);
  }

  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const resolveResourceUrl = async (resource) => {
  if (!resource?.service || !resource?.name || !resource?.identifier) return '';

  try {
    return await getQdnResourceUrl(resource);
  } catch (error) {
    console.warn('Failed to resolve blog resource URL', resource.identifier, error);
    return '';
  }
};

export const buildBlogIdentifier = ({ title, authorName }) => {
  const rawBase =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'post';
  const suffix = `${Date.now().toString(36)}_${createShortId()}`;
  const maxBaseLength = Math.max(
    8,
    MAX_QDN_IDENTIFIER_LENGTH - BLOG_METADATA_PREFIX.length - suffix.length - 1,
  );
  const base = rawBase.slice(0, maxBaseLength).replace(/-+$/g, '') || 'post';

  return `${BLOG_METADATA_PREFIX}${base}_${suffix}`;
};

export const sanitizeBlogPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(BLOG_METADATA_PREFIX)) {
    return null;
  }

  const resourceOwnerName = typeof summary.name === 'string' ? summary.name : payload.authorName;
  const resourceOwnerAddress =
    typeof summary.address === 'string' ? summary.address : payload.authorAddress;
  if (!isOwnerProfile({ name: resourceOwnerName, address: resourceOwnerAddress })) {
    return null;
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const contentHtml = typeof payload.contentHtml === 'string' ? payload.contentHtml : '';
  const contentText =
    typeof payload.contentText === 'string' ? payload.contentText : toPlainText(contentHtml);
  const excerpt =
    typeof payload.excerpt === 'string' && payload.excerpt.trim()
      ? payload.excerpt.trim()
      : toQdnDescription(contentText, '');
  const created = Number(payload.created ?? summary.created ?? Date.now());

  return {
    id: identifier,
    identifier,
    title,
    excerpt,
    contentHtml,
    contentText,
    category: typeof payload.category === 'string' ? payload.category.trim() : '',
    tags: normalizeTags(payload.tags),
    publishedDate: normalizeDate(payload.publishedDate) || normalizeDate(created),
    coverResource: payload.coverResource || null,
    coverUrl: typeof payload.coverUrl === 'string' ? payload.coverUrl : '',
    authorName: OWNER_QORTIUM_NAME,
    authorAddress: typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
  };
};

const fetchSummaries = async ({ limit, offset, sortOrder }) =>
  requestQortium({
    action: 'SEARCH_QDN_RESOURCES',
    service: BLOG_SERVICE,
    mode: 'ALL',
    identifier: BLOG_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

const fetchBlogPostFromSummary = async (summary) => {
  if (!isOwnerName(summary?.name)) return null;

  const resource = await requestQortium({
    action: 'FETCH_QDN_RESOURCE',
    service: BLOG_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  const post = sanitizeBlogPayload(resource ?? {}, summary);
  if (!post?.coverResource || post.coverUrl) {
    return post;
  }

  return {
    ...post,
    coverUrl: await resolveResourceUrl(post.coverResource),
  };
};

export const fetchBlogByIdentifier = async (identifier) => {
  const summaries = await requestQortium({
    action: 'SEARCH_QDN_RESOURCES',
    service: BLOG_SERVICE,
    mode: 'ALL',
    identifier,
    prefix: false,
    limit: 20,
    offset: 0,
    reverse: true,
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

  const ownerSummary = Array.isArray(summaries)
    ? summaries.find((summary) => summary.identifier === identifier && isOwnerName(summary.name))
    : null;
  if (!ownerSummary) return null;

  return fetchBlogPostFromSummary(ownerSummary);
};

export const fetchBlogPage = async ({
  page = 1,
  pageSize = 9,
  category = '',
  searchQuery = '',
  sortOrder = 'newest',
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();
  const offset = Math.max(0, page - 1) * pageSize;

  if (normalizedQuery || normalizedCategory) {
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
          const post = await fetchBlogPostFromSummary(summary);
          if (!post) continue;

          const searchable = `${post.title} ${post.excerpt} ${post.contentText} ${post.tags.join(' ')}`.toLowerCase();
          const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
          const matchesCategory =
            !normalizedCategory || post.category.toLowerCase() === normalizedCategory;

          if (matchesQuery && matchesCategory) {
            matches.push(post);
          }
        } catch (error) {
          console.error('Failed to fetch blog post metadata', summary?.identifier, error);
        }
      }

      hasMore = pageItems.length === scanLimit;
      qdnOffset += pageItems.length;
    }

    return {
      posts: matches.slice(offset, offset + pageSize),
      hasNextPage: matches.length > offset + pageSize,
    };
  }

  const posts = [];
  let ownerPostCount = 0;
  let qdnOffset = 0;
  let hasMore = true;
  const scanLimit = 50;

  while (hasMore && posts.length < pageSize + 1) {
    const summaries = await fetchSummaries({
      limit: scanLimit,
      offset: qdnOffset,
      sortOrder,
    });
    const pageItems = Array.isArray(summaries) ? summaries : [];
    if (!pageItems.length) break;

    for (const summary of pageItems) {
      try {
        const post = await fetchBlogPostFromSummary(summary);
        if (!post) continue;

        if (ownerPostCount >= offset) {
          posts.push(post);
        }
        ownerPostCount += 1;

        if (posts.length >= pageSize + 1) break;
      } catch (error) {
        console.error('Failed to fetch blog post metadata', summary?.identifier, error);
      }
    }

    hasMore = pageItems.length === scanLimit;
    qdnOffset += pageItems.length;
  }

  return {
    posts: posts.slice(0, pageSize),
    hasNextPage: posts.length > pageSize,
  };
};

export const fetchBlogCategories = async () => {
  const categories = new Set();
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
        const post = await fetchBlogPostFromSummary(summary);
        if (post?.category) {
          categories.add(post.category);
        }
      } catch (error) {
        console.error('Failed to fetch blog category metadata', summary?.identifier, error);
      }
    }

    if (pageItems.length < scanLimit) break;
    offset += pageItems.length;
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b));
};

// ---------------------------------------------------------------------------
// Pure cover preparation helper — NO bridge requests
// ---------------------------------------------------------------------------

/**
 * Prepares a cover thumbnail payload for batch publication.
 * Returns null when no cover file is provided.
 *
 * This is a PURE preparation function — it performs NO bridge requests.
 *
 * @param {{ file: File|null, identifier: string, authorName: string }} params
 * @returns {Promise<{
 *   coverId: string,
 *   coverData64: string,
 *   coverResource: { service: string, name: string, identifier: string, filename: string },
 * }|null>}
 */
const prepareCoverPayload = async ({ file, identifier, authorName }) => {
  if (!file) return null;

  const coverId = `${identifier}_c`;
  const coverData64 = await renderCoverBase64(file);

  return {
    coverId,
    coverData64,
    coverResource: {
      service: COVER_SERVICE,
      name: authorName,
      identifier: coverId,
      filename: file.name || '',
    },
  };
};

// ---------------------------------------------------------------------------
// Two-stage Blog create
// ---------------------------------------------------------------------------
//
// Stage 1 — Child-resource batch (PUBLISH_MULTIPLE_QDN_RESOURCES):
//   Optional cover THUMBNAIL (single resource in batch).
//   The parent DOCUMENT metadata is NOT included.
//
// Stage 2 — Parent metadata (conditional, PUBLISH_QDN_RESOURCE):
//   Only executed when Stage 1 succeeds completely.
//
// Without a cover file, Stage 1 is skipped entirely.
//
// @param {{ form: object, authorName: string, authorAddress: string, onProgress?: function }} params
// @returns {Promise<object>} The sanitized blog post object

export const publishBlogPost = async ({ form, authorName, authorAddress, onProgress }) => {
  if (!isOwnerProfile({ name: authorName, address: authorAddress })) {
    throw new Error('Only the site owner can publish blog posts.');
  }

  const progress = (event) => {
    if (typeof onProgress === 'function') {
      onProgress(event);
    }
  };

  const now = Date.now();
  const identifier = buildBlogIdentifier({ title: form.title, authorName });
  const hasCover = Boolean(form.coverFile);
  const totalChildResources = hasCover ? 1 : 0;

  if (!hasCover) {
    // ---- No cover: single-stage metadata publication ----
    progress({
      phase: 'preparing',
      current: 0,
      total: 0,
      resources: [],
      message: 'Preparing Blog information…',
      stage1Complete: true, // No media stage needed
    });

    const payload = sanitizeBlogPayload(
      {
        id: identifier,
        identifier,
        title: form.title,
        excerpt: form.excerpt,
        contentHtml: form.contentHtml,
        contentText: toPlainText(form.contentHtml),
        category: form.category,
        tags: normalizeTags(form.tags),
        publishedDate: form.publishedDate,
        coverResource: null,
        coverUrl: '',
        authorName,
        authorAddress,
        created: now,
        updated: now,
      },
      { name: OWNER_QORTIUM_NAME, address: authorAddress, identifier, created: now, updated: now },
    );

    if (!payload) {
      throw new Error('Unable to prepare blog post payload for publishing.');
    }

    progress({
      phase: 'waiting-for-metadata-approval',
      message: 'Waiting for Qortium approval…\n\nApprove the Blog information publication in the Qortium Home window.',
      stage1Complete: true,
    });

    progress({
      phase: 'publishing-metadata',
      message: 'Publishing Blog information…',
    });

    await requestQortium({
      action: 'PUBLISH_QDN_RESOURCE',
      name: OWNER_QORTIUM_NAME,
      service: BLOG_SERVICE,
      identifier,
      data64: encodeObjectToBase64(payload),
      encoding: 'base64',
      title: toQdnTitle(payload.title, 'Untitled blog post'),
      description: toQdnDescription(payload.excerpt || payload.contentText, 'Blog post'),
    });

    progress({
      phase: 'complete',
      message: `Blog post published successfully.\n\n${form.title || 'Untitled'}`,
      resources: [],
    });

    return payload;
  }

  // ---- Has cover: two-stage batch publication ----

  // Build resource list for progress tracking
  const resourceList = [];
  if (hasCover) {
    resourceList.push({
      id: 'COVER:0',
      label: `Cover — ${form.coverFile?.name || 'cover'}`,
      service: COVER_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
  }

  // ---- Phase 1: Prepare cover payload (no publishing yet) ----
  progress({
    phase: 'preparing',
    current: 0,
    total: totalChildResources,
    resources: resourceList,
    message: `Preparing cover image…`,
  });

  let preparedCover = null;

  if (hasCover) {
    progress({
      phase: 'preparing',
      current: 0,
      total: totalChildResources,
      resource: {
        id: 'COVER:0',
        status: 'preparing',
        label: `Cover — ${form.coverFile?.name || 'cover'}`,
      },
    });

    try {
      preparedCover = await prepareCoverPayload({
        file: form.coverFile,
        identifier,
        authorName: OWNER_QORTIUM_NAME,
      });

      progress({
        phase: 'preparing',
        current: 1,
        total: totalChildResources,
        resource: {
          id: 'COVER:0',
          status: 'prepared',
          identifier: preparedCover.coverId,
          label: `Cover — ${form.coverFile?.name || 'cover'}`,
        },
      });
    } catch (error) {
      progress({
        phase: 'failed',
        current: 0,
        total: totalChildResources,
        resource: {
          id: 'COVER:0',
          status: 'failed',
          error: error?.message || 'unknown error',
        },
        message: `Cover preparation failed.\n\nFile: ${form.coverFile?.name || 'cover'}\nReason: ${error?.message || 'unknown error'}\n\nNo QDN resources were submitted.`,
      });
      throw new Error(
        `Unable to prepare cover image for publishing: ${error?.message || 'unknown error'}`,
      );
    }
  }

  // ---- Phase 2: Build child-resource batch array ----
  const batchResources = [];
  const expectedKeys = new Set();

  if (preparedCover) {
    batchResources.push({
      service: COVER_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: preparedCover.coverId,
      data64: preparedCover.coverData64,
      encoding: 'base64',
      title: toQdnTitle(form.title, 'Blog cover'),
      description: toQdnDescription(`Cover image for ${form.title || 'blog post'}`),
    });
    expectedKeys.add(buildResourceKey(preparedCover.coverResource));
  }

  // ---- Stage 1: Publish child-resource batch ----
  progress({
    phase: 'waiting-for-media-approval',
    current: totalChildResources,
    total: totalChildResources,
    message: `Waiting for media approval…\n\nApprove the cover publication in the Qortium Home window.`,
  });

  let batchResult;

  try {
    batchResult = await publishMultipleQdnResources(batchResources);
  } catch (error) {
    progress({
      phase: 'failed',
      message: `Cover publication failed: ${error?.message || 'unknown error'}`,
      error: error?.message || 'unknown error',
    });
    throw error;
  }

  // Cancellation detection
  if (!batchResult.accepted && batchResult.published.length === 0) {
    progress({
      phase: 'failed',
      message: 'Cover publication was cancelled.\n\nThe Blog post was not created.',
    });
    throw new Error('Cover publication was cancelled. The Blog post was not created.');
  }

  // Indeterminate publishing phase
  progress({
    phase: 'publishing-media',
    message: `Publishing cover through Qortium Home…`,
  });

  // Validation phase
  progress({
    phase: 'validating-media',
    message: 'Checking publication results…',
  });

  const validationError = validateBatchResult(
    batchResult.published,
    batchResult.failures,
    expectedKeys,
  );

  if (validationError) {
    const successCount = batchResult.published.length;
    const failureCount = batchResult.failures.length;

    const publishedIds = new Set(
      batchResult.published.map((entry) => entry.resource?.identifier).filter(Boolean),
    );
    const failureEntries = new Map();
    for (const f of batchResult.failures) {
      if (f.resource?.identifier) {
        failureEntries.set(f.resource.identifier, f.error || 'unknown error');
      }
    }

    const resultResources = [];
    if (preparedCover) {
      resultResources.push({
        id: 'COVER:0',
        identifier: preparedCover.coverId,
        status: publishedIds.has(preparedCover.coverId) ? 'published' : 'failed',
        error:
          failureEntries.get(preparedCover.coverId) ||
          (publishedIds.has(preparedCover.coverId) ? '' : 'Resource not found in batch result'),
      });
    }

    progress({
      phase: 'failed',
      message: `Cover publication failed.\n\n${successCount} succeeded\n${failureCount} failed\n\nThe Blog post was not created.`,
      resources: resultResources,
    });

    throw new Error(
      `Cover publication failed. ` +
        `${successCount} succeeded, ${failureCount} failed. ` +
        `The Blog post was not created. You can retry safely. ` +
        `(${validationError.detail})`,
    );
  }

  // Mark cover as published
  const allPublishedResources = [];
  if (preparedCover) {
    allPublishedResources.push({ id: 'COVER:0', status: 'published', error: '' });
  }

  // ---- Phase 3: Resolve cover URL ----
  let coverResource = null;
  let coverUrl = '';

  if (preparedCover) {
    coverResource = preparedCover.coverResource;
    coverUrl = await resolveResourceUrl(coverResource);
  }

  // ---- Phase 4: Build and validate Blog metadata ----
  const payload = sanitizeBlogPayload(
    {
      id: identifier,
      identifier,
      title: form.title,
      excerpt: form.excerpt,
      contentHtml: form.contentHtml,
      contentText: toPlainText(form.contentHtml),
      category: form.category,
      tags: normalizeTags(form.tags),
      publishedDate: form.publishedDate,
      coverResource,
      coverUrl,
      authorName,
      authorAddress,
      created: now,
      updated: now,
    },
    { name: OWNER_QORTIUM_NAME, address: authorAddress, identifier, created: now, updated: now },
  );

  if (!payload) {
    throw new Error(
      'Cover was published but the Blog record could not be prepared. ' +
        'Please try again.',
    );
  }

  // ---- Stage 2: Publish parent DOCUMENT metadata ----
  progress({
    phase: 'waiting-for-metadata-approval',
    resources: allPublishedResources,
    message: `Cover published successfully.\n\nApprove the Blog information publication in Qortium Home.`,
  });

  try {
    progress({
      phase: 'publishing-metadata',
      message: `Publishing Blog information…`,
    });

    await requestQortium({
      action: 'PUBLISH_QDN_RESOURCE',
      name: OWNER_QORTIUM_NAME,
      service: BLOG_SERVICE,
      identifier,
      data64: encodeObjectToBase64(payload),
      encoding: 'base64',
      title: toQdnTitle(payload.title, 'Untitled blog post'),
      description: toQdnDescription(payload.excerpt || payload.contentText, 'Blog post'),
    });
  } catch (error) {
    const errorMsg = error?.message || 'unknown error';
    if (errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
      progress({
        phase: 'failed',
        message: `Blog information publication was cancelled.\n\nThe cover may already exist on QDN, but the Blog post is not visible.`,
      });
      throw new Error(
        `Blog information publication was cancelled. The cover may already exist on QDN, but the Blog post is not visible.`,
      );
    }

    progress({
      phase: 'failed',
      message: `Cover was published, but the Blog information could not be saved.\n\nThe Blog post is not visible.\nYou may retry.`,
    });
    throw new Error(
      `Cover was published successfully, but the Blog record could not be saved: ` +
        `${errorMsg}. Please try publishing again.`,
    );
  }

  // ---- Complete ----
  progress({
    phase: 'complete',
    message: `Blog post published successfully.\n\n${form.title || 'Untitled'}`,
    resources: allPublishedResources,
  });

  return payload;
};

// ---------------------------------------------------------------------------
// Two-stage Blog edit
// ---------------------------------------------------------------------------
//
// Metadata-only edits (no new cover) skip Stage 1 entirely and go directly to
// PUBLISH_QDN_RESOURCE for the parent DOCUMENT update.
//
// Edits with a new cover follow the two-stage pattern:
//   Stage 1: PUBLISH_MULTIPLE_QDN_RESOURCES (new cover THUMBNAIL)
//   Stage 2: PUBLISH_QDN_RESOURCE (updated parent DOCUMENT, gated on Stage 1)
//
// The existing Blog post remains authoritative until Stage 2 succeeds.
//
// @param {{ post: object, form: object, authorName: string, authorAddress: string, onProgress?: function }} params
// @returns {Promise<object>} The updated sanitized blog post

export const updateBlogPost = async ({ post, form, authorName, authorAddress, onProgress }) => {
  if (!isOwnerProfile({ name: authorName, address: authorAddress })) {
    throw new Error('Only the site owner can edit blog posts.');
  }

  const progress = (event) => {
    if (typeof onProgress === 'function') {
      onProgress(event);
    }
  };

  const now = Date.now();
  const hasNewCover = Boolean(form.coverFile);
  const isMetadataOnly = !hasNewCover;

  // -----------------------------------------------------------------------
  // Metadata-only edit — no new cover
  // -----------------------------------------------------------------------
  if (isMetadataOnly) {
    progress({
      phase: 'preparing',
      current: 0,
      total: 0,
      resources: [],
      message: 'Preparing Blog update…',
      stage1Complete: true,
    });

    const updatedPost = sanitizeBlogPayload(
      {
        ...post,
        title: form.title,
        excerpt: form.excerpt,
        contentHtml: form.contentHtml,
        contentText: toPlainText(form.contentHtml),
        category: form.category,
        tags: normalizeTags(form.tags),
        publishedDate: form.publishedDate,
        coverResource: post.coverResource || null,
        coverUrl: post.coverUrl || '',
        updated: now,
      },
      { name: OWNER_QORTIUM_NAME, address: authorAddress, identifier: post.identifier },
    );

    if (!updatedPost) {
      throw new Error('Unable to prepare blog post payload for publishing.');
    }

    progress({
      phase: 'waiting-for-metadata-approval',
      message: 'Waiting for Qortium approval…\n\nApprove the Blog information update in the Qortium Home window.',
      stage1Complete: true,
    });

    progress({
      phase: 'publishing-metadata',
      message: 'Saving Blog information…',
    });

    try {
      await requestQortium({
        action: 'PUBLISH_QDN_RESOURCE',
        name: OWNER_QORTIUM_NAME,
        service: BLOG_SERVICE,
        identifier: updatedPost.identifier,
        data64: encodeObjectToBase64(updatedPost),
        encoding: 'base64',
        title: toQdnTitle(updatedPost.title, 'Untitled blog post'),
        description: toQdnDescription(updatedPost.excerpt || updatedPost.contentText, 'Blog post'),
      });
    } catch (error) {
      const errorMsg = error?.message || 'unknown error';
      if (errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
        progress({
          phase: 'failed',
          message: 'Blog information update was cancelled.\n\nThe Blog post remains unchanged.',
        });
        throw new Error('Blog information update was cancelled. The Blog post remains unchanged.');
      }

      progress({
        phase: 'failed',
        message: `Blog information could not be saved: ${errorMsg}`,
      });
      throw error;
    }

    progress({
      phase: 'complete',
      message: `Blog post updated successfully.\n\n${form.title || post.title || 'Untitled'}`,
      resources: [],
    });

    return updatedPost;
  }

  // -----------------------------------------------------------------------
  // Edit with new cover — two-stage batch publication
  // -----------------------------------------------------------------------

  const totalChildResources = 1; // single cover THUMBNAIL

  const resourceList = [
    {
      id: 'COVER:0',
      label: `Cover — ${form.coverFile?.name || 'cover'}`,
      service: COVER_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    },
  ];

  // ---- Phase 1: Prepare new cover payload ----
  progress({
    phase: 'preparing',
    current: 0,
    total: totalChildResources,
    resources: resourceList,
    message: 'Preparing new cover…',
  });

  progress({
    phase: 'preparing',
    current: 0,
    total: totalChildResources,
    resource: {
      id: 'COVER:0',
      status: 'preparing',
      label: `Cover — ${form.coverFile?.name || 'cover'}`,
    },
  });

  let preparedCover;

  try {
    preparedCover = await prepareCoverPayload({
      file: form.coverFile,
      identifier: post.identifier,
      authorName: OWNER_QORTIUM_NAME,
    });

    progress({
      phase: 'preparing',
      current: 1,
      total: totalChildResources,
      resource: {
        id: 'COVER:0',
        status: 'prepared',
        identifier: preparedCover.coverId,
        label: `Cover — ${form.coverFile?.name || 'cover'}`,
      },
    });
  } catch (error) {
    progress({
      phase: 'failed',
      current: 0,
      total: totalChildResources,
      resource: {
        id: 'COVER:0',
        status: 'failed',
        error: error?.message || 'unknown error',
      },
      message: `Cover preparation failed.\n\nFile: ${form.coverFile?.name || 'cover'}\nReason: ${error?.message || 'unknown error'}\n\nNo QDN resources were submitted. The Blog post remains unchanged.`,
    });
    throw new Error(
      `Unable to prepare cover image for publishing: ${error?.message || 'unknown error'}`,
    );
  }

  // ---- Phase 2: Build child-resource batch array ----
  const batchResources = [];
  const expectedKeys = new Set();

  batchResources.push({
    service: COVER_SERVICE,
    name: OWNER_QORTIUM_NAME,
    identifier: preparedCover.coverId,
    data64: preparedCover.coverData64,
    encoding: 'base64',
    title: toQdnTitle(form.title || post.title, 'Blog cover'),
    description: toQdnDescription(`Cover image for ${form.title || post.title || 'blog post'}`),
  });
  expectedKeys.add(buildResourceKey(preparedCover.coverResource));

  // ---- Stage 1: Publish new cover batch ----
  progress({
    phase: 'waiting-for-media-approval',
    current: totalChildResources,
    total: totalChildResources,
    message: 'Waiting for media approval…\n\nApprove the cover publication in the Qortium Home window.',
  });

  let batchResult;

  try {
    batchResult = await publishMultipleQdnResources(batchResources);
  } catch (error) {
    progress({
      phase: 'failed',
      message: `Cover publication failed: ${error?.message || 'unknown error'}\n\nThe Blog post remains unchanged.`,
      error: error?.message || 'unknown error',
    });
    throw error;
  }

  // Cancellation detection
  if (!batchResult.accepted && batchResult.published.length === 0) {
    progress({
      phase: 'failed',
      message: 'Cover publication was cancelled.\n\nThe Blog post remains unchanged.',
    });
    throw new Error('Cover publication was cancelled. The Blog post remains unchanged.');
  }

  // Indeterminate publishing phase
  progress({
    phase: 'publishing-media',
    message: 'Publishing cover…',
  });

  // Validation phase
  progress({
    phase: 'validating-media',
    message: 'Checking publication results…',
  });

  const validationError = validateBatchResult(
    batchResult.published,
    batchResult.failures,
    expectedKeys,
  );

  if (validationError) {
    const successCount = batchResult.published.length;
    const failureCount = batchResult.failures.length;

    const publishedIds = new Set(
      batchResult.published.map((entry) => entry.resource?.identifier).filter(Boolean),
    );
    const failureEntries = new Map();
    for (const f of batchResult.failures) {
      if (f.resource?.identifier) {
        failureEntries.set(f.resource.identifier, f.error || 'unknown error');
      }
    }

    const resultResources = [
      {
        id: 'COVER:0',
        identifier: preparedCover.coverId,
        status: publishedIds.has(preparedCover.coverId) ? 'published' : 'failed',
        error:
          failureEntries.get(preparedCover.coverId) ||
          (publishedIds.has(preparedCover.coverId) ? '' : 'Resource not found in batch result'),
      },
    ];

    progress({
      phase: 'failed',
      message: `Cover publication failed.\n\n${successCount} succeeded\n${failureCount} failed\n\nThe Blog post remains unchanged.`,
      resources: resultResources,
    });

    throw new Error(
      `Cover publication failed. ` +
        `${successCount} succeeded, ${failureCount} failed. ` +
        `The Blog post remains unchanged. You can retry safely. ` +
        `(${validationError.detail})`,
    );
  }

  // Mark cover as published
  const allPublishedResources = [
    { id: 'COVER:0', status: 'published', error: '' },
  ];

  // ---- Phase 3: Resolve new cover URL ----
  const coverResource = preparedCover.coverResource;
  const coverUrl = await resolveResourceUrl(coverResource);

  // ---- Phase 4: Build updated Blog metadata ----
  const updatedPost = sanitizeBlogPayload(
    {
      ...post,
      title: form.title,
      excerpt: form.excerpt,
      contentHtml: form.contentHtml,
      contentText: toPlainText(form.contentHtml),
      category: form.category,
      tags: normalizeTags(form.tags),
      publishedDate: form.publishedDate,
      coverResource,
      coverUrl,
      updated: now,
    },
    { name: OWNER_QORTIUM_NAME, address: authorAddress, identifier: post.identifier },
  );

  if (!updatedPost) {
    throw new Error(
      'New cover was published but the Blog information could not be prepared. ' +
        'Please try again.',
    );
  }

  // ---- Stage 2: Publish updated parent DOCUMENT metadata ----
  progress({
    phase: 'waiting-for-metadata-approval',
    resources: allPublishedResources,
    message: 'Cover published successfully.\n\nApprove the Blog information update in Qortium Home.',
  });

  try {
    progress({
      phase: 'publishing-metadata',
      message: 'Saving Blog information…',
    });

    await requestQortium({
      action: 'PUBLISH_QDN_RESOURCE',
      name: OWNER_QORTIUM_NAME,
      service: BLOG_SERVICE,
      identifier: updatedPost.identifier,
      data64: encodeObjectToBase64(updatedPost),
      encoding: 'base64',
      title: toQdnTitle(updatedPost.title, 'Untitled blog post'),
      description: toQdnDescription(updatedPost.excerpt || updatedPost.contentText, 'Blog post'),
    });
  } catch (error) {
    const errorMsg = error?.message || 'unknown error';
    if (errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
      progress({
        phase: 'failed',
        message: 'Blog information update was cancelled.\n\nNew cover may have been published, but the Blog update was not saved.',
      });
      throw new Error(
        'Blog information update was cancelled. New cover may have been published, but the Blog update was not saved.',
      );
    }

    progress({
      phase: 'failed',
      message: `New cover was published, but the Blog information could not be saved.\n\nThe Blog post remains unchanged in its previous state.`,
    });
    throw new Error(
      `New cover was published successfully, but the Blog record could not be updated: ` +
        `${errorMsg}. Please try publishing again.`,
    );
  }

  // ---- Complete ----
  progress({
    phase: 'complete',
    message: `Blog post updated successfully.\n\n${form.title || post.title || 'Untitled'}`,
    resources: allPublishedResources,
  });

  return updatedPost;
};

export const deleteBlogPost = async ({ identifier, authorName, authorAddress }) => {
  if (!isOwnerProfile({ name: authorName, address: authorAddress })) {
    throw new Error('Only the site owner can delete blog posts.');
  }

  if (!identifier || typeof identifier !== 'string') {
    throw new Error('A valid blog post identifier is required.');
  }

  const result = await requestQortium({
    action: 'DELETE_QDN_RESOURCE',
    name: OWNER_QORTIUM_NAME,
    service: BLOG_SERVICE,
    identifier,
  });

  if (!result?.accepted) {
    throw new Error('Blog post deletion was not accepted by QDN.');
  }

  return { deleted: true, identifier };
};

export const buildBlogPageLink = () => '';
