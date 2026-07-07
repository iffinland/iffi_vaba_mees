import { useCallback, useState } from 'react';
import {
  fetchGalleryComments,
  publishGalleryComment,
  updateGalleryComment,
} from '../services/galleryEngagementService';

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const useGalleryComments = ({ profile, notify }) => {
  const [activeEntity, setActiveEntity] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentLimit, setCommentLimit] = useState(5);
  const [canLoadMoreComments, setCanLoadMoreComments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const openComments = useCallback(async (entity, limit = 5) => {
    setActiveEntity(entity);
    setCommentLimit(limit);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchGalleryComments(entity.identifier, limit + 1);
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
    setActiveEntity(null);
    setComments([]);
    setCanLoadMoreComments(false);
    setCommentLimit(5);
    setError('');
  }, []);

  const loadMoreComments = useCallback(async () => {
    if (!activeEntity || isLoading) return;
    const nextLimit = commentLimit + 5;
    setCommentLimit(nextLimit);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchGalleryComments(activeEntity.identifier, nextLimit + 1);
      setCanLoadMoreComments(result.length > nextLimit);
      setComments(result.slice(0, nextLimit));
    } catch (err) {
      setError(err?.message || 'Unable to load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [activeEntity, commentLimit, isLoading]);

  const addComment = useCallback(
    async ({ messageHtml, parentId = '' }) => {
      if (!activeEntity) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortium account with a registered name is required.');
        return false;
      }

      setIsSaving(true);
      setError('');

      try {
        const savedComment = await publishGalleryComment({
          entityId: activeEntity.identifier,
          entityTitle: activeEntity.title,
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
    [activeEntity, commentLimit, notify, profile.address, profile.name],
  );

  const editComment = useCallback(
    async ({ comment, messageHtml }) => {
      if (!activeEntity) return false;
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
        const updatedComment = await updateGalleryComment({
          comment,
          entityTitle: activeEntity.title,
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
    [activeEntity, notify, profile.address, profile.name],
  );

  return {
    activeEntity,
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
