import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectPage,
  getCurrentUserProfile,
  publishProject,
} from '../services/projectService';

const PAGE_SIZE = 9;

export const useProjects = (projectType) => {
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchProjectPage({
        page,
        pageSize: PAGE_SIZE,
        projectType,
        searchQuery,
        sortOrder,
        status,
      });
      setProjects(result.projects);
      setHasNextPage(result.hasNextPage);
    } catch (err) {
      setError(err?.message || 'Unable to load projects.');
      setProjects([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, projectType, searchQuery, sortOrder, status]);

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
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setPage(1);
  }, [projectType, searchQuery, sortOrder, status]);

  const publishNewProject = useCallback(
    async (form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortal account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedProject = await publishProject({
          form: { ...form, type: projectType },
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setProjects((current) => [savedProject, ...current].slice(0, PAGE_SIZE));
        return savedProject;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name, projectType],
  );

  return {
    error,
    hasNextPage,
    isLoading,
    isPublishing,
    loadProjects,
    page,
    profile,
    projects,
    publishNewProject,
    searchQuery,
    setPage,
    setSearchQuery,
    setSortOrder,
    setStatus,
    sortOrder,
    status,
  };
};
