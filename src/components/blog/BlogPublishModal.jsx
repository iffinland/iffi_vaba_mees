import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaEdit, FaTimes } from 'react-icons/fa';
import { RichTextEditor } from '../editor/RichTextEditor';
import PublishProgressModal from '../common/PublishProgressModal';
import { usePublishProgress, PUBLISH_PHASES } from '../../hooks/usePublishProgress';
import { getEffectiveContentLength, BLOG_CONTENT_COLLAPSE_THRESHOLD } from '../../utils/contentLength';
import styles from './BlogPublishModal.module.css';

const initialForm = {
  title: '',
  excerpt: '',
  contentHtml: '',
  category: '',
  newCategory: '',
  tags: '',
  publishedDate: '',
  coverFile: null,
};

const toEditForm = (post) => ({
  title: post?.title || '',
  excerpt: post?.excerpt || '',
  contentHtml: post?.contentHtml || '',
  category: post?.category || '',
  newCategory: '',
  tags: (post?.tags || []).join(', '),
  publishedDate: post?.publishedDate || '',
  coverFile: null,
});

/**
 * Check if rich-text content is effectively empty (no visible text).
 * Handles both BBCode and HTML content.
 */
const isEmptyContent = (value) => {
  if (!value || typeof value !== 'string') return true;
  const stripped = value
    .replace(/\[(\/)?(b|i|u|h2|h3|quote|code|url|color|imageqdn|videoqdn|fileqdn|qdnembed)[^\]]*\]/gi, '')
    .replace(/\[color=#[0-9a-f]{6}\]/gi, '')
    .replace(/\[url=[^\]]+\]/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length === 0;
};

function BlogPublishModal({
  categories,
  editPost,
  isOpen,
  isPublishing,
  ownerName = '',
  accountNames,
  onClose,
  onPublish,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const isEditMode = Boolean(editPost);
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

  // Track modal open/close transitions
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      return;
    }

    const justOpened = !prevOpenRef.current;
    prevOpenRef.current = true;

    setForm(editPost ? toEditForm(editPost) : initialForm);
    setError('');

    if (justOpened) {
      resetProgress();
      serviceFailedRef.current = false;

      // Determine initial editor collapse state
      if (!editPost) {
        // New post — editor always expanded
        setIsContentExpanded(true);
      } else {
        // Existing post — collapse if above threshold
        const effectiveLength = getEffectiveContentLength(editPost?.contentHtml || '');
        setIsContentExpanded(effectiveLength < BLOG_CONTENT_COLLAPSE_THRESHOLD);
      }
    }
  }, [editPost, isOpen, resetProgress]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(categories.filter(Boolean))),
    [categories],
  );

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (isPublishActive) return; // duplicate-submit protection

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    if (isEmptyContent(form.contentHtml)) {
      setError('Write the blog post content before publishing.');
      return;
    }

    const hasCover = Boolean(form.coverFile);

    if (isCreateMode) {
      // ---- Create mode: progress modal integration ----
      const totalChildResources = hasCover ? 1 : 0;

      // Build initial resource list
      const resources = [];
      if (hasCover) {
        resources.push({
          id: 'COVER:0',
          label: `Cover — ${form.coverFile?.name || 'cover'}`,
          service: 'THUMBNAIL',
          identifier: '',
        });
      }

      startPublish(
        'Publishing Blog Post',
        totalChildResources,
        resources,
      );
      serviceFailedRef.current = false;

      try {
        await onPublish(
          {
            ...form,
            category: form.newCategory.trim() || form.category,
          },
          { onProgress: updateProgress },
        );
        // Success handled by progress complete state — do not close yet
        // The user clicks "Done" in the progress modal
      } catch (err) {
        if (!serviceFailedRef.current) {
          finishError(err?.message || 'Unable to publish blog post.');
        }
        setError(err?.message || 'Unable to publish blog post.');
      }
    } else {
      // ---- Edit mode: progress modal integration ----
      const hasNewCover = Boolean(form.coverFile);
      const isMetadataOnly = !hasNewCover;

      if (isMetadataOnly) {
        // Metadata-only edit — simplified progress flow
        startPublish('Updating Blog Post', 0, []);
        serviceFailedRef.current = false;

        try {
          await onPublish(
            {
              ...form,
              category: form.newCategory.trim() || form.category,
            },
            { onProgress: updateProgress },
          );
        } catch (err) {
          if (!serviceFailedRef.current) {
            finishError(err?.message || 'Unable to update blog post.');
          }
          setError(err?.message || 'Unable to update blog post.');
        }
      } else {
        // New-cover edit — two-stage batch progress
        const totalChildResources = 1; // single cover

        const resources = [
          {
            id: 'COVER:0',
            label: `Cover — ${form.coverFile?.name || 'cover'}`,
            service: 'THUMBNAIL',
            identifier: '',
          },
        ];

        startPublish('Updating Blog Post', totalChildResources, resources);
        serviceFailedRef.current = false;

        try {
          await onPublish(
            {
              ...form,
              category: form.newCategory.trim() || form.category,
            },
            { onProgress: updateProgress },
          );
        } catch (err) {
          if (!serviceFailedRef.current) {
            finishError(err?.message || 'Unable to update blog post.');
          }
          setError(err?.message || 'Unable to update blog post.');
        }
      }
    }
  };

  const handleProgressDone = () => {
    // Blog published/updated successfully — clean up and close
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
            <h2>{isEditMode ? 'Edit blog post' : 'Publish blog post'}</h2>
            {!isPublishActive && (
              <button type="button" onClick={handleClose} aria-label="Close">
                <FaTimes />
              </button>
            )}
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.grid}>
              <label>
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  placeholder="Blog post title"
                  disabled={isFormDisabled}
                />
              </label>
              <label>
                Published date
                <input
                  type="date"
                  value={form.publishedDate}
                  onChange={(event) => updateField('publishedDate', event.target.value)}
                  disabled={isFormDisabled}
                />
              </label>
            </div>

            <label>
              Cover image
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

            <label>
              Excerpt
              <textarea
                value={form.excerpt}
                onChange={(event) => updateField('excerpt', event.target.value)}
                placeholder="Short intro shown on the blog list"
                rows={3}
                disabled={isFormDisabled}
              />
            </label>

            <div className={styles.grid}>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  disabled={isFormDisabled}
                >
                  <option value="">No category</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New category
                <input
                  type="text"
                  value={form.newCategory}
                  onChange={(event) => updateField('newCategory', event.target.value)}
                  placeholder="Create a category"
                  disabled={isFormDisabled}
                />
              </label>
            </div>

            <label>
              Tags
              <input
                type="text"
                value={form.tags}
                onChange={(event) => updateField('tags', event.target.value)}
                placeholder="forest, qortium, life"
                disabled={isFormDisabled}
              />
              <span className={styles.fieldHint}>Separate tags with commas.</span>
            </label>

            <div className={styles.fieldGroup}>
              <div className={styles.contentHeader}>
                <span>Content</span>
                {isEditMode && (
                  <button
                    type="button"
                    className={styles.collapseToggle}
                    onClick={() => setIsContentExpanded((prev) => !prev)}
                    aria-label={isContentExpanded ? 'Collapse editor' : 'Expand editor'}
                  >
                    {isContentExpanded ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                  </button>
                )}
              </div>

              {!isContentExpanded ? (
                /* Collapsed summary (only for existing posts above threshold) */
                <div className={styles.contentSummary}>
                  <div className={styles.contentSummaryText}>
                    Current content: approximately{' '}
                    {getEffectiveContentLength(form.contentHtml).toLocaleString()}{' '}
                    characters
                  </div>
                  <button
                    type="button"
                    className={styles.editContentButton}
                    onClick={() => setIsContentExpanded(true)}
                    disabled={isFormDisabled}
                  >
                    <FaEdit />
                    <span>Edit content</span>
                  </button>
                </div>
              ) : (
                /* Inline rich-text editor */
                <div className={styles.inlineEditor}>
                  <RichTextEditor
                    value={form.contentHtml}
                    ownerName={ownerName}
                    accountNames={accountNames}
                    onChange={(nextContent) => updateField('contentHtml', nextContent)}
                    placeholder="Write your blog post…"
                    disabled={isFormDisabled}
                  />
                </div>
              )}
            </div>

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
        title={isEditMode ? 'Updating Blog Post' : 'Publishing Blog Post'}
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

export default BlogPublishModal;
