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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const openComments = useCallback(async (entity) => {
    setActiveEntity(entity);
    setIsLoading(true);
    setError('');

    try {
      setComments(await fetchGalleryComments(entity.identifier));
    } catch (err) {
      setError(err?.message || 'Unable to load comments.');
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeComments = useCallback(() => {
    setActiveEntity(null);
    setComments([]);
    setError('');
  }, []);

  const addComment = useCallback(
    async ({ messageHtml, parentId = '' }) => {
      if (!activeEntity) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortal account with a registered name is required.');
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
        setComments((current) => [...current, savedComment]);
        notify?.('Comment published.');
        return true;
      } catch (err) {
        setError(err?.message || 'Unable to publish comment.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [activeEntity, notify, profile.address, profile.name],
  );

  const editComment = useCallback(
    async ({ comment, messageHtml }) => {
      if (!activeEntity) return false;
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
    closeComments,
    comments,
    editComment,
    error,
    isLoading,
    isSaving,
    openComments,
  };
};
