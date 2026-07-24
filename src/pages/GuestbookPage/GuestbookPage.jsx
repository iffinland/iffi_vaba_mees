import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './GuestbookPage.module.css';
import {
  fetchGuestbookPage,
  getCurrentUserProfile,
  publishGuestbookEntry,
} from '../../services/guestbookService';

const PAGE_SIZE = 10;

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [isExhausted, setIsExhausted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [userProfile, setUserProfile] = useState({ address: '', name: '', names: [] });
  const [editingEntry, setEditingEntry] = useState(null);
  const hasRequestedInitialLoad = useRef(false);

  const loadFirstPage = useCallback(async () => {
    if (hasRequestedInitialLoad.current) return;
    hasRequestedInitialLoad.current = true;

    setIsInitialLoading(true);
    setError('');

    try {
      const result = await fetchGuestbookPage({ pageSize: PAGE_SIZE, offset: 0 });
      setEntries(result.entries);
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
      setIsExhausted(result.exhausted && !result.hasMore);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          'Unable to load guestbook entries. Please ensure Qortium Home is open.',
      );
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

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

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isExhausted) return;

    setIsLoadingMore(true);
    setError('');

    try {
      const result = await fetchGuestbookPage({ pageSize: PAGE_SIZE, offset: nextOffset });
      setEntries((current) => {
        const existingIds = new Set(current.map((entry) => entry.identifier));
        const newUnique = result.entries.filter(
          (entry) => !existingIds.has(entry.identifier),
        );
        return [...current, ...newUnique];
      });
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
      setIsExhausted(result.exhausted && !result.hasMore);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to load more entries.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isExhausted, nextOffset]);

  const closeModal = () => {
    setIsModalOpen(false);
    setMessage('');
    setFormError('');
    setEditingEntry(null);
  };

  const openCreateModal = () => {
    if (!userProfile.address) {
      setError('Please log into Qortium Home to write in the guestbook.');
      return;
    }
    if (!userProfile.name) {
      setError('You need a registered Qortium name before posting to the guestbook.');
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
      setFormError('A valid Qortium account with a registered name is required.');
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
        return [savedEntry, ...filtered];
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
          <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
            Write in the guestbook
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isInitialLoading ? (
        <p className={styles.statusMessage}>Loading entries...</p>
      ) : entries.length === 0 ? (
        <p className={styles.statusMessage}>No entries published yet. Be the first!</p>
      ) : (
        <>
          <div className={styles.entries}>
            {entries.map((entry) => (
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
          {hasMore && (
            <div className={styles.loadMore}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load older entries'}
              </button>
            </div>
          )}
          {isExhausted && entries.length > PAGE_SIZE && (
            <p className={styles.statusMessage}>All entries loaded.</p>
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
                Qortium name
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
