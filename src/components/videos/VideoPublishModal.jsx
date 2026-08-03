import { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import { selectQdnPublishSource } from '../../services/qortium/qortiumClient';
import styles from './VideoPublishModal.module.css';

const MAX_VIDEO_SOURCE_BYTES = 100 * 1024 * 1024; // 100 MiB current Qortium Home platform limit

const initialForm = {
  title: '',
  performer: '',
  descriptionHtml: '',
  playlist: '',
  newPlaylist: '',
  publishedDate: '',
  sourceType: 'qtube',
  sourceUrl: '',
  thumbnailFile: null,
};

const toEditForm = (video) => ({
  title: video?.title || '',
  performer: video?.performer || '',
  descriptionHtml: video?.descriptionHtml || '',
  playlist: video?.playlist || '',
  newPlaylist: '',
  publishedDate: video?.publishedDate || '',
  sourceType: video?.sourceType || 'qtube',
  sourceUrl: video?.sourceUrl || '',
  thumbnailFile: null,
});

function VideoPublishModal({
  editVideo,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
  playlists,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [isSelectingSource, setIsSelectingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const isEditMode = Boolean(editVideo);

  const playlistOptions = useMemo(() => Array.from(new Set(playlists.filter(Boolean))), [playlists]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editVideo ? toEditForm(editVideo) : initialForm);
    setError('');
    setSelectedSource(null);
    setSourceError('');
  }, [editVideo, isOpen]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateSourceType = (sourceType) => {
    setForm((current) => ({
      ...current,
      sourceType,
      sourceUrl: sourceType === 'upload' ? '' : current.sourceUrl,
    }));
    setSourceError('');
  };

  const handleSelectSource = async () => {
    setIsSelectingSource(true);
    setSourceError('');

    try {
      const source = await selectQdnPublishSource();

      if (source.size > MAX_VIDEO_SOURCE_BYTES) {
        const sizeMiB = (source.size / (1024 * 1024)).toFixed(1);
        setSourceError(
          `The selected file is ${sizeMiB} MiB. Qortium Home currently supports video uploads up to 100 MiB.`,
        );
        return;
      }

      if (source.size === 0) {
        setSourceError('The selected file appears to be empty. Choose a valid video file.');
        return;
      }

      const mimeType = source.mimeType || '';
      if (mimeType && !mimeType.startsWith('video/')) {
        setSourceError(
          `The selected file type (${mimeType || 'unknown'}) does not appear to be a video. Please select a video file.`,
        );
        return;
      }

      setSelectedSource({
        sourceToken: source.sourceToken,
        fileName: source.fileName || 'unknown-file',
        mimeType: mimeType || 'video/mp4',
        size: source.size,
        kind: source.kind || 'file',
        selectedAt: Date.now(),
      });
    } catch (err) {
      if (err?.message?.toLowerCase().includes('cancel')) {
        // User cancelled — keep previous selection if any, no error
        return;
      }
      setSourceError(err?.message || 'Unable to select video file through Qortium Home.');
    } finally {
      setIsSelectingSource(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.sourceType === 'upload' && !selectedSource?.sourceToken) {
      setError('Select a video file before publishing.');
      return;
    }

    try {
      await onPublish({
        ...form,
        playlist: form.newPlaylist.trim() || form.playlist,
        selectedSource: form.sourceType === 'upload' ? selectedSource : null,
      });
      if (!isEditMode) {
        setForm(initialForm);
        setSelectedSource(null);
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to publish video.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{isEditMode ? 'Edit video' : 'Publish video'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.sourceTabs}>
            {[
              ['qtube', 'External link'],
              ['bridge', 'QDN video resource'],
              ['upload', 'Upload file'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={form.sourceType === value ? styles.activeSource : ''}
                onClick={() => updateSourceType(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={styles.sourceHint}>
            All fields are optional. Playback needs an uploaded video file or a working
            QDN video link.
          </p>

          {form.sourceType === 'upload' ? (
            <div className={styles.fieldGroup}>
              <span>Video file</span>
              {selectedSource ? (
                <div className={styles.selectedSource}>
                  <p className={styles.sourceFileName}>
                    Selected: {selectedSource.fileName}
                  </p>
                  <p className={styles.fieldHint}>
                    Size: {(selectedSource.size / (1024 * 1024)).toFixed(1)} MiB
                    {selectedSource.mimeType ? `  ·  Type: ${selectedSource.mimeType}` : ''}
                  </p>
                  <button
                    type="button"
                    className={styles.sourceSelectButton}
                    onClick={handleSelectSource}
                    disabled={isSelectingSource || isPublishing}
                  >
                    {isSelectingSource ? 'Opening Qortium file picker…' : 'Choose another video'}
                  </button>
                </div>
              ) : (
                <div className={styles.sourceSelectArea}>
                  <button
                    type="button"
                    className={styles.sourceSelectButton}
                    onClick={handleSelectSource}
                    disabled={isSelectingSource || isPublishing}
                  >
                    {isSelectingSource ? 'Opening Qortium file picker…' : 'Select video file'}
                  </button>
                  <p className={styles.fieldHint}>No video selected</p>
                  <p className={styles.fieldHint}>
                    Current maximum supported size: 100 MiB
                  </p>
                </div>
              )}
              {sourceError && <p className={styles.error}>{sourceError}</p>}
              {isEditMode && !selectedSource && (
                <p className={styles.fieldHint}>
                  Leave the picker empty to keep the current uploaded video.
                </p>
              )}
            </div>
          ) : (
            <label>
              {form.sourceType === 'bridge' ? 'QDN video URI' : 'Video link'}
              <input
                type="text"
                value={form.sourceUrl}
                onChange={(event) => updateField('sourceUrl', event.target.value)}
                placeholder={
                  form.sourceType === 'bridge'
                    ? 'Paste qdn://VIDEO/name/video-identifier'
                    : 'Paste a direct video link'
                }
              />
            </label>
          )}

          <div className={styles.grid}>
            <label>
              Thumbnail image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => updateField('thumbnailFile', event.target.files?.[0] || null)}
              />
              {isEditMode && (
                <span className={styles.fieldHint}>
                  Leave empty to keep the current thumbnail.
                </span>
              )}
              <span className={styles.fieldHint}>
                Image file only. Maximum upload size: 5 MB.
              </span>
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

          <div className={styles.fieldGroup}>
            <span>Description</span>
            <RichTextEditor
              value={form.descriptionHtml}
              onChange={(value) => updateField('descriptionHtml', value)}
              placeholder="Add notes, links, or context"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isPublishing}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isPublishing}>
              {isPublishing ? 'Saving...' : isEditMode ? 'Save changes' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VideoPublishModal;
