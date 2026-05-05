import { FaTimes } from 'react-icons/fa';
import styles from './VideoTipModal.module.css';

function VideoTipModal({
  amount,
  balance,
  error,
  isLoading,
  isOpen,
  isSending,
  onAmountChange,
  onClose,
  onSend,
  recipientAddress,
  video,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Send tip</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className={styles.infoBox}>
          <span>Wallet balance</span>
          <strong>{isLoading || balance === null ? 'Loading...' : `${balance.toFixed(8)} QORT`}</strong>
        </div>

        <div className={styles.infoBox}>
          <span>Recipient</span>
          <strong>{video?.authorName ? `@${video.authorName}` : 'Unknown publisher'}</strong>
          <small>{recipientAddress || 'Wallet address unavailable'}</small>
        </div>

        <label className={styles.amountField}>
          Amount
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0.00000000"
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.sendButton} onClick={onSend} disabled={isSending || isLoading}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default VideoTipModal;
