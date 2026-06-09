import { useCallback, useEffect, useState } from 'react';
import {
  fetchLifeStoryEntries,
  getCurrentUserProfile,
  publishLifeStoryEntry,
} from '../services/lifeStoryService';

const PAGE_SIZE = 10;

export const useLifeStoryEntries = () => {
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchLifeStoryEntries({
        page,
        pageSize: PAGE_SIZE,
        searchQuery,
      });
      setEntries(result.entries);
      setHasNextPage(result.hasNextPage);
    } catch (err) {
      setError(err?.message || 'Unable to load life story entries.');
      setEntries([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

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
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const publishNewEntry = useCallback(
    async (form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedEntry = await publishLifeStoryEntry({
          form,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setEntries((current) =>
          [savedEntry, ...current].sort((a, b) => a.sortKey - b.sortKey || a.created - b.created),
        );
        return savedEntry;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name],
  );

  return {
    entries,
    error,
    hasNextPage,
    isLoading,
    isPublishing,
    loadEntries,
    page,
    profile,
    publishNewEntry,
    searchQuery,
    setPage,
    setSearchQuery,
  };
};
