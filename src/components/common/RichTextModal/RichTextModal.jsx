import { useCallback, useEffect, useRef, useState } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { RichTextEditor } from '../../editor/RichTextEditor';
import { htmlToBbcode } from '../../../utils/richTextUtils';
import styles from './RichTextModal.module.css';

/**
 * RichTextModal — a full-screen rich-text editing modal.
 *
 * Ported from the Blogs project complete implementation.
 *
 * Lifecycle:
 *   open → load initialHtml → edit (BBCode draft) → confirm (BBCode→HTML) → close
 *   cancel → revert to confirmedHtml → close
 *
 * Props:
 *   isOpen        — controls modal visibility
 *   initialHtml   — HTML to preload (empty for new posts)
 *   ownerName     — QDN publisher name for media uploads
 *   accountNames  — list of QDN account names for search
 *   onConfirm     — called with confirmed HTML string
 *   onClose       — called when modal is dismissed (cancel / overlay click)
 */
export default function RichTextModal({
  isOpen,
  initialHtml = '',
  ownerName = '',
  accountNames,
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
      // Convert stored HTML (legacy) or use BBCode directly for editing.
      // New posts after Bugfix-27 store BBCode natively.
      const initialBbcode = initialHtml
        ? (/<[a-z][\s\S]*?>/i.test(initialHtml) ? htmlToBbcode(initialHtml) : initialHtml)
        : '';
      setDraft(initialBbcode);
      setConfirmedHtml(initialBbcode || '');
    }
  }, [isOpen, initialHtml]);

  // ── Check if content is empty ───────────────────────────

  const isContentEmpty = (value) => {
    if (!value || typeof value !== 'string') return true;
    // Strip all BBCode tags and whitespace
    const stripped = value
      .replace(/\[(\/)?(b|i|u|h2|h3|quote|code|url|color|imageqdn|videoqdn|fileqdn|qdnembed)[^\]]*\]/gi, '')
      .replace(/\[color=#[0-9a-f]{6}\]/gi, '')
      .replace(/\[url=[^\]]+\]/gi, '')
      .trim();
    return stripped.length === 0;
  };

  // ── Confirm ─────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (isContentEmpty(draft)) {
      return;
    }
    // Store BBCode directly — the renderer (RichTextContent) handles
    // BBCode natively, matching the Blogs canonical format.
    setConfirmedHtml(draft);
    onConfirm?.(draft);
  }, [draft, onConfirm]);

  // ── Cancel ──────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    // Restore draft to last confirmed state.
    // confirmedHtml now stores BBCode (matching Blogs canonical format).
    setDraft(confirmedHtml || '');
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
            ownerName={ownerName}
            accountNames={accountNames}
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
