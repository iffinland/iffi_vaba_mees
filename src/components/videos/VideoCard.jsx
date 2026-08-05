import { useState } from 'react';
import {
  FaCommentDots,
  FaEdit,
  FaHeart,
  FaLink,
  FaPaperPlane,
  FaPlay,
  FaShareAlt,
} from 'react-icons/fa';
import { useVideoResource } from '../../hooks/useVideoResource';
import styles from './VideoCard.module.css';

const truncate = (value = '', max = 300) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

const formatDate = (value) => {
  if (!value) return 'No date selected';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date selected';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function VideoCard({
  canEditDescription,
  commentCount,
  likeCount,
  onComment,
  onEditDescription,
  onLike,
  onOpenDetail,
  onPostToChat,
  onShare,
  onTip,
  video,
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const videoResource = useVideoResource(video, { enabled: isPreviewOpen });

  const stopCardClick = (event) => {
    event.stopPropagation();
  };

  const togglePreview = (event) => {
    stopCardClick(event);
    setIsPreviewOpen((current) => !current);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(video);
    }
  };

  return (
    <article
      className={styles.card}
      onClick={() => onOpenDetail(video)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.thumbnail}>
        {isPreviewOpen && videoResource.resourceUrl ? (
          <video
            aria-label={`${video.title || 'Video'} preview`}
            className={styles.previewPlayer}
            autoPlay
            controls
            muted
            playsInline
            poster={video.thumbnailUrl || undefined}
            preload="metadata"
            src={videoResource.resourceUrl}
            onClick={stopCardClick}
          />
        ) : (
          <>
            {video.thumbnailUrl ? (
              <img src={video.thumbnailUrl} alt={video.title || 'Video thumbnail'} />
            ) : (
              <span className={styles.placeholderIcon}>
                <FaPlay />
              </span>
            )}
            <button
              type="button"
              className={styles.previewButton}
              onClick={togglePreview}
              aria-label={isPreviewOpen ? 'Close video preview' : 'Play video preview'}
              title={isPreviewOpen ? 'Close preview' : 'Play preview'}
            >
              <FaPlay />
            </button>
          </>
        )}
        {isPreviewOpen && !videoResource.resourceUrl && (
          <div className={styles.previewStatus} onClick={stopCardClick}>
            {videoResource.isLoading ? (
              <span>
                Loading preview
                {videoResource.progress ? ` ${videoResource.progress}%` : '...'}
              </span>
            ) : (
              <span>{videoResource.error || 'Preview is not available yet.'}</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <h2>{video.title || 'Untitled video'}</h2>
        </div>
        <p className={styles.meta}>{formatDate(video.publishedDate)}</p>
        {video.performer && <p className={styles.performer}>{video.performer}</p>}
        {video.playlist && <p className={styles.playlist}>{video.playlist}</p>}
        <p className={styles.description}>
          {truncate(video.descriptionText || 'No description added yet.')}
        </p>
        {canEditDescription && (
          <button
            type="button"
            className={styles.editDescriptionButton}
            onClick={(event) => {
              stopCardClick(event);
              onEditDescription(video);
            }}
            aria-label="Edit video description"
            title="Edit description"
          >
            <FaEdit />
          </button>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onLike(video);
          }}
          aria-label="Like video"
          title="Like"
        >
          <FaHeart />
          <span>{likeCount || 0}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onShare(video);
          }}
          aria-label="Share video"
          title="Share"
        >
          <FaShareAlt />
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onPostToChat(video);
          }}
          aria-label="Copy chat embed link"
          title="Copy chat embed link"
        >
          <FaLink />
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onTip(video);
          }}
          aria-label="Send tip"
          title="Send tip"
        >
          <FaPaperPlane />
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onComment(video);
          }}
          aria-label={`${typeof commentCount === 'number' ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'Add comment'}`}
          title="Comments"
        >
          <FaCommentDots />
          {typeof commentCount === 'number' ? <span>{commentCount}</span> : null}
        </button>
      </div>
    </article>
  );
}

export default VideoCard;
