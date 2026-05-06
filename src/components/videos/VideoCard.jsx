import {
  FaCommentDots,
  FaEdit,
  FaExternalLinkAlt,
  FaHeart,
  FaPaperPlane,
  FaPlay,
  FaShareAlt,
} from 'react-icons/fa';
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
  likeCount,
  onComment,
  onEditDescription,
  onLike,
  onOpenDetail,
  onShare,
  onTip,
  video,
}) {
  const openVideo = () => {
    if (video.sourceUrl) {
      window.open(video.sourceUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (video.qdnVideo?.name && video.qdnVideo?.identifier) {
      window.open(
        `qortal://VIDEO/${encodeURIComponent(video.qdnVideo.name)}/${encodeURIComponent(video.qdnVideo.identifier)}`,
        '_blank',
        'noopener,noreferrer',
      );
    }
  };

  const stopCardClick = (event) => {
    event.stopPropagation();
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
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title || 'Video thumbnail'} />
        ) : (
          <span className={styles.placeholderIcon}>
            <FaPlay />
          </span>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <h2>{video.title || 'Untitled video'}</h2>
          <button
            type="button"
            onClick={(event) => {
              stopCardClick(event);
              openVideo();
            }}
            aria-label="Open video"
            title="Open video"
          >
            <FaExternalLinkAlt />
          </button>
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
          aria-label="Add comment"
          title="Comments"
        >
          <FaCommentDots />
        </button>
      </div>
    </article>
  );
}

export default VideoCard;
