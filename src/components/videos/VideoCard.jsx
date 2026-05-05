import {
  FaCommentDots,
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

function VideoCard({ video, likeCount, onComment, onLike, onShare, onTip }) {
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

  return (
    <article className={styles.card}>
      <button type="button" className={styles.thumbnail} onClick={openVideo}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title || 'Video thumbnail'} />
        ) : (
          <span className={styles.placeholderIcon}>
            <FaPlay />
          </span>
        )}
      </button>

      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <h2>{video.title || 'Untitled video'}</h2>
          <button type="button" onClick={openVideo} aria-label="Open video" title="Open video">
            <FaExternalLinkAlt />
          </button>
        </div>
        <p className={styles.meta}>{formatDate(video.publishedDate)}</p>
        {video.performer && <p className={styles.performer}>{video.performer}</p>}
        {video.playlist && <p className={styles.playlist}>{video.playlist}</p>}
        <p className={styles.description}>
          {truncate(video.descriptionText || 'No description added yet.')}
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={() => onLike(video)} aria-label="Like video" title="Like">
          <FaHeart />
          <span>{likeCount || 0}</span>
        </button>
        <button type="button" onClick={() => onShare(video)} aria-label="Share video" title="Share">
          <FaShareAlt />
        </button>
        <button type="button" onClick={() => onTip(video)} aria-label="Send tip" title="Send tip">
          <FaPaperPlane />
        </button>
        <button type="button" onClick={() => onComment(video)} aria-label="Add comment" title="Comments">
          <FaCommentDots />
        </button>
      </div>
    </article>
  );
}

export default VideoCard;
