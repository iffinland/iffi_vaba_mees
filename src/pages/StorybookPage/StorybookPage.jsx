import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch } from 'react-icons/fa';
import StoryEntryCard from '../../components/storybook/StoryEntryCard';
import StoryEntryPublishModal from '../../components/storybook/StoryEntryPublishModal';
import { useLifeStoryEntries } from '../../hooks/useLifeStoryEntries';
import { isOwnerName } from '../../utils/siteConfig';
import styles from './StorybookPage.module.css';

function StorybookPage() {
  const navigate = useNavigate();
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [toast, setToast] = useState('');
  const {
    entries,
    error,
    hasNextPage,
    isLoading,
    isPublishing,
    page,
    profile,
    publishNewEntry,
    searchQuery,
    setPage,
    setSearchQuery,
  } = useLifeStoryEntries();

  const canPublishEntries = isOwnerName(profile.name);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const openEntryDetail = (entry) => {
    navigate(`/storybook/${encodeURIComponent(entry.identifier)}`);
  };

  const handlePublish = async (form) => {
    await publishNewEntry(form);
    notify('Story entry published successfully.');
  };

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.hero}>
        <div>
          <h1>My Life Storybook</h1>
          <p>
            A chronological memoir. Entries can be written in any order, but readers see
            them arranged by the life period they describe.
          </p>
        </div>
        {canPublishEntries && (
          <button type="button" className={styles.publishButton} onClick={() => setIsPublishOpen(true)}>
            <FaPlus />
            <span>Publish entry</span>
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <FaSearch />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search the storybook"
          />
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.status}>Loading story entries...</p>
      ) : entries.length === 0 ? (
        <p className={styles.status}>No story entries found.</p>
      ) : (
        <div className={styles.bookList}>
          {entries.map((entry) => (
            <StoryEntryCard
              entry={entry}
              key={entry.identifier}
              onOpenDetail={openEntryDetail}
            />
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || isLoading}>
          Previous
        </button>
        <span>Page {page}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={!hasNextPage || isLoading}>
          Next
        </button>
      </div>

      <StoryEntryPublishModal
        isOpen={canPublishEntries && isPublishOpen}
        isPublishing={isPublishing}
        onClose={() => setIsPublishOpen(false)}
        onPublish={handlePublish}
      />
    </section>
  );
}

export default StorybookPage;
