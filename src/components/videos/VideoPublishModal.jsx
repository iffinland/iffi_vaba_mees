import { useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './VideoPublishModal.module.css';

const initialForm = {
  title: '',
  performer: '',
  descriptionHtml: '',
  playlist: '',
  newPlaylist: '',
  publishedDate: '',
  sourceType: 'qtube',
  sourceUrl: '',
  thumbnailUrl: '',
  videoFile: null,
};

function VideoPublishModal({ isOpen, isPublishing, onClose, onPublish, playlists }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const playlistOptions = useMemo(() => Array.from(new Set(playlists.filter(Boolean))), [playlists]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await onPublish({
        ...form,
        playlist: form.newPlaylist.trim() || form.playlist,
      });
      setForm(initialForm);
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to publish video.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Publish video</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.sourceTabs}>
            {[
              ['qtube', 'Q-Tube link'],
              ['bridge', 'Qortal video bridge'],
              ['upload', 'Upload file'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={form.sourceType === value ? styles.activeSource : ''}
                onClick={() => updateField('sourceType', value)}
              >
                {label}
              </button>
            ))}
          </div>

          {form.sourceType === 'upload' ? (
            <label>
              Video file
              <input
                type="file"
                accept="video/*"
                onChange={(event) => updateField('videoFile', event.target.files?.[0] || null)}
              />
            </label>
          ) : (
            <label>
              Video link
              <input
                type="url"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                placeholder="Paste a video link"
              />
            </label>
          )}

          <div className={styles.grid}>
            <label>
              Thumbnail
              <input
                type="url"
                value={form.thumbnailUrl}
                onChange={(event) => updateField('thumbnailUrl', event.target.value)}
                placeholder="Optional thumbnail URL"
              />
            </label>
            <label>
              Published date
              <input
                type="date"
                value={form.publishedDate}
                onChange={(event) => updateField('publishedDate', event.target.value)}
              />
            </label>
          </div>

          <div className={styles.grid}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Video title"
              />
            </label>
            <label>
              Performer
              <input
                type="text"
                value={form.performer}
                onChange={(event) => updateField('performer', event.target.value)}
                placeholder="Performer or creator"
              />
            </label>
          </div>

          <div className={styles.grid}>
            <label>
              Playlist
              <select value={form.playlist} onChange={(event) => updateField('playlist', event.target.value)}>
                <option value="">No playlist</option>
                {playlistOptions.map((playlist) => (
                  <option key={playlist} value={playlist}>
                    {playlist}
                  </option>
                ))}
              </select>
            </label>
            <label>
              New playlist
              <input
                type="text"
                value={form.newPlaylist}
                onChange={(event) => updateField('newPlaylist', event.target.value)}
                placeholder="Create a playlist"
              />
            </label>
          </div>

          <label>
            Description
            <RichTextEditor
              value={form.descriptionHtml}
              onChange={(value) => updateField('descriptionHtml', value)}
              placeholder="Add notes, links, or context"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isPublishing}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isPublishing}>
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VideoPublishModal;
