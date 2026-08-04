import { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaTimes, FaTrash } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import PublishProgressModal from '../common/PublishProgressModal';
import { usePublishProgress, PUBLISH_PHASES } from '../../hooks/usePublishProgress';
import styles from './GalleryPublishModal.module.css';

const initialForm = {
  title: '',
  descriptionHtml: '',
  coverFile: null,
  existingImages: [],
  images: [],
};

const toEditForm = (gallery) => ({
  title: gallery?.title || '',
  descriptionHtml: gallery?.descriptionHtml || '',
  coverFile: null,
  existingImages: (gallery?.images || []).map((image) => ({ ...image })),
  images: [],
});

const buildNewImageRows = (files) => {
  const fileArray = Array.isArray(files) ? files : Array.from(files || []);
  return fileArray.slice(0, 10).map((file) => ({
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    title: '',
    description: '',
    previewUrl: URL.createObjectURL(file),
  }));
};

function GalleryPublishModal({
  editGallery,
  isOpen,
  isPublishing,
  onClose,
  onPublish,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const isEditMode = Boolean(editGallery);
  const isCreateMode = !isEditMode;

  // ---- Reusable progress state ----
  const {
    state: progress,
    startPublish,
    updateProgress: rawUpdateProgress,
    finishError,
    reset: resetProgress,
  } = usePublishProgress();

  // Track whether the service already emitted a failed phase to avoid
  // overwriting detailed failure info with a generic catch-block message.
  const serviceFailedRef = useRef(false);

  const updateProgress = (event) => {
    if (event?.phase === PUBLISH_PHASES.FAILED) {
      serviceFailedRef.current = true;
    }
    rawUpdateProgress(event);
  };

  const isPublishActive =
    progress.phase !== PUBLISH_PHASES.IDLE &&
    progress.phase !== PUBLISH_PHASES.COMPLETE &&
    progress.phase !== PUBLISH_PHASES.FAILED;

  // Track modal open/close transitions to avoid resetting progress mid-session
  // when editGallery changes (e.g. after GalleryDetailPage updates gallery state,
  // or GalleryPage clears editGallery before progress-modal Done is clicked).
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      return;
    }

    const justOpened = !prevOpenRef.current;
    prevOpenRef.current = true;

    setForm(editGallery ? toEditForm(editGallery) : initialForm);
    setError('');

    if (justOpened) {
      resetProgress();
      serviceFailedRef.current = false;
    }
  }, [editGallery, isOpen, resetProgress]);

  const totalExistingImages = useMemo(() => form.existingImages.length, [form.existingImages.length]);
  const totalNewImages = useMemo(() => form.images.length, [form.images.length]);
  const totalImages = totalExistingImages + totalNewImages;
  const canAddMoreImages = totalImages < 10;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const moveExistingImage = (index, direction) => {
    setForm((current) => {
      const next = [...current.existingImages];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, existingImages: next };
    });
  };

  const moveNewImage = (index, direction) => {
    setForm((current) => {
      const next = [...current.images];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, images: next };
    });
  };

  const removeExistingImage = (imageId) => {
    setForm((current) => ({
      ...current,
      existingImages: current.existingImages.filter((image) => image.id !== imageId),
    }));
  };

  const removeNewImage = (imageId) => {
    setForm((current) => {
      const image = current.images.find((item) => item.id === imageId);
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
      return {
        ...current,
        images: current.images.filter((item) => item.id !== imageId),
      };
    });
  };

  const updateExistingImageTitle = (imageId, title) => {
    setForm((current) => ({
      ...current,
      existingImages: current.existingImages.map((image) =>
        image.id === imageId ? { ...image, title } : image,
      ),
    }));
  };

  const updateExistingImageDescription = (imageId, description) => {
    setForm((current) => ({
      ...current,
      existingImages: current.existingImages.map((image) =>
        image.id === imageId ? { ...image, description } : image,
      ),
    }));
  };

  const updateNewImageTitle = (imageId, title) => {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? { ...image, title } : image,
      ),
    }));
  };

  const updateNewImageDescription = (imageId, description) => {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? { ...image, description } : image,
      ),
    }));
  };

  const addImages = (fileList) => {
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
    if (files.length === 0) return;

    setForm((current) => {
      const availableSlots = Math.max(0, 10 - current.existingImages.length - current.images.length);
      if (availableSlots === 0) return current;
      const rows = buildNewImageRows(files.slice(0, availableSlots));
      return {
        ...current,
        images: [...current.images, ...rows],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (isPublishActive) return; // duplicate-submit protection

    if (isCreateMode) {
      // ---- Create mode: use two-stage progress modal ----
      const imageCount = form.images.length;
      const hasCover = Boolean(form.coverFile);
      const totalChildResources = imageCount * 2 + (hasCover ? 1 : 0);

      // Build initial resource list
      const resources = [];
      for (let i = 0; i < form.images.length; i += 1) {
        const row = form.images[i];
        const label = row.file?.name || `Image ${i + 1}`;
        resources.push({
          id: `IMAGE:${i}`,
          label: `Image ${i + 1} — ${label}`,
          service: 'IMAGE',
          identifier: '',
        });
        resources.push({
          id: `THUMBNAIL:${i}`,
          label: `Thumbnail ${i + 1} — ${label}`,
          service: 'THUMBNAIL',
          identifier: '',
        });
      }
      if (hasCover) {
        resources.push({
          id: 'COVER:0',
          label: `Cover — ${form.coverFile?.name || 'cover'}`,
          service: 'THUMBNAIL',
          identifier: '',
        });
      }

      startPublish('Publishing Gallery', totalChildResources, resources);
      serviceFailedRef.current = false;

      try {
        await onPublish(form, { onProgress: updateProgress });
        // Success handled by progress complete state — do not close yet
        // The user clicks "Done" in the progress modal
      } catch (err) {
        // If the service already emitted a failed progress event, don't overwrite it
        if (!serviceFailedRef.current) {
          finishError(err?.message || 'Unable to publish gallery.');
        }
        setError(err?.message || 'Unable to publish gallery.');
      }
    } else {
      // ---- Edit mode: use two-stage progress modal ----
      const newImageCount = form.images.length;
      const hasNewCover = Boolean(form.coverFile);
      const hasNewImages = newImageCount > 0;
      const isMetadataOnly = !hasNewImages && !hasNewCover;

      if (isMetadataOnly) {
        // Metadata-only edit — simplified progress flow, no child resources
        startPublish('Updating Gallery', 0, []);
        serviceFailedRef.current = false;

        try {
          await onPublish(form, { onProgress: updateProgress });
        } catch (err) {
          if (!serviceFailedRef.current) {
            finishError(err?.message || 'Unable to update gallery.');
          }
          setError(err?.message || 'Unable to update gallery.');
        }
      } else {
        // New-media edit — two-stage batch progress
        const totalChildResources = newImageCount * 2 + (hasNewCover ? 1 : 0);

        // Build resource list for new resources only
        const resources = [];
        for (let i = 0; i < form.images.length; i += 1) {
          const row = form.images[i];
          const label = row.file?.name || `New image ${i + 1}`;
          resources.push({
            id: `IMAGE:${i}`,
            label: `Image ${i + 1} — ${label}`,
            service: 'IMAGE',
            identifier: '',
          });
          resources.push({
            id: `THUMBNAIL:${i}`,
            label: `Thumbnail ${i + 1} — ${label}`,
            service: 'THUMBNAIL',
            identifier: '',
          });
        }
        if (hasNewCover) {
          resources.push({
            id: 'COVER:0',
            label: `Cover — ${form.coverFile?.name || 'cover'}`,
            service: 'THUMBNAIL',
            identifier: '',
          });
        }

        startPublish('Updating Gallery', totalChildResources, resources);
        serviceFailedRef.current = false;

        try {
          await onPublish(form, { onProgress: updateProgress });
        } catch (err) {
          if (!serviceFailedRef.current) {
            finishError(err?.message || 'Unable to update gallery.');
          }
          setError(err?.message || 'Unable to update gallery.');
        }
      }
    }
  };

  const handleProgressDone = () => {
    // Gallery published successfully — clean up and close
    form.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setForm(initialForm);
    resetProgress();
    onClose();
  };

  const handleProgressClose = () => {
    // Error or cancellation — keep form data for retry
    resetProgress();
    // Do NOT close the main form — user can retry
  };

  const handleClose = () => {
    if (isPublishActive) return; // block close during active publication
    form.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    onClose();
  };

  if (!isOpen) return null;

  const isFormDisabled = isPublishActive || isPublishing;

  return (
    <>
      {/* ---- Main publish/edit form ---- */}
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        onClick={isPublishActive ? undefined : handleClose}
      >
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h2>{isEditMode ? 'Edit gallery' : 'Publish gallery'}</h2>
            {!isPublishActive && (
              <button type="button" onClick={handleClose} aria-label="Close">
                <FaTimes />
              </button>
            )}
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Gallery title"
                disabled={isFormDisabled}
              />
            </label>

            <label>
              Cover thumbnail
              <input
                type="file"
                accept="image/*"
                disabled={isFormDisabled}
                onChange={(event) => updateField('coverFile', event.target.files?.[0] || null)}
              />
              <span className={styles.fieldHint}>Image file only. Maximum upload size: 5 MB.</span>
              {isEditMode && (
                <span className={styles.fieldHint}>Leave empty to keep the current cover.</span>
              )}
            </label>

            <div className={styles.fieldGroup}>
              <span>Description</span>
              <RichTextEditor
                value={form.descriptionHtml}
                onChange={(value) => updateField('descriptionHtml', value)}
                placeholder="Add gallery context"
              />
            </div>

            <label>
              Images
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!canAddMoreImages || isFormDisabled}
                onChange={(event) => {
                  addImages(event.target.files || []);
                  event.target.value = '';
                }}
              />
              <span className={styles.fieldHint}>
                Select up to {Math.max(0, 10 - totalImages)} more image{10 - totalImages !== 1 ? 's' : ''}. Maximum 10 images total per gallery.
              </span>
            </label>

            {form.existingImages.length > 0 && (
              <div className={styles.imageRows}>
                <h3>Existing images ({totalExistingImages})</h3>
                {form.existingImages.map((image, index) => (
                  <div key={image.id} className={styles.imageRow}>
                    <img src={image.thumbnailUrl || image.src} alt="" />
                    <div className={styles.imageFields}>
                      <input
                        type="text"
                        value={image.title || ''}
                        onChange={(event) =>
                          updateExistingImageTitle(image.id, event.target.value)
                        }
                        placeholder="Image title (optional)"
                        disabled={isFormDisabled}
                      />
                      <textarea
                        value={image.description || ''}
                        onChange={(event) =>
                          updateExistingImageDescription(image.id, event.target.value)
                        }
                        placeholder="Image description (optional)"
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => moveExistingImage(index, -1)} disabled={isFormDisabled}>
                        <FaArrowUp />
                      </button>
                      <button type="button" onClick={() => moveExistingImage(index, 1)} disabled={isFormDisabled}>
                        <FaArrowDown />
                      </button>
                      <button type="button" onClick={() => removeExistingImage(image.id)} disabled={isFormDisabled}>
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {form.images.length > 0 && (
              <div className={styles.imageRows}>
                <h3>New images ({totalNewImages}/10 total: {totalImages})</h3>
                {form.images.map((image, index) => (
                  <div key={image.id} className={styles.imageRow}>
                    <img src={image.previewUrl} alt="" />
                    <div className={styles.imageFields}>
                      <input
                        type="text"
                        value={image.title || ''}
                        onChange={(event) =>
                          updateNewImageTitle(image.id, event.target.value)
                        }
                        placeholder="Image title (optional)"
                        disabled={isFormDisabled}
                      />
                      <textarea
                        value={image.description || ''}
                        onChange={(event) =>
                          updateNewImageDescription(image.id, event.target.value)
                        }
                        placeholder="Image description (optional)"
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => moveNewImage(index, -1)} disabled={isFormDisabled}>
                        <FaArrowUp />
                      </button>
                      <button type="button" onClick={() => moveNewImage(index, 1)} disabled={isFormDisabled}>
                        <FaArrowDown />
                      </button>
                      <button type="button" onClick={() => removeNewImage(image.id)} disabled={isFormDisabled}>
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleClose}
                disabled={isFormDisabled}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isFormDisabled}
              >
                {isPublishActive
                  ? 'Publishing…'
                  : isPublishing
                    ? 'Saving…'
                    : isEditMode
                      ? 'Save changes'
                      : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ---- Progress modal (create and edit modes) ---- */}
      <PublishProgressModal
        isOpen={progress.isModalOpen}
        title={isEditMode ? 'Updating Gallery' : 'Publishing Gallery'}
        phase={progress.phase}
        current={progress.current}
        total={progress.total}
        resources={progress.resources}
        message={progress.message}
        error={progress.error}
        stage1Complete={progress.stage1Complete}
        stage2Complete={progress.stage2Complete}
        canClose={!isPublishActive}
        onClose={handleProgressClose}
        onDone={handleProgressDone}
      />
    </>
  );
}

export default GalleryPublishModal;
