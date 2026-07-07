import { useCallback, useState } from 'react';
import {
  fetchVideoComments,
  publishVideoComment,
  updateVideoComment,
} from '../services/videoEngagementService';

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const useVideoComments = ({ profile, notify }) => {
  const [activeVideo, setActiveVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentLimit, setCommentLimit] = useState(5);
  const [canLoadMoreComments, setCanLoadMoreComments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const openComments = useCallback(async (video, limit = 5) => {
    setActiveVideo(video);
    setCommentLimit(limit);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchVideoComments(video.identifier, limit + 1);
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
    setActiveVideo(null);
    setComments([]);
    setCanLoadMoreComments(false);
    setCommentLimit(5);
    setError('');
  }, []);

  const loadMoreComments = useCallback(async () => {
    if (!activeVideo || isLoading) return;
    const nextLimit = commentLimit + 5;
    setCommentLimit(nextLimit);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchVideoComments(activeVideo.identifier, nextLimit + 1);
      setCanLoadMoreComments(result.length > nextLimit);
      setComments(result.slice(0, nextLimit));
    } catch (err) {
      setError(err?.message || 'Unable to load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [activeVideo, commentLimit, isLoading]);

  const addComment = useCallback(
    async ({ messageHtml, parentId = '' }) => {
      if (!activeVideo) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortium account with a registered name is required.');
        return false;
      }

      setIsSaving(true);
      setError('');

      try {
        const savedComment = await publishVideoComment({
          videoId: activeVideo.identifier,
          videoTitle: activeVideo.title,
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
    [activeVideo, commentLimit, notify, profile.address, profile.name],
  );

  const editComment = useCallback(
    async ({ comment, messageHtml }) => {
      if (!activeVideo) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortium account with a registered name is required.');
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
        const updatedComment = await updateVideoComment({
          comment,
          videoTitle: activeVideo.title,
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
    [activeVideo, notify, profile.address, profile.name],
  );

  return {
    activeVideo,
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
