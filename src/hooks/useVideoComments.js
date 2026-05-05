import { useCallback, useState } from 'react';
import {
  fetchVideoComments,
  publishVideoComment,
} from '../services/videoEngagementService';

const toPlainText = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const useVideoComments = ({ profile, notify }) => {
  const [activeVideo, setActiveVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const openComments = useCallback(async (video) => {
    setActiveVideo(video);
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchVideoComments(video.identifier);
      setComments(result);
    } catch (err) {
      setError(err?.message || 'Unable to load comments.');
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeComments = useCallback(() => {
    setActiveVideo(null);
    setComments([]);
    setError('');
  }, []);

  const addComment = useCallback(
    async ({ messageHtml, parentId = '' }) => {
      if (!activeVideo) return false;
      if (!profile.name || !profile.address) {
        setError('A Qortal account with a registered name is required.');
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
    [activeVideo, notify, profile.address, profile.name],
  );

  return {
    activeVideo,
    addComment,
    closeComments,
    comments,
    error,
    isLoading,
    isSaving,
    openComments,
  };
};
