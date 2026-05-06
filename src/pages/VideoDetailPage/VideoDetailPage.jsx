import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaEdit } from 'react-icons/fa';
import InlineComments from '../../components/common/InlineComments';
import VideoPublishModal from '../../components/videos/VideoPublishModal';
import { useVideoComments } from '../../hooks/useVideoComments';
import { useVideoResource } from '../../hooks/useVideoResource';
import {
  fetchVideoByIdentifier,
  getCurrentUserProfile,
  updateVideo,
} from '../../services/videoService';
import styles from './VideoDetailPage.module.css';

const OWNER_QORTAL_NAME = 'iffi vaba mees';

const formatDate = (value) => {
  if (!value) return 'No date selected';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function VideoDetailPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const comments = useVideoComments({ profile });

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
    const loadVideo = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextVideo = await fetchVideoByIdentifier(decodeURIComponent(videoId || ''));
        setVideo(nextVideo);
      } catch (err) {
        setError(err?.message || 'Unable to load video details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  useEffect(() => {
    if (video) {
      comments.openComments(video, 5);
    }
  }, [video]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEditVideo = profile.name.trim().toLowerCase() === OWNER_QORTAL_NAME;
  const playlists = video?.playlist ? [video.playlist] : [];
  const videoResource = useVideoResource(video);

  const saveVideoEdits = async (form) => {
    if (!video || !canEditVideo) {
      throw new Error('Only the site owner can edit this video.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedVideo = await updateVideo({
        video,
        form,
        authorName: profile.name,
      });
      setVideo(updatedVideo);
      setIsEditVideoOpen(false);
    } catch (err) {
      setError(err?.message || 'Unable to update video.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className={styles.status}>Loading video details...</p>;
  }

  if (!video) {
    return (
      <section className={styles.page}>
        <Link to="/videos" className={styles.backLink}>Back to videos</Link>
        <p className={styles.status}>{error || 'Video not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Link to="/videos" className={styles.backLink}>Back to videos</Link>

      <article className={styles.detail}>
        <div className={styles.mediaPanel}>
          {videoResource.resourceUrl ? (
            <video
              aria-label={video.title || 'Video player'}
              className={styles.videoPlayer}
              controls
              poster={video.thumbnailUrl || undefined}
              preload="metadata"
              src={videoResource.resourceUrl}
            />
          ) : (
            <>
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt={video.title || 'Video thumbnail'} />
              ) : (
                <div className={styles.placeholder}>Video</div>
              )}
              <div className={styles.playerStatus}>
                {videoResource.isLoading ? (
                  <span>
                    Video is syncing from QDN
                    {videoResource.progress ? ` (${videoResource.progress}%)` : '...'}
                  </span>
                ) : (
                  <span>
                    {videoResource.error ||
                      'This source cannot be played directly in the video player yet.'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.infoPanel}>
          <h1>{video.title || 'Untitled video'}</h1>
          <p className={styles.meta}>{formatDate(video.publishedDate)}</p>
          {video.performer && <p className={styles.strongMeta}>{video.performer}</p>}
          {video.playlist && <p className={styles.strongMeta}>{video.playlist}</p>}
          {canEditVideo && (
            <button
              type="button"
              className={styles.editVideoButton}
              onClick={() => setIsEditVideoOpen(true)}
            >
              <FaEdit />
              <span>Edit video</span>
            </button>
          )}
        </div>
      </article>

      <section className={styles.descriptionSection}>
        <h2>Description</h2>
        {video.descriptionHtml ? (
          <div
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: video.descriptionHtml }}
          />
        ) : (
          <p className={styles.status}>No description added yet.</p>
        )}
      </section>

      <InlineComments
        canLoadMore={comments.canLoadMoreComments}
        comments={comments.comments}
        error={comments.error}
        isLoading={comments.isLoading}
        isSaving={comments.isSaving}
        onAddComment={comments.addComment}
        onEditComment={comments.editComment}
        onLoadMore={comments.loadMoreComments}
        profile={profile}
      />

      <VideoPublishModal
        editVideo={video}
        isOpen={canEditVideo && isEditVideoOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditVideoOpen(false)}
        onPublish={saveVideoEdits}
        playlists={playlists}
      />
    </section>
  );
}

export default VideoDetailPage;
