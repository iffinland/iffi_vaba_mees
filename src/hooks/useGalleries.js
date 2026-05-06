import { useCallback, useEffect, useState } from 'react';
import {
  fetchGalleryPage,
  getCurrentUserProfile,
  publishGallery,
} from '../services/galleryService';

const PAGE_SIZE = 12;

export const useGalleries = () => {
  const [galleries, setGalleries] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadGalleries = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchGalleryPage({ page, pageSize: PAGE_SIZE, sortOrder });
      setGalleries(result.galleries);
      setHasNextPage(result.hasNextPage);
    } catch (err) {
      setError(err?.message || 'Unable to load galleries.');
      setGalleries([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, sortOrder]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfile(await getCurrentUserProfile());
      } catch (err) {
        console.warn('Unable to load Qortal profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    loadGalleries();
  }, [loadGalleries]);

  useEffect(() => {
    setPage(1);
  }, [sortOrder]);

  const publishNewGallery = useCallback(
    async (form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedGallery = await publishGallery({
          form,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setGalleries((current) => [savedGallery, ...current].slice(0, PAGE_SIZE));
        return savedGallery;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name],
  );

  return {
    error,
    galleries,
    hasNextPage,
    isLoading,
    isPublishing,
    loadGalleries,
    page,
    profile,
    publishNewGallery,
    setPage,
    setSortOrder,
    sortOrder,
  };
};
