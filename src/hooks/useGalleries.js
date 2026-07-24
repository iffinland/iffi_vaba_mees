import { useCallback, useEffect, useState } from 'react';
import {
  fetchGalleryPage,
  getCurrentUserProfile,
  publishGallery,
  updateGallery,
} from '../services/galleryService';
import {
  fetchGalleryLikeCount,
  publishGalleryLike,
} from '../services/galleryEngagementService';

const PAGE_SIZE = 12;

export const useGalleries = () => {
  const [galleries, setGalleries] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);
  const [likeCounts, setLikeCounts] = useState({});

  const loadGalleries = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchGalleryPage({ page, pageSize: PAGE_SIZE, sortOrder });
      setGalleries(result.galleries);
      setHasNextPage(result.hasNextPage);

      const counts = await Promise.all(
        result.galleries.map(async (gallery) => {
          try {
            return [gallery.identifier, await fetchGalleryLikeCount(gallery.identifier)];
          } catch {
            return [gallery.identifier, 0];
          }
        }),
      );
      setLikeCounts(Object.fromEntries(counts));
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
        console.warn('Unable to load Qortium profile', err);
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
        throw new Error('A Qortium account with a registered name is required.');
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

  const updateExistingGallery = useCallback(
    async (gallery, form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      setIsUpdating(true);
      try {
        const updated = await updateGallery({
          gallery,
          form,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setGalleries((current) =>
          current.map((item) =>
            item.identifier === updated.identifier ? updated : item,
          ),
        );
        return updated;
      } finally {
        setIsUpdating(false);
      }
    },
    [profile.address, profile.name],
  );

  const likeGallery = useCallback(
    async (gallery) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      await publishGalleryLike({
        entityId: gallery.identifier,
        entityTitle: gallery.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });

      setLikeCounts((current) => ({
        ...current,
        [gallery.identifier]: (current[gallery.identifier] || 0) + 1,
      }));
    },
    [profile.address, profile.name],
  );

  return {
    error,
    galleries,
    hasNextPage,
    isLoading,
    isPublishing,
    isUpdating,
    likeCounts,
    likeGallery,
    loadGalleries,
    page,
    profile,
    publishNewGallery,
    setPage,
    setSortOrder,
    sortOrder,
    updateExistingGallery,
  };
};
