import { FaCommentDots, FaHeart, FaShareAlt } from 'react-icons/fa';
import styles from './BlogCard.module.css';

const truncate = (value = '', max = 220) => {
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

function BlogCard({ commentCount, likeCount, onComment, onLike, onOpenDetail, onShare, post }) {
  const stopCardClick = (event) => {
    event.stopPropagation();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(post);
    }
  };

  return (
    <article
      className={styles.card}
      onClick={() => onOpenDetail(post)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cover}>
        {post.coverUrl ? (
          <img src={post.coverUrl} alt={post.title || 'Blog post cover'} />
        ) : (
          <div className={styles.coverPlaceholder}>Blog</div>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.metaRow}>
          <span>{formatDate(post.publishedDate)}</span>
          {post.category && <span>{post.category}</span>}
        </div>
        <h2>{post.title || 'Untitled blog post'}</h2>
        <p>{truncate(post.excerpt || post.contentText || 'No excerpt added yet.')}</p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onLike(post);
          }}
          aria-label="Like blog post"
          title="Like"
        >
          <FaHeart />
          <span>{likeCount || 0}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onShare(post);
          }}
          aria-label="Share blog post"
          title="Share"
        >
          <FaShareAlt />
        </button>
        <button
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onComment(post);
          }}
          aria-label={`${typeof commentCount === 'number' ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'Read comments'}`}
          title="Comments"
        >
          <FaCommentDots />
          {typeof commentCount === 'number' ? <span>{commentCount}</span> : null}
        </button>
      </div>
    </article>
  );
}

export default BlogCard;
