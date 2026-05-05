import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchVideoPage,
  getCurrentUserProfile,
  publishVideo,
} from '../services/videoService';
import { fetchVideoLikeCount, publishVideoLike } from '../services/videoEngagementService';

const PAGE_SIZE = 9;

export const useVideos = () => {
  const [videos, setVideos] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);
  const [likeCounts, setLikeCounts] = useState({});

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchVideoPage({
        page,
        pageSize: PAGE_SIZE,
        searchQuery,
        sortOrder,
      });
      setVideos(result.videos);
      setHasNextPage(result.hasNextPage);

      const counts = await Promise.all(
        result.videos.map(async (video) => {
          try {
            return [video.identifier, await fetchVideoLikeCount(video.identifier)];
          } catch {
            return [video.identifier, 0];
          }
        }),
      );
      setLikeCounts(Object.fromEntries(counts));
    } catch (err) {
      setError(err?.message || 'Unable to load videos.');
      setVideos([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, sortOrder]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const nextProfile = await getCurrentUserProfile();
        setProfile(nextProfile);
      } catch (err) {
        console.warn('Unable to load Qortal profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortOrder]);

  const filteredVideos = useMemo(() => {
    return videos;
  }, [videos]);

  const publishNewVideo = useCallback(
    async (form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedVideo = await publishVideo({
          form,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setVideos((current) => [savedVideo, ...current].slice(0, PAGE_SIZE));
        return savedVideo;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name],
  );

  const likeVideo = useCallback(
    async (video) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      await publishVideoLike({
        videoId: video.identifier,
        videoTitle: video.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });

      setLikeCounts((current) => ({
        ...current,
        [video.identifier]: (current[video.identifier] || 0) + 1,
      }));
    },
    [profile.address, profile.name],
  );

  return {
    error,
    filteredVideos,
    hasNextPage,
    isLoading,
    isPublishing,
    likeCounts,
    loadVideos,
    page,
    profile,
    publishNewVideo,
    searchQuery,
    setPage,
    setSearchQuery,
    setSortOrder,
    sortOrder,
    likeVideo,
  };
};
