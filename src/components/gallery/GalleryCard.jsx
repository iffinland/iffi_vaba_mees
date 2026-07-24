import { FaCommentDots, FaEdit, FaHeart, FaImages, FaPaperPlane, FaShareAlt } from 'react-icons/fa';
import styles from './GalleryCard.module.css';

const truncate = (value = '', max = 180) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

function GalleryCard({ canEdit, gallery, likeCount, onComment, onEdit, onLike, onOpen, onShare, onTip }) {
  const stopCardClick = (event) => {
    event.stopPropagation();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(gallery);
    }
  };

  return (
    <article
      className={styles.card}
      onClick={() => onOpen(gallery)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cover}>
        {gallery.coverUrl ? (
          <img src={gallery.coverUrl} alt={gallery.title || 'Gallery cover'} />
        ) : (
          <span className={styles.placeholderIcon}>
            <FaImages />
          </span>
        )}
      </div>

      <div className={styles.body}>
        <h2>{gallery.title || 'Untitled gallery'}</h2>
        <p>{truncate(gallery.descriptionText || 'No description added yet.')}</p>
        <span>{gallery.images.length} images</span>
      </div>

      <div className={styles.actions}>
        {canEdit && (
          <button
            type="button"
            onClick={(event) => {
              stopCardClick(event);
              onEdit(gallery, event);
            }}
            aria-label="Edit gallery"
            title="Edit"
          >
            <FaEdit />
          </button>
        )}
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onLike(gallery);
          }}
          aria-label="Like gallery"
          title="Like"
        >
          <FaHeart />
          <span>{likeCount || 0}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onShare(gallery);
          }}
          aria-label="Share gallery"
          title="Share"
        >
          <FaShareAlt />
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onTip(gallery);
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
            onComment(gallery);
          }}
          aria-label="Add comment"
          title="Comment"
        >
          <FaCommentDots />
        </button>
      </div>
    </article>
  );
}

export default GalleryCard;
