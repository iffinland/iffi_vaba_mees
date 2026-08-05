// ── Ported from Blogs project — media service (image/video/file upload) ──

import { requestQortium } from '../qortium/qortiumClient';
import { fileToBase64 } from '../qdn/encoding';
import {
  createMediaId,
  toFileIdentifier,
  toImageIdentifier,
  toVideoIdentifier,
} from '../qdn/identifiers';
import { waitForResourceReady } from '../qdn/qdnService';

export const MEDIA_LIMITS = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  video: {
    maxBytes: 100 * 1024 * 1024,
    acceptedTypes: ['video/mp4', 'video/webm', 'video/ogg'],
  },
  file: {
    maxBytes: 25 * 1024 * 1024,
  },
};

const assertFileSize = (file, maxBytes, label) => {
  if (file.size > maxBytes) {
    throw new Error(`${label} is too large. Maximum allowed size is ${formatBytes(maxBytes)}.`);
  }
};

const assertMimeType = (file, acceptedTypes, label) => {
  if (!acceptedTypes.includes(file.type)) {
    throw new Error(`${label} type is not supported.`);
  }
};

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const publishFileResource = async ({
  file,
  ownerName,
  service,
  identifier,
  title,
}) => {
  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    service,
    name: ownerName,
    identifier,
    filename: file.name,
    data64: await fileToBase64(file),
    title,
    description: `${file.type || 'application/octet-stream'} - ${formatBytes(file.size)}`,
  });

  await waitForResourceReady(service, ownerName, identifier);

  return {
    service,
    name: ownerName,
    identifier,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };
};

const createPendingMedia = (type, file, ownerName, service, identifier) => {
  const ref = {
    service,
    name: ownerName,
    identifier,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };

  return {
    type,
    file,
    ref,
    resource: {
      service,
      name: ownerName,
      identifier,
      filename: file.name,
      file,
      title: file.name,
      description: `${file.type || 'application/octet-stream'} - ${formatBytes(file.size)}`,
    },
  };
};

export const prepareBlogMedia = (file, ownerName, type) => {
  if (type === 'image') {
    assertMimeType(file, MEDIA_LIMITS.image.acceptedTypes, 'Image');
    assertFileSize(file, MEDIA_LIMITS.image.maxBytes, 'Image');
    return createPendingMedia(type, file, ownerName, 'IMAGE', toImageIdentifier(createMediaId()));
  }

  if (type === 'video') {
    assertMimeType(file, MEDIA_LIMITS.video.acceptedTypes, 'Video');
    assertFileSize(file, MEDIA_LIMITS.video.maxBytes, 'Video');
    return createPendingMedia(type, file, ownerName, 'VIDEO', toVideoIdentifier(createMediaId()));
  }

  assertFileSize(file, MEDIA_LIMITS.file.maxBytes, 'Attachment');
  return createPendingMedia(type, file, ownerName, 'FILE', toFileIdentifier(createMediaId()));
};

export const publishBlogImage = async (file, ownerName) => {
  assertMimeType(file, MEDIA_LIMITS.image.acceptedTypes, 'Image');
  assertFileSize(file, MEDIA_LIMITS.image.maxBytes, 'Image');
  return publishFileResource({
    file,
    ownerName,
    service: 'IMAGE',
    identifier: toImageIdentifier(createMediaId()),
    title: file.name,
  });
};

export const publishBlogVideo = async (file, ownerName) => {
  assertMimeType(file, MEDIA_LIMITS.video.acceptedTypes, 'Video');
  assertFileSize(file, MEDIA_LIMITS.video.maxBytes, 'Video');
  return publishFileResource({
    file,
    ownerName,
    service: 'VIDEO',
    identifier: toVideoIdentifier(createMediaId()),
    title: file.name,
  });
};

export const publishBlogAttachment = async (file, ownerName) => {
  assertFileSize(file, MEDIA_LIMITS.file.maxBytes, 'Attachment');
  return publishFileResource({
    file,
    ownerName,
    service: 'FILE',
    identifier: toFileIdentifier(createMediaId()),
    title: file.name,
  });
};
