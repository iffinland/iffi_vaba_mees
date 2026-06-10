import { useEffect, useMemo, useState } from 'react';
import styles from './GuestbookPage.module.css';
import {
  fetchGuestbookEntries,
  getCurrentUserProfile,
  publishGuestbookEntry,
} from '../../services/guestbookService';

const PAGE_SIZE = 5;

const formatTimestamp = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

function GuestbookPage() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [userProfile, setUserProfile] = useState({ address: '', name: '', names: [] });
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    const loadEntries = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await fetchGuestbookEntries();
        setEntries(data);
      } catch (err) {
        console.error(err);
        setError(
          err?.message ||
            'Unable to load guestbook entries. Please ensure Qortal UI is open.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        setUserProfile(profile);
      } catch (err) {
        console.warn('Unable to load user profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [sortOrder]);

  const sortedEntries = useMemo(() => {
    const list = [...entries];
    return list.sort((a, b) => {
      const aTimestamp = a.updated ?? a.created ?? 0;
      const bTimestamp = b.updated ?? b.created ?? 0;
      return sortOrder === 'newest' ? bTimestamp - aTimestamp : aTimestamp - bTimestamp;
    });
  }, [entries, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedEntries.slice(start, start + PAGE_SIZE);
  }, [currentPage, sortedEntries]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const closeModal = () => {
    setIsModalOpen(false);
    setMessage('');
    setFormError('');
    setEditingEntry(null);
  };

  const openCreateModal = () => {
    if (!userProfile.address) {
      setError('Please log into Qortal UI to write in the guestbook.');
      return;
    }
    if (!userProfile.name) {
      setError('You need a registered Qortal name before posting to the guestbook.');
      return;
    }
    setEditingEntry(null);
    setMessage('');
    setFormError('');
    setIsModalOpen(true);
  };

  const beginEditEntry = (entry) => {
    setEditingEntry(entry);
    setMessage(entry.message);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setFormError('Please write a short message before publishing.');
      return;
    }
    if (!userProfile.address || !userProfile.name) {
      setFormError('A valid Qortal account with a registered name is required.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const savedEntry = await publishGuestbookEntry({
        message: message.trim(),
        authorName: userProfile.name,
        authorAddress: userProfile.address,
        existingIdentifier: editingEntry?.identifier,
        created: editingEntry?.created,
      });

      setEntries((prev) => {
        const filtered = prev.filter((entry) => entry.identifier !== savedEntry.identifier);
        return [...filtered, savedEntry];
      });

      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Unable to publish entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const canEditEntry = (entry) =>
    Boolean(
      userProfile.address &&
        entry.authorAddress &&
        entry.authorAddress === userProfile.address &&
        userProfile.name,
    );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Guestbook</h1>
          <p className={styles.intro}>
            Feel free to share your thoughts or feelings after visiting my website. Leave a comment.
          </p>
        </div>
        <div className={styles.actions}>
          <label className={styles.sortControl}>
            Sort
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className={styles.sortSelect}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
            Write in the guestbook
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.statusMessage}>Loading entries...</p>
      ) : paginatedEntries.length === 0 ? (
        <p className={styles.statusMessage}>No entries published yet. Be the first!</p>
      ) : (
        <>
          <div className={styles.entries}>
            {paginatedEntries.map((entry) => (
              <div key={entry.id} className={styles.entry}>
                <div className={styles.entryHeader}>
                  <div>
                    <p className={styles.entryAuthor}>{entry.authorName}</p>
                    <p className={styles.entryTimestamp}>
                      {formatTimestamp(entry.updated || entry.created)}
                    </p>
                  </div>
                  {canEditEntry(entry) && (
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => beginEditEntry(entry)}
                    >
                      Edit
                    </button>
                  )}
                </div>
                <p className={styles.entryMessage}>{entry.message}</p>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{editingEntry ? 'Edit your message' : 'Write in the guestbook'}</h2>
              <button type="button" className={styles.closeButton} onClick={closeModal}>
                X
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <label>
                Qortal name
                <input type="text" value={userProfile.name} readOnly />
              </label>
              <label>
                Your message
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write something heartfelt..."
                  required
                />
              </label>
              {formError && <p className={styles.error}>{formError}</p>}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingEntry ? 'Save changes' : 'Publish entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestbookPage;
