import { useCallback, useEffect, useRef, useState } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import RichTextEditor from './RichTextEditor';
import { bbcodeToHtml, htmlToBbcode, isContentEmpty } from '../../../utils/richTextUtils';
import styles from './RichTextModal.module.css';

/**
 * RichTextModal — a full-screen rich-text editing modal.
 *
 * Lifecycle:
 *   open → load initialHtml → edit (BBCode draft) → confirm (BBCode→HTML) → close
 *   cancel → revert to confirmedHtml → close
 *
 * Props:
 *   isOpen        — controls modal visibility
 *   initialHtml   — HTML to preload (empty for new posts)
 *   onConfirm     — called with confirmed HTML string
 *   onClose       — called when modal is dismissed (cancel / overlay click)
 */
export default function RichTextModal({
  isOpen,
  initialHtml = '',
  onConfirm,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  const [confirmedHtml, setConfirmedHtml] = useState('');
  const prevOpenRef = useRef(false);

  // ── Open / close lifecycle ──────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      return;
    }

    const justOpened = !prevOpenRef.current;
    prevOpenRef.current = true;

    if (justOpened) {
      // Convert stored HTML to BBCode for editing
      const initialBbcode = initialHtml ? htmlToBbcode(initialHtml) : '';
      setDraft(initialBbcode);
      setConfirmedHtml(initialHtml || '');
    }
  }, [isOpen, initialHtml]);

  // ── Confirm ─────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (isContentEmpty(draft)) {
      // Don't confirm empty content — caller should validate
      return;
    }
    const html = bbcodeToHtml(draft);
    setConfirmedHtml(html);
    onConfirm?.(html);
  }, [draft, onConfirm]);

  // ── Cancel ──────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    // Restore draft to last confirmed state
    const restoredBbcode = confirmedHtml ? htmlToBbcode(confirmedHtml) : '';
    setDraft(restoredBbcode);
    onClose?.();
  }, [confirmedHtml, onClose]);

  // ── Overlay click ───────────────────────────────────────

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  // ── Escape key ──────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel]);

  // ── Body scroll lock ────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isEmpty = isContentEmpty(draft);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Rich text editor"
      onClick={handleOverlayClick}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2>Write content</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleCancel}
            aria-label="Close editor"
          >
            <FaTimes />
          </button>
        </div>

        {/* Editor body */}
        <div className={styles.body}>
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="Write your blog post…"
          />
        </div>

        {/* Footer with actions */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={isEmpty}
            title={isEmpty ? 'Content is empty' : 'Save content'}
          >
            <FaCheck />
            <span>Save content</span>
          </button>
        </div>
      </div>
    </div>
  );
}
