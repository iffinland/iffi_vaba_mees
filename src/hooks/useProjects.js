import { useCallback, useEffect, useState } from 'react';
import {
  deleteProject,
  fetchProjectMainProjects,
  fetchProjectPage,
  getCurrentUserProfile,
  publishProject,
} from '../services/projectService';

const PAGE_SIZE = 9;

export const useProjects = (projectType) => {
  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [mainProjects, setMainProjects] = useState([]);
  const [selectedMainProject, setSelectedMainProject] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
        mainProject: selectedMainProject,
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
  }, [page, projectType, searchQuery, sortOrder, status, selectedMainProject]);

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
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const loadMainProjects = async () => {
      try {
        setMainProjects(await fetchProjectMainProjects());
      } catch (err) {
        console.warn('Unable to load main project options', err);
      }
    };

    loadMainProjects();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [projectType, searchQuery, sortOrder, status, selectedMainProject]);

  const publishNewProject = useCallback(
    async (form) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedProject = await publishProject({
          form: { ...form, type: projectType },
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setProjects((current) => [savedProject, ...current].slice(0, PAGE_SIZE));
        if (savedProject.mainProject) {
          setMainProjects((current) => {
            const normalized = new Set();
            for (const name of [...current, savedProject.mainProject]) {
              const key = name.toLowerCase();
              if (![...normalized].some((existing) => existing.toLowerCase() === key)) {
                normalized.add(name);
              }
            }
            return Array.from(normalized).sort((a, b) => a.localeCompare(b));
          });
        }
        return savedProject;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name, projectType],
  );

  const deleteExistingProject = useCallback(
    async (project) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      setIsDeleting(true);
      try {
        const result = await deleteProject({
          identifier: project.identifier,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setProjects((current) => current.filter((item) => item.identifier !== project.identifier));
        return result;
      } finally {
        setIsDeleting(false);
      }
    },
    [profile.address, profile.name],
  );

  return {
    deleteExistingProject,
    error,
    hasNextPage,
    isDeleting,
    isLoading,
    isPublishing,
    loadProjects,
    mainProjects,
    page,
    profile,
    projects,
    publishNewProject,
    searchQuery,
    selectedMainProject,
    setPage,
    setSearchQuery,
    setSelectedMainProject,
    setSortOrder,
    setStatus,
    sortOrder,
    status,
  };
};
