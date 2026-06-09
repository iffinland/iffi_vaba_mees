import styles from './StoryEntryCard.module.css';

const truncate = (value = '', max = 220) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
};

function StoryEntryCard({ entry, onOpenDetail }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(entry);
    }
  };

  return (
    <article
      className={styles.card}
      onClick={() => onOpenDetail(entry)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className={styles.periodRail}>
        <span>{entry.storyYear || '?'}</span>
      </div>
      <div className={styles.pagePreview}>
        {entry.coverUrl && (
          <img src={entry.coverUrl} alt={entry.title || 'Life story cover'} />
        )}
        <div className={styles.content}>
          <p className={styles.period}>{entry.periodText}</p>
          <h2>{entry.title || 'Untitled chapter'}</h2>
          {entry.location && <p className={styles.location}>{entry.location}</p>}
          <p>{truncate(entry.excerpt || entry.contentText || 'No story text added yet.')}</p>
        </div>
      </div>
    </article>
  );
}

export default StoryEntryCard;
