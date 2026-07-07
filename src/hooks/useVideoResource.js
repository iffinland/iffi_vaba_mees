import { useEffect, useMemo, useState } from 'react';
import {
  getQdnResourceUrl,
  isQdnResourceReady,
  waitForQdnResourceReady,
} from '../services/qdnResourceService';
import { requestQortium } from '../services/qortium/qortiumClient';

const directVideoExtensionPattern = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const qdnVideoLinkPattern = /qdn:\/\/VIDEO\/([^"'<>\s]+)\/([^"'<>\s]+)/i;

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const decodePathPart = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractEmbeddedSource = (value) => {
  const input = trimString(value);
  if (!input) return '';

  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/gi;
  const matches = Array.from(input.matchAll(attributePattern)).map((match) => match[1]);
  const preferred = matches.find((match) =>
    /^\/arbitrary\/VIDEO\//i.test(match) ||
    /^qdn:\/\/VIDEO\//i.test(match) ||
    directVideoExtensionPattern.test(match),
  );

  if (preferred) return preferred;

  const qdnVideoMatch = input.match(qdnVideoLinkPattern);
  if (qdnVideoMatch) return qdnVideoMatch[0];

  return input;
};

const toUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost';
      return new URL(value, baseUrl);
    } catch {
      return null;
    }
  }
};

const buildArbitraryPath = ({ service, name, identifier }) =>
  `/arbitrary/${encodeURIComponent(service)}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;

const toDirectVideoSource = (resource, directUrl = '') => ({
  type: 'direct',
  resource,
  directUrl: directUrl || buildArbitraryPath(resource),
});

const toDirectVideoCandidate = (resource) => ({
  directUrl: buildArbitraryPath(resource),
  resource,
});

const parseQortiumVideoLink = (sourceUrl) => {
  const value = extractEmbeddedSource(sourceUrl);
  if (!value) return null;

  const rawQdnVideoMatch = value.match(qdnVideoLinkPattern);
  if (rawQdnVideoMatch) {
    const name = decodePathPart(rawQdnVideoMatch[1]);
    const identifier = decodePathPart(rawQdnVideoMatch[2]);
    if (name && identifier) {
      const resource = { service: 'VIDEO', name, identifier };
      return toDirectVideoSource(resource);
    }
  }

  const url = toUrl(value);
  if (!url) return null;

  if (url.protocol === 'qdn:' && url.hostname.toUpperCase() === 'VIDEO') {
    const [name, identifier] = url.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));

    if (name && identifier) {
      const resource = { service: 'VIDEO', name, identifier };
      return toDirectVideoSource(resource);
    }
  }

  const pathParts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  const arbitraryIndex = pathParts.findIndex((part) => part.toLowerCase() === 'arbitrary');
  const service = pathParts[arbitraryIndex + 1];
  const name = pathParts[arbitraryIndex + 2];
  const identifier = pathParts[arbitraryIndex + 3];

  if (arbitraryIndex >= 0 && service?.toUpperCase() === 'VIDEO' && name && identifier) {
    const resource = { service: 'VIDEO', name, identifier };
    return toDirectVideoSource(resource, buildArbitraryPath(resource));
  }

  return null;
};

const getVideoSource = (video) => {
  if (video?.qdnVideo?.name && video?.qdnVideo?.identifier) {
    return {
      type: 'direct',
      resource: {
        service: video.qdnVideo.service || 'VIDEO',
        name: video.qdnVideo.name,
        identifier: video.qdnVideo.identifier,
      },
    };
  }

  return parseQortiumVideoLink(video?.sourceUrl);
};

const parseFetchedJson = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return parseFetchedJson(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object') return null;
  return value;
};

const normalizeVideoResource = (value, fallbackName) => {
  if (!value || typeof value !== 'object') return null;

  const service = typeof value.service === 'string' ? value.service.toUpperCase() : '';
  const name =
    typeof value.name === 'string' && value.name.trim() ? value.name.trim() : fallbackName;
  const identifier =
    typeof value.identifier === 'string' && value.identifier.trim()
      ? value.identifier.trim()
      : '';

  if (service === 'VIDEO' && name && identifier) {
    return { service: 'VIDEO', name, identifier };
  }

  return null;
};

const extractVideoResourceFromMetadata = (value, fallbackName, seen = new Set()) => {
  const parsed = parseFetchedJson(value);
  if (!parsed || seen.has(parsed)) return null;
  seen.add(parsed);

  const direct = normalizeVideoResource(parsed, fallbackName);
  if (direct) return direct;

  for (const key of ['qdnVideo', 'qdn', 'videoResource', 'resource', 'media', 'video', 'data']) {
    const nested = extractVideoResourceFromMetadata(parsed[key], fallbackName, seen);
    if (nested) return nested;
  }

  for (const nestedValue of Object.values(parsed)) {
    if (!nestedValue || typeof nestedValue !== 'object') continue;
    const nested = extractVideoResourceFromMetadata(nestedValue, fallbackName, seen);
    if (nested) return nested;
  }

  const identifierFields = [
    'videoIdentifier',
    'qdnVideoIdentifier',
    'videoResourceIdentifier',
    'videoId',
  ];

  for (const field of identifierFields) {
    const identifier = typeof parsed[field] === 'string' ? parsed[field].trim() : '';
    if (identifier && !identifier.endsWith('_metadata')) {
      return { service: 'VIDEO', name: fallbackName, identifier };
    }
  }

  return null;
};

const uniqueResources = (resources) => {
  const seen = new Set();

  return resources.filter((resource) => {
    if (!resource?.name || !resource?.identifier) return false;
    const key = `${resource.service}:${resource.name}:${resource.identifier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findQdnVideoResources = async ({ name, identifier }) => {
  const baseIdentifier = identifier.replace(/_metadata$/, '');
  const prefixes = uniqueResources([
    { service: 'VIDEO', name, identifier: baseIdentifier },
    { service: 'VIDEO', name, identifier },
  ]).map((resource) => resource.identifier);
  const resources = [];

  for (const prefixIdentifier of prefixes) {
    try {
      const result = await requestQortium({
        action: 'SEARCH_QDN_RESOURCES',
        service: 'VIDEO',
        mode: 'ALL',
        name,
        identifier: prefixIdentifier,
        prefix: true,
        limit: 20,
        offset: 0,
        reverse: true,
        includeMetadata: true,
        includeStatus: true,
        excludeBlocked: true,
        exactMatchNames: true,
      });

      const matches = Array.isArray(result) ? result : [];
      resources.push(
        ...matches.map((match) => ({
          service: 'VIDEO',
          name: match.name || name,
          identifier: match.identifier,
        })),
      );
    } catch {
      // Search is a best-effort fallback for QDN video metadata variants.
    }
  }

  return uniqueResources(resources);
};

const resolveQdnMetadataResources = async ({ name, identifier }) => {
  const resources = [];

  if (identifier.endsWith('_metadata')) {
    resources.push({
      service: 'VIDEO',
      name,
      identifier: identifier.replace(/_metadata$/, ''),
    });
  }

  for (const service of ['DOCUMENT', 'JSON']) {
    try {
      const metadata = await requestQortium({
        action: 'FETCH_QDN_RESOURCE',
        service,
        name,
        identifier,
      });
      const resource = extractVideoResourceFromMetadata(metadata, name);
      if (resource) {
        resources.push(resource);
      }
    } catch {
      // QDN video metadata can use more than one service; try the next one.
    }
  }

  resources.push(...(await findQdnVideoResources({ name, identifier })));

  return uniqueResources(resources).map(toDirectVideoCandidate);
};

const resolveVideoResources = async (videoSource) => {
  if (!videoSource) return [];
  if (videoSource.type === 'direct') {
    return [
      {
        directUrl: videoSource.directUrl || '',
        resource: videoSource.resource,
      },
    ];
  }
  if (videoSource.type === 'metadata') return resolveQdnMetadataResources(videoSource);
  return [];
};

const isDirectVideoUrl = (sourceUrl) => {
  const value = extractEmbeddedSource(sourceUrl);
  if (!value) return false;

  const url = toUrl(value);
  return Boolean(
    url && ['http:', 'https:'].includes(url.protocol) && directVideoExtensionPattern.test(url.pathname),
  );
};

export const useVideoResource = (video, { enabled = true } = {}) => {
  const [resourceUrl, setResourceUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const videoSource = useMemo(() => getVideoSource(video), [video]);
  const fallbackSourceUrl = trimString(video?.sourceUrl);

  useEffect(() => {
    let cancelled = false;

    const loadResource = async () => {
      setResourceUrl('');
      setStatus(null);
      setError('');

      if (!enabled) {
        setIsLoading(false);
        return;
      }

      const qdnResources = await resolveVideoResources(videoSource);

      if (!qdnResources.length) {
        if (isDirectVideoUrl(fallbackSourceUrl)) {
          setResourceUrl(fallbackSourceUrl);
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        let latestError = '';

        for (const candidate of qdnResources) {
          if (candidate.directUrl) {
            setResourceUrl(candidate.directUrl);
            return;
          }

          const qdnResource = candidate.resource || candidate;
          const readyStatus = await waitForQdnResourceReady({
            ...qdnResource,
            onStatusChange: (nextStatus) => {
              if (!cancelled) {
                setStatus(nextStatus);
              }
            },
          });

          if (cancelled) return;

          if (!isQdnResourceReady(readyStatus.status)) {
            latestError = `Video is not ready yet (${readyStatus.status}).`;
            continue;
          }

          const nextResourceUrl = await getQdnResourceUrl(qdnResource);
          if (cancelled) return;

          if (nextResourceUrl) {
            setResourceUrl(nextResourceUrl);
            return;
          }

          latestError = 'Video resource URL could not be resolved.';
        }

        setError(latestError || 'Video resource URL could not be resolved.');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Video resource could not be loaded.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadResource();

    return () => {
      cancelled = true;
    };
  }, [enabled, fallbackSourceUrl, videoSource]);

  return {
    error,
    isLoading,
    isReady: Boolean(resourceUrl),
    progress: status?.percentLoaded,
    qdnResource: videoSource?.resource || null,
    resourceUrl,
    status,
  };
};
