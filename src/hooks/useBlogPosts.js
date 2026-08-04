import { useCallback, useEffect, useState } from 'react';
import {
  deleteBlogPost,
  fetchBlogCategories,
  fetchBlogPage,
  getCurrentUserProfile,
  publishBlogPost,
} from '../services/blogService';
import { fetchBlogLikeCount, publishBlogLike } from '../services/blogEngagementService';

const PAGE_SIZE = 9;

export const useBlogPosts = () => {
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [hasNextPage, setHasNextPage] = useState(false);
  const [likeCounts, setLikeCounts] = useState({});

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchBlogPage({
        page,
        pageSize: PAGE_SIZE,
        category: selectedCategory,
        searchQuery,
        sortOrder,
      });
      setPosts(result.posts);
      setHasNextPage(result.hasNextPage);

      const counts = await Promise.all(
        result.posts.map(async (post) => {
          try {
            return [post.identifier, await fetchBlogLikeCount(post.identifier)];
          } catch {
            return [post.identifier, 0];
          }
        }),
      );
      setLikeCounts(Object.fromEntries(counts));
    } catch (err) {
      setError(err?.message || 'Unable to load blog posts.');
      setPosts([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, selectedCategory, sortOrder]);

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
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategories(await fetchBlogCategories());
      } catch (err) {
        console.warn('Unable to load blog categories', err);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, sortOrder]);

  const publishNewPost = useCallback(
    async (form, { onProgress } = {}) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      setIsPublishing(true);
      try {
        const savedPost = await publishBlogPost({
          form,
          authorName: profile.name,
          authorAddress: profile.address,
          onProgress,
        });
        setPosts((current) => [savedPost, ...current].slice(0, PAGE_SIZE));
        if (savedPost.category) {
          setCategories((current) =>
            current.includes(savedPost.category)
              ? current
              : [...current, savedPost.category].sort((a, b) => a.localeCompare(b)),
          );
        }
        return savedPost;
      } finally {
        setIsPublishing(false);
      }
    },
    [profile.address, profile.name],
  );

  const likePost = useCallback(
    async (post) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      await publishBlogLike({
        postId: post.identifier,
        postTitle: post.title,
        authorName: profile.name,
        authorAddress: profile.address,
      });

      setLikeCounts((current) => ({
        ...current,
        [post.identifier]: (current[post.identifier] || 0) + 1,
      }));
    },
    [profile.address, profile.name],
  );

  const deletePost = useCallback(
    async (post) => {
      if (!profile.name || !profile.address) {
        throw new Error('A Qortium account with a registered name is required.');
      }

      setIsDeleting(true);
      try {
        const result = await deleteBlogPost({
          identifier: post.identifier,
          authorName: profile.name,
          authorAddress: profile.address,
        });
        setPosts((current) => current.filter((item) => item.identifier !== post.identifier));
        return result;
      } finally {
        setIsDeleting(false);
      }
    },
    [profile.address, profile.name],
  );

  return {
    categories,
    deletePost,
    error,
    hasNextPage,
    isDeleting,
    isLoading,
    isPublishing,
    likeCounts,
    likePost,
    loadPosts,
    page,
    posts,
    profile,
    publishNewPost,
    searchQuery,
    selectedCategory,
    setPage,
    setSearchQuery,
    setSelectedCategory,
    setSortOrder,
    sortOrder,
  };
};
