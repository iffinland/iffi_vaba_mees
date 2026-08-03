import { useEffect, useRef } from 'react';
import { FaTrash } from 'react-icons/fa';
import styles from './DeleteConfirmationModal.module.css';

function DeleteConfirmationModal({
  isOpen,
  isDeleting,
  itemTitle,
  itemType,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isDeleting) {
      const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
          onCancel();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Confirm deletion">
      <div className={styles.modal}>
        <h2 className={styles.heading}>Delete {itemType}</h2>

        <p className={styles.message}>
          Remove this published {itemType.toLowerCase()} from the current QDN state?
        </p>

        {itemTitle && (
          <p className={styles.itemName}>
            <strong>{itemTitle}</strong>
          </p>
        )}

        <p className={styles.warning}>
          This action publishes a deletion transaction. The {itemType.toLowerCase()} will
          no longer be discoverable through normal QDN search and read APIs.
        </p>

        {isDeleting && (
          <p className={styles.deletingNotice}>Deleting&hellip;</p>
        )}

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancelButton}
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            disabled={isDeleting}
            onClick={onConfirm}
          >
            <FaTrash />
            <span>Delete permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmationModal;
