import {
  createShortId,
  encodeObjectToBase64,
  fileToBase64,
  requestQortium,
  sanitizeIdentifierSegment,
} from './qortium/qortiumClient';
import {
  buildResourceKey,
  getQdnResourceUrl,
  publishMultipleQdnResources,
  validateBatchResult,
} from './qdnResourceService';
import { isOwnerName, isOwnerProfile, OWNER_QORTIUM_NAME } from '../utils/siteConfig';
import { getCurrentUserProfile } from './videoService';

export { getCurrentUserProfile };

export const GALLERY_METADATA_PREFIX = 'iffivabamees_gallery_';
const GALLERY_IMAGE_PREFIX = 'ivm_gi_';
const GALLERY_SERVICE = 'DOCUMENT';
const IMAGE_SERVICE = 'IMAGE';
const THUMBNAIL_SERVICE = 'THUMBNAIL';
const PAGE_SIZE_SCAN = 50;
const MAX_GALLERY_THUMBNAIL_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_QDN_THUMBNAIL_BYTES = 500000;
const THUMBNAIL_CANVAS_MAX_SIZE = 1280;

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
      reject(new Error('Image could not be processed.'));
    };
    image.src = url;
  });

const getBase64ByteSize = (base64) => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const renderThumbnailBase64 = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Thumbnail must be an image file.');
  }

  if (file.size > MAX_GALLERY_THUMBNAIL_UPLOAD_BYTES) {
    throw new Error('Thumbnail image is too large. Maximum upload size is 5 MB.');
  }

  const image = await loadImageFile(file);
  const ratio = Math.min(1, THUMBNAIL_CANVAS_MAX_SIZE / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * ratio));
  let height = Math.max(1, Math.round(image.height * ratio));

  for (let scaleAttempt = 0; scaleAttempt < 5; scaleAttempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Image processing is not available.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';

      if (getBase64ByteSize(base64) <= MAX_QDN_THUMBNAIL_BYTES) {
        return base64;
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  throw new Error('Image could not be optimized for QDN thumbnail publishing.');
};

const buildGalleryIdentifier = ({ title, authorName }) => {
  const base =
    sanitizeIdentifierSegment(title) ||
    sanitizeIdentifierSegment(authorName) ||
    'gallery';
  const timestamp = Date.now().toString(36);

  return `${GALLERY_METADATA_PREFIX}${base.slice(0, 18)}_${timestamp}_${createShortId()}`;
};

const buildImageIdentifier = (index) =>
  `${GALLERY_IMAGE_PREFIX}${Date.now().toString(36)}_${index}_${createShortId()}`;

const resolveResourceUrl = async (resource) => {
  if (!resource?.service || !resource?.name || !resource?.identifier) return '';

  try {
    return await getQdnResourceUrl(resource);
  } catch (error) {
    console.warn('Failed to resolve gallery resource URL', resource.identifier, error);
    return '';
  }
};

const sanitizeGalleryPayload = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(GALLERY_METADATA_PREFIX)) {
    return null;
  }

  const resourceOwnerName = typeof summary.name === 'string' ? summary.name : payload.authorName;
  const resourceOwnerAddress =
    typeof summary.address === 'string' ? summary.address : payload.authorAddress;
  if (!isOwnerProfile({ name: resourceOwnerName, address: resourceOwnerAddress })) {
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
  const images = Array.isArray(payload.images)
    ? payload.images
        .filter((image) => image?.id && image?.imageResource)
        .map((image, index) => ({
          id: image.id,
          title: typeof image.title === 'string' ? image.title : '',
          description: typeof image.description === 'string' ? image.description : '',
          imageResource: image.imageResource,
          thumbnailResource: image.thumbnailResource || null,
          src: typeof image.src === 'string' ? image.src : '',
          thumbnailUrl: typeof image.thumbnailUrl === 'string' ? image.thumbnailUrl : '',
          order: Number(image.order ?? index),
          created: Number(image.created ?? created),
        }))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id: identifier,
    identifier,
    title,
    descriptionHtml,
    descriptionText,
    coverResource: payload.coverResource || null,
    coverUrl: typeof payload.coverUrl === 'string' ? payload.coverUrl : '',
    images,
    authorName:
      typeof payload.authorName === 'string' && payload.authorName.trim()
        ? payload.authorName.trim()
        : summary.name || '',
    authorAddress: typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    created,
    updated: Number(payload.updated ?? summary.updated ?? created),
  };
};

const publishGalleryMetadata = async ({ gallery, authorName }) => {
  const metadata = {
    ...gallery,
    coverUrl: '',
    images: gallery.images.map((image) => ({
      ...image,
      src: '',
      thumbnailUrl: '',
    })),
  };

  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: GALLERY_SERVICE,
    identifier: gallery.identifier,
    data64: encodeObjectToBase64(metadata),
    encoding: 'base64',
    title: gallery.title || 'Untitled gallery',
    description: gallery.descriptionText.slice(0, 4000),
  });
};

// ---------------------------------------------------------------------------
// Two-stage batch publication helpers (Gallery create only)
// ---------------------------------------------------------------------------

/**
 * Prepares a single image for batch publication WITHOUT publishing anything.
 * Processes the file to base64 and generates the thumbnail in sequence
 * to bound memory usage. Returns all deterministic identifiers and payloads
 * needed for the batch request.
 *
 * @param {{ file: File, index: number, authorName: string }} params
 * @returns {Promise<{
 *   imageId: string,
 *   imageData64: string,
 *   imageResource: { service: string, name: string, identifier: string, filename: string },
 *   thumbId: string,
 *   thumbData64: string,
 *   thumbnailResource: { service: string, name: string, identifier: string, filename: string },
 * }>}
 */
const prepareImagePayload = async ({ file, index, authorName }) => {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Gallery images must be image files.');
  }

  const imageId = buildImageIdentifier(index);
  const thumbId = `${imageId}_thumb`;

  // Process files sequentially within this single-image preparation to limit
  // peak memory: read the full image, then render the thumbnail from the
  // already-loaded file (renderThumbnailBase64 reloads it internally via
  // loadImageFile, but that's acceptable — it's one file at a time).
  const imageData64 = await fileToBase64(file);
  const thumbData64 = await renderThumbnailBase64(file);

  return {
    imageId,
    imageData64,
    imageResource: {
      service: IMAGE_SERVICE,
      name: authorName,
      identifier: imageId,
      filename: file.name || '',
    },
    thumbId,
    thumbData64,
    thumbnailResource: {
      service: THUMBNAIL_SERVICE,
      name: authorName,
      identifier: thumbId,
      filename: file.name || '',
    },
  };
};

/**
 * Prepares a cover thumbnail payload for batch publication.
 * Returns null when no cover file is provided (caller will fall back to the
 * first image thumbnail).
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
  const coverData64 = await renderThumbnailBase64(file);

  return {
    coverId,
    coverData64,
    coverResource: {
      service: THUMBNAIL_SERVICE,
      name: authorName,
      identifier: coverId,
      filename: file.name || '',
    },
  };
};

const resolveGalleryUrls = async (gallery, includeImages = false) => {
  if (!gallery) return null;

  const coverUrl = gallery.coverUrl || (await resolveResourceUrl(gallery.coverResource));
  if (!includeImages) {
    return { ...gallery, coverUrl };
  }

  const images = await Promise.all(
    gallery.images.map(async (image) => ({
      ...image,
      src: image.src || (await resolveResourceUrl(image.imageResource)),
      thumbnailUrl: image.thumbnailUrl || (await resolveResourceUrl(image.thumbnailResource)),
    })),
  );

  return { ...gallery, coverUrl, images };
};

const fetchGalleryFromSummary = async (summary, includeImages = false) => {
  if (!isOwnerName(summary?.name)) return null;

  const resource = await requestQortium({
    action: 'FETCH_QDN_RESOURCE',
    service: GALLERY_SERVICE,
    name: summary.name,
    identifier: summary.identifier,
  });

  return resolveGalleryUrls(sanitizeGalleryPayload(resource ?? {}, summary), includeImages);
};

const fetchGallerySummaries = async ({ limit, offset, sortOrder }) =>
  requestQortium({
    action: 'SEARCH_QDN_RESOURCES',
    service: GALLERY_SERVICE,
    mode: 'ALL',
    identifier: GALLERY_METADATA_PREFIX,
    prefix: true,
    limit,
    offset,
    reverse: sortOrder === 'newest',
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
    exactMatchNames: false,
  });

export const fetchGalleryPage = async ({ page = 1, pageSize = 12, sortOrder = 'newest' }) => {
  const offset = Math.max(0, page - 1) * pageSize;
  const summaries = await fetchGallerySummaries({ limit: pageSize, offset, sortOrder });
  const items = Array.isArray(summaries) ? summaries : [];
  const galleries = [];

  for (const summary of items) {
    try {
      const gallery = await fetchGalleryFromSummary(summary, false);
      if (gallery) galleries.push(gallery);
    } catch (error) {
      console.error('Failed to fetch gallery metadata', summary?.identifier, error);
    }
  }

  return {
    galleries,
    hasNextPage: items.length === pageSize,
  };
};

export const fetchGalleryByIdentifier = async (identifier) => {
  const summaries = await requestQortium({
    action: 'SEARCH_QDN_RESOURCES',
    service: GALLERY_SERVICE,
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

  const ownerSummary = Array.isArray(summaries)
    ? summaries.find((summary) => summary.identifier === identifier && isOwnerName(summary.name))
    : null;
  if (!ownerSummary) return null;

  return fetchGalleryFromSummary(ownerSummary, true);
};

// ---------------------------------------------------------------------------
// Two-stage Gallery create
// ---------------------------------------------------------------------------
//
// Stage 1 — Child-resource batch (one PUBLISH_MULTIPLE_QDN_RESOURCES call):
//   All IMAGE resources + per-image THUMBNAIL resources + optional cover THUMBNAIL.
//   The parent DOCUMENT metadata is NOT included.
//
// Stage 2 — Parent metadata (conditional, PUBLISH_QDN_RESOURCE):
//   Only executed when Stage 1 succeeds completely (no failures, all expected
//   resources confirmed). The Gallery DOCUMENT parent is only published when
//   every child resource exists.
//
// Partial success in Stage 1 leaves orphaned child QDN resources but NO
// discoverable Gallery parent. Retry generates new identifiers (existing
// orphaned resources are harmless).

/**
 * Publishes a Gallery using the two-stage batch publication flow.
 *
 * Stage 1: PUBLISH_MULTIPLE_QDN_RESOURCES for all child (IMAGE + THUMBNAIL) resources.
 * Stage 2: PUBLISH_QDN_RESOURCE for the parent DOCUMENT metadata (conditional on Stage 1 success).
 *
 * @param {{ form: object, authorName: string, authorAddress: string, onProgress?: function }} params
 * @returns {Promise<object>} The sanitized gallery object
 */
export const publishGallery = async ({ form, authorName, authorAddress, onProgress }) => {
  if (!isOwnerProfile({ name: authorName, address: authorAddress })) {
    throw new Error('Only the site owner can publish galleries.');
  }

  const progress = (event) => {
    if (typeof onProgress === 'function') {
      onProgress(event);
    }
  };

  const now = Date.now();
  const galleryIdentifier = buildGalleryIdentifier({ title: form.title, authorName });
  const imageRows = form.images.slice(0, 10);

  // ---- Phase 1: Prepare all child payloads (no publishing yet) ----

  const imageCount = imageRows.length;
  const hasCover = Boolean(form.coverFile);
  // Total child resources: 2 per image (IMAGE + THUMBNAIL) + optional 1 cover THUMBNAIL
  const totalChildResources = imageCount * 2 + (hasCover ? 1 : 0);

  // Build initial resource list for progress tracking
  const resourceList = [];
  for (let i = 0; i < imageRows.length; i += 1) {
    const row = imageRows[i];
    const label = row.file?.name || `Image ${i + 1}`;
    resourceList.push({
      id: `IMAGE:${i}`,
      label: `Image ${i + 1} — ${label}`,
      service: IMAGE_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
    resourceList.push({
      id: `THUMBNAIL:${i}`,
      label: `Thumbnail ${i + 1} — ${label}`,
      service: THUMBNAIL_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
  }
  if (hasCover) {
    resourceList.push({
      id: 'COVER:0',
      label: `Cover — ${form.coverFile?.name || 'cover'}`,
      service: THUMBNAIL_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
  }

  progress({
    phase: 'preparing',
    current: 0,
    total: totalChildResources,
    resources: resourceList,
    message: `Preparing Gallery media…`,
  });

  const preparedImages = [];
  let preparedCount = 0;

  for (let index = 0; index < imageRows.length; index += 1) {
    const row = imageRows[index];
    const imageResourceId = `IMAGE:${index}`;
    const thumbResourceId = `THUMBNAIL:${index}`;

    // Emit: preparing IMAGE
    progress({
      phase: 'preparing',
      current: preparedCount,
      total: totalChildResources,
      resource: {
        id: imageResourceId,
        status: 'preparing',
        label: `Image ${index + 1} — ${row.file?.name || 'image'}`,
      },
    });

    try {
      const prepared = await prepareImagePayload({
        file: row.file,
        index,
        authorName: OWNER_QORTIUM_NAME,
      });

      preparedCount += 1;

      // Emit: IMAGE prepared
      progress({
        phase: 'preparing',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: imageResourceId,
          status: 'prepared',
          identifier: prepared.imageId,
          label: `Image ${index + 1} — ${row.file?.name || 'image'}`,
        },
      });

      // Emit: preparing THUMBNAIL
      progress({
        phase: 'preparing',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: thumbResourceId,
          status: 'preparing',
          label: `Thumbnail ${index + 1} — ${row.file?.name || 'image'}`,
        },
      });

      preparedCount += 1;

      // Emit: THUMBNAIL prepared
      progress({
        phase: 'preparing',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: thumbResourceId,
          status: 'prepared',
          identifier: prepared.thumbId,
          label: `Thumbnail ${index + 1} — ${row.file?.name || 'image'}`,
        },
      });

      preparedImages.push({ prepared, description: row.description || '', order: index });
    } catch (error) {
      // Preparation failure: nothing has been published yet.
      progress({
        phase: 'failed',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: imageResourceId,
          status: 'failed',
          error: error?.message || 'unknown error',
        },
        message: `Image preparation failed.\n\nFile: ${row.file?.name || `image ${index + 1}`}\nReason: ${error?.message || 'unknown error'}\n\nNo QDN resources were submitted.`,
      });
      throw new Error(
        `Unable to prepare image ${index + 1} for publishing: ${error?.message || 'unknown error'}`,
      );
    }
  }

  // Prepare cover payload (nullable — falls back to first image thumbnail)
  let preparedCover = null;

  if (hasCover) {
    progress({
      phase: 'preparing',
      current: preparedCount,
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
        identifier: galleryIdentifier,
        authorName: OWNER_QORTIUM_NAME,
      });

      preparedCount += 1;

      progress({
        phase: 'preparing',
        current: preparedCount,
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
        current: preparedCount,
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

  // Note: preparation phase includes image-to-base64 conversion AND thumbnail generation
  // per image, all done in the prepareImagePayload call above. Our counting reflects that.

  // ---- Phase 2: Build the child-resource batch array ----
  // (No progress to emit — this is synchronous construction)

  const batchResources = [];
  const expectedKeys = new Set();

  // Order: IMAGE 1 → THUMBNAIL 1 → IMAGE 2 → THUMBNAIL 2 → ... → cover
  for (const { prepared } of preparedImages) {
    // IMAGE resource
    batchResources.push({
      service: IMAGE_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: prepared.imageId,
      data64: prepared.imageData64,
      encoding: 'base64',
      filename: prepared.imageResource.filename,
      title: form.title || 'Gallery image',
      description: `Image for ${form.title || 'gallery'}`.slice(0, 4000),
    });
    expectedKeys.add(buildResourceKey(prepared.imageResource));

    // Per-image THUMBNAIL resource
    batchResources.push({
      service: THUMBNAIL_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: prepared.thumbId,
      data64: prepared.thumbData64,
      encoding: 'base64',
      title: form.title || 'Gallery thumbnail',
      description: `Thumbnail for ${form.title || 'gallery image'}`.slice(0, 4000),
    });
    expectedKeys.add(buildResourceKey(prepared.thumbnailResource));
  }

  // Cover thumbnail
  if (preparedCover) {
    batchResources.push({
      service: THUMBNAIL_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: preparedCover.coverId,
      data64: preparedCover.coverData64,
      encoding: 'base64',
      title: form.title || 'Gallery cover',
      description: `Cover thumbnail for ${form.title || 'gallery'}`.slice(0, 4000),
    });
    expectedKeys.add(buildResourceKey(preparedCover.coverResource));
  }

  // ---- Stage 1: Publish child-resource batch ----

  // Emit: waiting for Home approval (the batch call will trigger the approval window)
  progress({
    phase: 'waiting-for-media-approval',
    current: totalChildResources,
    total: totalChildResources,
    message: `Waiting for Qortium approval…\n\nApprove the media publication in the Qortium Home window.`,
  });

  let batchResult;

  try {
    batchResult = await publishMultipleQdnResources(batchResources);
  } catch (error) {
    progress({
      phase: 'failed',
      message: `Media publication failed: ${error?.message || 'unknown error'}`,
      error: error?.message || 'unknown error',
    });
    throw error;
  }

  // If the bridge result indicates cancellation (accepted === false with no published data)
  if (!batchResult.accepted && batchResult.published.length === 0) {
    progress({
      phase: 'failed',
      message: 'Media publication was cancelled.\n\nThe Gallery was not created.',
    });
    throw new Error('Media publication was cancelled. The Gallery was not created.');
  }

  // Emit: publishing media (indeterminate)
  progress({
    phase: 'publishing-media',
    message: `Publishing ${batchResources.length} media resources through Qortium Home…`,
  });

  // Emit: validating media
  progress({
    phase: 'validating-media',
    message: 'Checking publication results…',
  });

  // Validate the batch result before considering Stage 2
  const validationError = validateBatchResult(
    batchResult.published,
    batchResult.failures,
    expectedKeys,
  );

  if (validationError) {
    const successCount = batchResult.published.length;
    const failureCount = batchResult.failures.length;

    // Map results to resource rows
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
    for (let i = 0; i < imageRows.length; i += 1) {
      const prepared = preparedImages[i]?.prepared;
      const imageId = prepared?.imageId;
      const thumbId = prepared?.thumbId;

      resultResources.push({
        id: `IMAGE:${i}`,
        identifier: imageId || '',
        status: publishedIds.has(imageId) ? 'published' : 'failed',
        error: failureEntries.get(imageId) || (publishedIds.has(imageId) ? '' : 'Resource not found in batch result'),
      });
      resultResources.push({
        id: `THUMBNAIL:${i}`,
        identifier: thumbId || '',
        status: publishedIds.has(thumbId) ? 'published' : 'failed',
        error: failureEntries.get(thumbId) || (publishedIds.has(thumbId) ? '' : 'Resource not found in batch result'),
      });
    }
    if (preparedCover) {
      resultResources.push({
        id: 'COVER:0',
        identifier: preparedCover.coverId,
        status: publishedIds.has(preparedCover.coverId) ? 'published' : 'failed',
        error: failureEntries.get(preparedCover.coverId) || (publishedIds.has(preparedCover.coverId) ? '' : 'Resource not found in batch result'),
      });
    }

    progress({
      phase: 'failed',
      message: `Some Gallery media resources could not be published.\n\n${successCount} succeeded\n${failureCount} failed\n\nThe Gallery itself was not created.`,
      resources: resultResources,
    });

    throw new Error(
      `Some Gallery resources could not be published. ` +
        `${successCount} succeeded, ${failureCount} failed. ` +
        `The Gallery itself was not created. You can retry safely. ` +
        `(${validationError.detail})`,
    );
  }

  // Mark all child resources as published in progress
  const allPublishedResources = [];
  for (let i = 0; i < imageRows.length; i += 1) {
    allPublishedResources.push({
      id: `IMAGE:${i}`,
      status: 'published',
      error: '',
    });
    allPublishedResources.push({
      id: `THUMBNAIL:${i}`,
      status: 'published',
      error: '',
    });
  }
  if (preparedCover) {
    allPublishedResources.push({
      id: 'COVER:0',
      status: 'published',
      error: '',
    });
  }

  // ---- Phase 3: Resolve resource URLs from published entries ----

  // Map published entries by identifier for quick lookup
  const publishedByIdentifier = new Map();
  for (const entry of batchResult.published) {
    const identifier = entry.resource?.identifier;
    if (identifier) {
      publishedByIdentifier.set(identifier, entry);
    }
  }

  // Build image objects with resolved URLs
  const images = [];

  for (const { prepared, description, order } of preparedImages) {
    const imageResourceRef = prepared.imageResource;
    const thumbnailResourceRef = prepared.thumbnailResource;

    images.push({
      id: prepared.imageId,
      title: '',
      description,
      imageResource: imageResourceRef,
      thumbnailResource: thumbnailResourceRef,
      src: await resolveResourceUrl(imageResourceRef),
      thumbnailUrl: await resolveResourceUrl(thumbnailResourceRef),
      order,
      created: now,
    });
  }

  // Resolve cover resource
  let coverResource = null;
  let coverUrl = '';

  if (preparedCover) {
    coverResource = preparedCover.coverResource;
    coverUrl = await resolveResourceUrl(coverResource);
  } else if (images[0]?.thumbnailResource) {
    coverResource = images[0].thumbnailResource;
    coverUrl = images[0].thumbnailUrl || (await resolveResourceUrl(coverResource));
  }

  // ---- Phase 4: Build and validate Gallery metadata ----

  const gallery = sanitizeGalleryPayload({
    id: galleryIdentifier,
    identifier: galleryIdentifier,
    title: form.title,
    descriptionHtml: form.descriptionHtml,
    descriptionText: toPlainText(form.descriptionHtml),
    coverResource,
    coverUrl,
    images,
    authorName,
    authorAddress,
    created: now,
    updated: now,
  });

  if (!gallery) {
    // Should not happen with valid inputs, but guard anyway.
    // Child resources are already published — this is an orphan scenario.
    throw new Error(
      'Gallery media was published but the Gallery record could not be prepared. ' +
        'Please try again.',
    );
  }

  // ---- Stage 2: Publish parent DOCUMENT metadata ----

  // Emit: Stage 1 complete, waiting for metadata approval
  progress({
    phase: 'waiting-for-metadata-approval',
    resources: allPublishedResources,
    message: `Gallery media published successfully.\n\nApprove the final Gallery information publication in Qortium Home.`,
  });

  try {
    // Emit: publishing metadata
    progress({
      phase: 'publishing-metadata',
      message: `Saving Gallery information…`,
    });

    await publishGalleryMetadata({ gallery, authorName: OWNER_QORTIUM_NAME });
  } catch (error) {
    // Check if this was a cancellation
    const errorMsg = error?.message || 'unknown error';
    if (errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
      progress({
        phase: 'failed',
        message: `Gallery information publication was cancelled.\n\nThe media resources may already exist on QDN, but the Gallery is not visible.`,
      });
      throw new Error(
        `Gallery information publication was cancelled. The media resources may already exist on QDN, but the Gallery is not visible.`,
      );
    }

    progress({
      phase: 'failed',
      message: `Gallery media was published, but the Gallery information could not be saved.\n\nThe Gallery is not visible in the listing.\nYou may retry.`,
    });
    throw new Error(
      `Gallery media was published successfully, but the Gallery record could not be saved: ` +
        `${errorMsg}. Please try publishing again.`,
    );
  }

  // ---- Complete ----

  progress({
    phase: 'complete',
    message: `Gallery published successfully.\n\n${images.length} image${images.length !== 1 ? 's' : ''}  ·  ${form.title || 'Untitled'}`,
    resources: allPublishedResources,
  });

  return gallery;
};

// ---------------------------------------------------------------------------
// Gallery edit — two-stage batch publication (Feature 21)
// ---------------------------------------------------------------------------
//
// ALL new IMAGE and THUMBNAIL resources are published via a single
// PUBLISH_MULTIPLE_QDN_RESOURCES batch call. Individual PUBLISH_QDN_RESOURCE
// calls for IMAGE/THUMBNAIL are PROHIBITED in this function.
//
// The old publishImage() and publishThumbnail() helpers have been removed.
// prepareImagePayload() and prepareCoverPayload() are PURE preparation
// functions — they perform NO bridge requests.
//
// Stage 1: PUBLISH_MULTIPLE_QDN_RESOURCES (all new child resources)
// Stage 2: PUBLISH_QDN_RESOURCE (parent DOCUMENT, gated on Stage 1 success)
//
// Metadata-only edits skip Stage 1 entirely.
// ---------------------------------------------------------------------------
export const updateGallery = async ({ gallery, form, authorName, authorAddress, onProgress }) => {
  if (!isOwnerProfile({ name: authorName, address: authorAddress })) {
    throw new Error('Only the site owner can edit galleries.');
  }

  console.debug('[Gallery QDN publish] updateGallery called — mode: edit, hasNewImages:', (form.images || []).length, 'hasNewCover:', Boolean(form.coverFile));

  const progress = (event) => {
    if (typeof onProgress === 'function') {
      onProgress(event);
    }
  };

  const now = Date.now();
  const existingImages = (form.existingImages || []).map((image, index) => ({
    ...image,
    title: image.title || '',
    description: image.description || '',
    order: index,
  }));
  const newImageRows = (form.images || []).slice(0, Math.max(0, 10 - existingImages.length));
  const hasNewCover = Boolean(form.coverFile);
  const hasNewImages = newImageRows.length > 0;
  const isMetadataOnly = !hasNewImages && !hasNewCover;

  // -----------------------------------------------------------------------
  // Case A / E: Metadata-only edit
  // -----------------------------------------------------------------------
  if (isMetadataOnly) {
    progress({
      phase: 'preparing',
      current: 0,
      total: 0,
      resources: [],
      message: 'Preparing Gallery information…',
      stage1Complete: true, // No media stage needed for metadata-only edit
    });

    // Resolve cover: preserve existing or fall back to first image thumbnail
    let coverResource = gallery.coverResource || null;
    let coverUrl = gallery.coverUrl || '';

    if (!coverResource && existingImages[0]?.thumbnailResource) {
      coverResource = existingImages[0].thumbnailResource;
    }

    const images = existingImages.map((image, index) => ({
      ...image,
      order: index,
    }));

    progress({
      phase: 'waiting-for-metadata-approval',
      message: 'Waiting for Qortium approval…\n\nApprove the Gallery information update in the Qortium Home window.',
      stage1Complete: true, // No media stage — already complete
    });

    const updatedGallery = sanitizeGalleryPayload({
      ...gallery,
      title: form.title,
      descriptionHtml: form.descriptionHtml,
      descriptionText: toPlainText(form.descriptionHtml),
      coverResource,
      coverUrl,
      images,
      updated: now,
    });

    if (!updatedGallery) {
      throw new Error('Gallery information could not be prepared for update.');
    }

    progress({
      phase: 'publishing-metadata',
      message: 'Saving Gallery information…',
    });

    console.debug('[Gallery QDN publish]', {
      mode: 'edit',
      action: 'PUBLISH_QDN_RESOURCE',
      service: GALLERY_SERVICE,
      identifier: updatedGallery.identifier,
      resourceCount: 1,
      path: 'metadata-only',
    });

    try {
      await publishGalleryMetadata({ gallery: updatedGallery, authorName: OWNER_QORTIUM_NAME });
    } catch (error) {
      const errorMsg = error?.message || 'unknown error';
      if (errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
        progress({
          phase: 'failed',
          message: 'Gallery information update was cancelled.\n\nThe Gallery remains unchanged.',
        });
        throw new Error('Gallery information update was cancelled. The Gallery remains unchanged.');
      }

      progress({
        phase: 'failed',
        message: `Gallery information could not be saved: ${errorMsg}`,
      });
      throw error;
    }

    progress({
      phase: 'complete',
      message: `Gallery updated successfully.\n\n${images.length} image${images.length !== 1 ? 's' : ''}  ·  ${form.title || gallery.title || 'Untitled'}`,
      resources: [],
    });

    return updatedGallery;
  }

  // -----------------------------------------------------------------------
  // Cases B / C / D: New child resources exist — two-stage batch
  // -----------------------------------------------------------------------

  // ---- Phase 1: Prepare all new child payloads ----

  const totalChildResources = newImageRows.length * 2 + (hasNewCover ? 1 : 0);

  // Build initial resource list for progress tracking (new resources only)
  const resourceList = [];
  for (let i = 0; i < newImageRows.length; i += 1) {
    const row = newImageRows[i];
    const label = row.file?.name || `New image ${i + 1}`;
    resourceList.push({
      id: `IMAGE:${i}`,
      label: `Image ${i + 1} — ${label}`,
      service: IMAGE_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
    resourceList.push({
      id: `THUMBNAIL:${i}`,
      label: `Thumbnail ${i + 1} — ${label}`,
      service: THUMBNAIL_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
  }
  if (hasNewCover) {
    resourceList.push({
      id: 'COVER:0',
      label: `Cover — ${form.coverFile?.name || 'cover'}`,
      service: THUMBNAIL_SERVICE,
      identifier: '',
      status: 'queued',
      error: '',
    });
  }

  const preservedCount = existingImages.length;
  progress({
    phase: 'preparing',
    current: 0,
    total: totalChildResources,
    resources: resourceList,
    message: `Preparing new Gallery media…${preservedCount > 0 ? `\n\n${preservedCount} existing image${preservedCount !== 1 ? 's' : ''} preserved` : ''}`,
  });

  const preparedImages = [];
  let preparedCount = 0;

  for (let index = 0; index < newImageRows.length; index += 1) {
    const row = newImageRows[index];
    const imageResourceId = `IMAGE:${index}`;
    const thumbResourceId = `THUMBNAIL:${index}`;

    progress({
      phase: 'preparing',
      current: preparedCount,
      total: totalChildResources,
      resource: {
        id: imageResourceId,
        status: 'preparing',
        label: `Image ${index + 1} — ${row.file?.name || 'image'}`,
      },
    });

    try {
      const prepared = await prepareImagePayload({
        file: row.file,
        index,
        authorName: OWNER_QORTIUM_NAME,
      });

      preparedCount += 1;

      progress({
        phase: 'preparing',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: imageResourceId,
          status: 'prepared',
          identifier: prepared.imageId,
          label: `Image ${index + 1} — ${row.file?.name || 'image'}`,
        },
      });

      progress({
        phase: 'preparing',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: thumbResourceId,
          status: 'preparing',
          label: `Thumbnail ${index + 1} — ${row.file?.name || 'image'}`,
        },
      });

      preparedCount += 1;

      progress({
        phase: 'preparing',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: thumbResourceId,
          status: 'prepared',
          identifier: prepared.thumbId,
          label: `Thumbnail ${index + 1} — ${row.file?.name || 'image'}`,
        },
      });

      preparedImages.push({
        prepared,
        title: row.title || '',
        description: row.description || '',
        order: existingImages.length + index,
      });
    } catch (error) {
      progress({
        phase: 'failed',
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: imageResourceId,
          status: 'failed',
          error: error?.message || 'unknown error',
        },
        message: `Image preparation failed.\n\nFile: ${row.file?.name || `image ${index + 1}`}\nReason: ${error?.message || 'unknown error'}\n\nNo QDN resources were submitted. The Gallery remains unchanged.`,
      });
      throw new Error(
        `Unable to prepare image ${index + 1} for publishing: ${error?.message || 'unknown error'}`,
      );
    }
  }

  // Prepare new cover payload
  let preparedCover = null;

  if (hasNewCover) {
    progress({
      phase: 'preparing',
      current: preparedCount,
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
        identifier: gallery.identifier,
        authorName: OWNER_QORTIUM_NAME,
      });

      preparedCount += 1;

      progress({
        phase: 'preparing',
        current: preparedCount,
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
        current: preparedCount,
        total: totalChildResources,
        resource: {
          id: 'COVER:0',
          status: 'failed',
          error: error?.message || 'unknown error',
        },
        message: `Cover preparation failed.\n\nFile: ${form.coverFile?.name || 'cover'}\nReason: ${error?.message || 'unknown error'}\n\nNo QDN resources were submitted. The Gallery remains unchanged.`,
      });
      throw new Error(
        `Unable to prepare cover image for publishing: ${error?.message || 'unknown error'}`,
      );
    }
  }

  // ---- Phase 2: Build the child-resource batch array ----

  const batchResources = [];
  const expectedKeys = new Set();

  for (const { prepared } of preparedImages) {
    batchResources.push({
      service: IMAGE_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: prepared.imageId,
      data64: prepared.imageData64,
      encoding: 'base64',
      filename: prepared.imageResource.filename,
      title: form.title || gallery.title || 'Gallery image',
      description: `Image for ${form.title || gallery.title || 'gallery'}`.slice(0, 4000),
    });
    expectedKeys.add(buildResourceKey(prepared.imageResource));

    batchResources.push({
      service: THUMBNAIL_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: prepared.thumbId,
      data64: prepared.thumbData64,
      encoding: 'base64',
      title: form.title || gallery.title || 'Gallery thumbnail',
      description: `Thumbnail for ${form.title || gallery.title || 'gallery image'}`.slice(0, 4000),
    });
    expectedKeys.add(buildResourceKey(prepared.thumbnailResource));
  }

  if (preparedCover) {
    batchResources.push({
      service: THUMBNAIL_SERVICE,
      name: OWNER_QORTIUM_NAME,
      identifier: preparedCover.coverId,
      data64: preparedCover.coverData64,
      encoding: 'base64',
      title: form.title || gallery.title || 'Gallery cover',
      description: `Cover thumbnail for ${form.title || gallery.title || 'gallery'}`.slice(0, 4000),
    });
    expectedKeys.add(buildResourceKey(preparedCover.coverResource));
  }

  // ---- Stage 1: Publish child-resource batch ----

  console.debug('[Gallery QDN publish]', {
    mode: 'edit',
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resourceCount: batchResources.length,
    services: batchResources.map((r) => r.service),
  });

  progress({
    phase: 'waiting-for-media-approval',
    current: totalChildResources,
    total: totalChildResources,
    message: `Waiting for Qortium approval…\n\nApprove the media publication in the Qortium Home window.`,
  });

  let batchResult;

  try {
    batchResult = await publishMultipleQdnResources(batchResources);
  } catch (error) {
    progress({
      phase: 'failed',
      message: `Media publication failed: ${error?.message || 'unknown error'}\n\nThe Gallery remains unchanged.`,
      error: error?.message || 'unknown error',
    });
    throw error;
  }

  // Cancellation detection
  if (!batchResult.accepted && batchResult.published.length === 0) {
    progress({
      phase: 'failed',
      message: 'Media publication was cancelled.\n\nThe Gallery remains unchanged.',
    });
    throw new Error('Media publication was cancelled. The Gallery remains unchanged.');
  }

  // Indeterminate publishing phase
  progress({
    phase: 'publishing-media',
    message: `Publishing ${batchResources.length} new media resources through Qortium Home…`,
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
    for (let i = 0; i < newImageRows.length; i += 1) {
      const prep = preparedImages[i]?.prepared;
      const imageId = prep?.imageId;
      const thumbId = prep?.thumbId;
      resultResources.push({
        id: `IMAGE:${i}`,
        identifier: imageId || '',
        status: publishedIds.has(imageId) ? 'published' : 'failed',
        error: failureEntries.get(imageId) || (publishedIds.has(imageId) ? '' : 'Resource not found in batch result'),
      });
      resultResources.push({
        id: `THUMBNAIL:${i}`,
        identifier: thumbId || '',
        status: publishedIds.has(thumbId) ? 'published' : 'failed',
        error: failureEntries.get(thumbId) || (publishedIds.has(thumbId) ? '' : 'Resource not found in batch result'),
      });
    }
    if (preparedCover) {
      resultResources.push({
        id: 'COVER:0',
        identifier: preparedCover.coverId,
        status: publishedIds.has(preparedCover.coverId) ? 'published' : 'failed',
        error: failureEntries.get(preparedCover.coverId) || (publishedIds.has(preparedCover.coverId) ? '' : 'Resource not found in batch result'),
      });
    }

    progress({
      phase: 'failed',
      message: `Some new Gallery media could not be published.\n\n${successCount} succeeded\n${failureCount} failed\n\nThe Gallery remains unchanged in its previous state.`,
      resources: resultResources,
    });

    throw new Error(
      `Some Gallery resources could not be published. ` +
        `${successCount} succeeded, ${failureCount} failed. ` +
        `The Gallery remains unchanged. You can retry safely. ` +
        `(${validationError.detail})`,
    );
  }

  // Mark all new child resources as published
  const allPublishedResources = [];
  for (let i = 0; i < newImageRows.length; i += 1) {
    allPublishedResources.push({ id: `IMAGE:${i}`, status: 'published', error: '' });
    allPublishedResources.push({ id: `THUMBNAIL:${i}`, status: 'published', error: '' });
  }
  if (preparedCover) {
    allPublishedResources.push({ id: 'COVER:0', status: 'published', error: '' });
  }

  // ---- Phase 3: Build updated image array with resolved URLs ----

  // Resolve URLs for newly published images
  const newImageObjects = [];

  for (const { prepared, title, description, order } of preparedImages) {
    const imageResourceRef = prepared.imageResource;
    const thumbnailResourceRef = prepared.thumbnailResource;

    newImageObjects.push({
      id: prepared.imageId,
      title,
      description,
      imageResource: imageResourceRef,
      thumbnailResource: thumbnailResourceRef,
      src: await resolveResourceUrl(imageResourceRef),
      thumbnailUrl: await resolveResourceUrl(thumbnailResourceRef),
      order,
      created: now,
    });
  }

  // Merge existing and new images, re-sort by order
  const images = [...existingImages, ...newImageObjects]
    .map((image, index) => ({
      ...image,
      order: index,
    }));

  // ---- Phase 4: Resolve cover ----
  let coverResource = null;
  let coverUrl = '';

  if (preparedCover) {
    coverResource = preparedCover.coverResource;
    coverUrl = await resolveResourceUrl(coverResource);
  } else {
    // Preserve existing cover or fall back to first image thumbnail
    coverResource = gallery.coverResource || null;
    coverUrl = gallery.coverUrl || '';

    if (!coverResource && images[0]?.thumbnailResource) {
      coverResource = images[0].thumbnailResource;
      coverUrl = images[0].thumbnailUrl || (await resolveResourceUrl(coverResource));
    }
  }

  // ---- Phase 5: Build and validate updated Gallery metadata ----

  const updatedGallery = sanitizeGalleryPayload({
    ...gallery,
    title: form.title,
    descriptionHtml: form.descriptionHtml,
    descriptionText: toPlainText(form.descriptionHtml),
    coverResource,
    coverUrl,
    images,
    updated: now,
  });

  if (!updatedGallery) {
    throw new Error(
      'New Gallery media was published but the Gallery information could not be prepared. ' +
        'Please try again.',
    );
  }

  // ---- Stage 2: Publish updated parent DOCUMENT metadata ----

  progress({
    phase: 'waiting-for-metadata-approval',
    resources: allPublishedResources,
    message: `New Gallery media published successfully.\n\nApprove the Gallery information update in Qortium Home.`,
  });

  try {
    progress({
      phase: 'publishing-metadata',
      message: `Saving Gallery information…`,
    });

    console.debug('[Gallery QDN publish]', {
      mode: 'edit',
      action: 'PUBLISH_QDN_RESOURCE',
      service: GALLERY_SERVICE,
      identifier: updatedGallery.identifier,
      resourceCount: 1,
      path: 'new-media',
    });

    await publishGalleryMetadata({ gallery: updatedGallery, authorName: OWNER_QORTIUM_NAME });
  } catch (error) {
    const errorMsg = error?.message || 'unknown error';
    if (errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
      progress({
        phase: 'failed',
        message: `Gallery information update was cancelled.\n\nNew media may have been published, but the Gallery update was not saved.`,
      });
      throw new Error(
        `Gallery information update was cancelled. New media may have been published, but the Gallery update was not saved.`,
      );
    }

    progress({
      phase: 'failed',
      message: `New media was published, but the Gallery information could not be saved.\n\nNew media may have been published, but the Gallery update was not saved.`,
    });
    throw new Error(
      `New Gallery media was published successfully, but the Gallery record could not be updated: ` +
        `${errorMsg}. Please try publishing again.`,
    );
  }

  // ---- Complete ----

  const totalFinalImages = images.length;
  progress({
    phase: 'complete',
    message: `Gallery updated successfully.\n\n${totalFinalImages} image${totalFinalImages !== 1 ? 's' : ''}  ·  ${form.title || gallery.title || 'Untitled'}`,
    resources: allPublishedResources,
  });

  return updatedGallery;
};

export const scanAllGalleryIdentifiers = async () => {
  const identifiers = [];
  let offset = 0;

  while (true) {
    const summaries = await fetchGallerySummaries({
      limit: PAGE_SIZE_SCAN,
      offset,
      sortOrder: 'newest',
    });
    const items = Array.isArray(summaries) ? summaries : [];
    if (!items.length) break;
    identifiers.push(...items.map((item) => item.identifier).filter(Boolean));
    if (items.length < PAGE_SIZE_SCAN) break;
    offset += items.length;
  }

  return identifiers;
};

export const deleteGallery = async ({ identifier, authorName, authorAddress }) => {
  if (!isOwnerProfile({ name: authorName, address: authorAddress })) {
    throw new Error('Only the site owner can delete galleries.');
  }

  if (!identifier || typeof identifier !== 'string') {
    throw new Error('A valid gallery identifier is required.');
  }

  const result = await requestQortium({
    action: 'DELETE_QDN_RESOURCE',
    name: OWNER_QORTIUM_NAME,
    service: GALLERY_SERVICE,
    identifier,
  });

  if (!result?.accepted) {
    throw new Error('Gallery deletion was not accepted by QDN.');
  }

  return { deleted: true, identifier };
};
