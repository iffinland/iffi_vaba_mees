import { useEffect, useMemo, useState } from 'react';
import {
  getQdnResourceUrl,
  isQdnResourceReady,
  waitForQdnResourceReady,
} from '../services/qdnResourceService';

const directVideoExtensionPattern = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseQortalVideoLink = (sourceUrl) => {
  const value = trimString(sourceUrl);
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol === 'qortal:' && url.hostname.toUpperCase() === 'VIDEO') {
      const [name, identifier] = url.pathname
        .split('/')
        .filter(Boolean)
        .map((part) => decodeURIComponent(part));

      if (name && identifier) {
        return { service: 'VIDEO', name, identifier };
      }
    }

    if (url.protocol === 'qortal:' && url.hostname === 'use-embed') {
      const service = url.pathname.replace(/^\/+/, '') || url.searchParams.get('service');
      const name = url.searchParams.get('name');
      const identifier = url.searchParams.get('identifier');

      if (service?.toUpperCase() === 'VIDEO' && name && identifier) {
        return { service: 'VIDEO', name, identifier };
      }
    }

    const pathParts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const arbitraryIndex = pathParts.findIndex((part) => part.toLowerCase() === 'arbitrary');
    const service = pathParts[arbitraryIndex + 1];
    const name = pathParts[arbitraryIndex + 2];
    const identifier = pathParts[arbitraryIndex + 3];

    if (arbitraryIndex >= 0 && service?.toUpperCase() === 'VIDEO' && name && identifier) {
      return { service: 'VIDEO', name, identifier };
    }
  } catch {
    return null;
  }

  return null;
};

const getVideoResource = (video) => {
  if (video?.qdnVideo?.name && video?.qdnVideo?.identifier) {
    return {
      service: video.qdnVideo.service || 'VIDEO',
      name: video.qdnVideo.name,
      identifier: video.qdnVideo.identifier,
    };
  }

  return parseQortalVideoLink(video?.sourceUrl);
};

const isDirectVideoUrl = (sourceUrl) => {
  const value = trimString(sourceUrl);
  if (!value) return false;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && directVideoExtensionPattern.test(url.pathname);
  } catch {
    return false;
  }
};

export const useVideoResource = (video) => {
  const [resourceUrl, setResourceUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const qdnResource = useMemo(() => getVideoResource(video), [video]);
  const fallbackSourceUrl = trimString(video?.sourceUrl);

  useEffect(() => {
    let cancelled = false;

    const loadResource = async () => {
      setResourceUrl('');
      setStatus(null);
      setError('');

      if (!qdnResource) {
        if (isDirectVideoUrl(fallbackSourceUrl)) {
          setResourceUrl(fallbackSourceUrl);
        }
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
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
          setError(`Video is not ready yet (${readyStatus.status}).`);
          setIsLoading(false);
          return;
        }

        const nextResourceUrl = await getQdnResourceUrl(qdnResource);
        if (cancelled) return;

        if (!nextResourceUrl) {
          setError('Video resource URL could not be resolved.');
          setIsLoading(false);
          return;
        }

        setResourceUrl(nextResourceUrl);
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
  }, [fallbackSourceUrl, qdnResource]);

  return {
    error,
    isLoading,
    isReady: Boolean(resourceUrl),
    progress: status?.percentLoaded,
    qdnResource,
    resourceUrl,
    status,
  };
};
