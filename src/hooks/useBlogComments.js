import { useCallback, useState } from 'react';
import {
  fetchBlogComments,
  publishBlogComment,
  updateBlogComment,
} from '../services/blogEngagementService';

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const useBlogComments = ({ profile, notify }) => {
  const [activePost, setActivePost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentLimit, setCommentLimit] = useState(5);
  const [canLoadMoreComments, setCanLoadMoreComments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const openComments = useCallback(async (post, limit = 5) => {
    setActivePost(post);
    setCommentLimit(limit);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchBlogComments(post.identifier, limit + 1);
      setCanLoadMoreComments(result.length > limit);
      setComments(result.slice(0, limit));
    } catch (err) {
      setError(err?.message || 'Unable to load comments.');
      setComments([]);
      setCanLoadMoreComments(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeComments = useCallback(() => {
    setActivePost(null);
    setComments([]);
    setCanLoadMoreComments(false);
    setCommentLimit(5);
    setError('');
  }, []);

  const loadMoreComments = useCallback(async () => {
    if (!activePost || isLoading) return;
    const nextLimit = commentLimit + 5;
    setCommentLimit(nextLimit);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchBlogComments(activePost.identifier, nextLimit + 1);
      setCanLoadMoreComments(result.length > nextLimit);
      setComments(result.slice(0, nextLimit));
    } catch (err) {
      setError(err?.message || 'Unable to load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [activePost, commentLimit, isLoading]);

  const addComment = useCallback(
    async ({ messageHtml, parentId = '' }) => {
      if (!activePost) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortal account with a registered name is required.');
        return false;
      }

      setIsSaving(true);
      setError('');

      try {
        const savedComment = await publishBlogComment({
          postId: activePost.identifier,
          postTitle: activePost.title,
          parentId,
          authorName: profile.name,
          authorAddress: profile.address,
          messageHtml,
          messageText: toPlainText(messageHtml),
        });
        setComments((current) => [...current, savedComment].slice(0, commentLimit));
        notify?.('Comment published.');
        return true;
      } catch (err) {
        setError(err?.message || 'Unable to publish comment.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [activePost, commentLimit, notify, profile.address, profile.name],
  );

  const editComment = useCallback(
    async ({ comment, messageHtml }) => {
      if (!activePost) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortal account with a registered name is required.');
        return false;
      }

      const isAuthor =
        comment.authorAddress === profile.address || comment.authorName === profile.name;
      if (!isAuthor) {
        setError('Only the comment author can edit this comment.');
        return false;
      }

      setIsSaving(true);
      setError('');

      try {
        const updatedComment = await updateBlogComment({
          comment,
          postTitle: activePost.title,
          authorName: profile.name,
          authorAddress: profile.address,
          messageHtml,
          messageText: toPlainText(messageHtml),
        });
        setComments((current) =>
          current.map((item) =>
            item.identifier === updatedComment.identifier ? updatedComment : item,
          ),
        );
        notify?.('Comment updated.');
        return true;
      } catch (err) {
        setError(err?.message || 'Unable to update comment.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [activePost, notify, profile.address, profile.name],
  );

  return {
    activePost,
    addComment,
    canLoadMoreComments,
    closeComments,
    comments,
    editComment,
    error,
    isLoading,
    isSaving,
    loadMoreComments,
    openComments,
  };
};
