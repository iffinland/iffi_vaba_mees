import { useState } from 'react';
import { FaEnvelope, FaTimes } from 'react-icons/fa';
import { sendOwnerDirectMessage } from '../../services/directMessageService';
import { OWNER_QMAIL_LINK } from '../../utils/siteConfig';
import styles from './DirectMessageModal.module.css';

function DirectMessageModal({ isOpen, onClose, onSent }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSending(true);

    try {
      await sendOwnerDirectMessage(message);
      setMessage('');
      onSent?.('Message sent successfully.');
      onClose();
    } catch (err) {
      setError(err?.message || 'Unable to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2>Send message</h2>
            <p>Direct message to iffi vaba mees</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" disabled={isSending}>
            <FaTimes />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write your message"
              rows={7}
            />
          </label>

          <div className={styles.mailAlternative}>
            <span>Prefer Q-Mail?</span>
            <a href={OWNER_QMAIL_LINK}>
              <FaEnvelope />
              <span>Open Q-Mail</span>
            </a>
          </div>

          {error && <p className={styles.error}>{error}</p>}


          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSending}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DirectMessageModal;
