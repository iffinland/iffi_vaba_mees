import { useMemo, useState } from 'react';
import { FaCheckCircle, FaHeart, FaTimes } from 'react-icons/fa';
import { useMonthlySupportStatus } from '../../hooks/useMonthlySupportStatus';
import {
  SUPPORT_MIN_CUSTOM_AMOUNT,
  SUPPORT_PRESET_AMOUNTS,
  createMonthlySupportPayment,
} from '../../services/monthlySupportService';
import { getQortBalance } from '../../services/videoEngagementService';
import styles from './MonthlySupportPage.module.css';

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
};

function MonthlySupportPage() {
  const { error: statusError, loading, record, refresh, state } = useMonthlySupportStatus();
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [completedRecord, setCompletedRecord] = useState(null);

  const customAmountNumber = Number(customAmount);
  const canUseCustomAmount =
    Number.isFinite(customAmountNumber) && customAmountNumber >= SUPPORT_MIN_CUSTOM_AMOUNT;

  const statusLabel = useMemo(() => {
    if (loading) return 'Checking support status...';
    if (state === 'active') return `Active until ${formatDate(record?.nextDueAt)}`;
    if (state === 'due-soon') return `Renewal available soon, active until ${formatDate(record?.nextDueAt)}`;
    if (state === 'ended') return 'Monthly support period has ended';
    if (state === 'needs-name') return 'A Qortal name is required to track monthly support';
    if (state === 'unavailable') return 'Open inside Qortal UI to view your support status';
    if (state === 'error') return statusError || 'Unable to check support status';
    return 'No active monthly support record found';
  }, [loading, record?.nextDueAt, state, statusError]);

  const openPaymentModal = async (amount) => {
    setSelectedAmount(amount);
    setPaymentError('');
    setCompletedRecord(null);
    setWalletBalance(null);
    setIsModalOpen(true);
    setIsBalanceLoading(true);

    try {
      const nextBalance = await getQortBalance().catch(() => null);
      setWalletBalance(typeof nextBalance === 'number' ? nextBalance : null);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const closePaymentModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setPaymentError('');
      setCompletedRecord(null);
    }
  };

  const submitPayment = async () => {
    if (!selectedAmount) return;

    setIsSubmitting(true);
    setPaymentError('');

    try {
      if (typeof walletBalance === 'number' && selectedAmount > walletBalance) {
        setPaymentError('Selected amount is higher than your wallet balance.');
        return;
      }

      const supportRecord = await createMonthlySupportPayment({ amount: selectedAmount });
      setCompletedRecord(supportRecord);
      await refresh();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Monthly support payment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Voluntary QORT contribution</p>
        <h1>Monthly Support</h1>
        <p>
          Support my work with a voluntary monthly QORT contribution. No content is locked behind
          this support.
        </p>
      </div>

      <aside className={`${styles.statusPanel} ${styles[state] || ''}`} aria-live="polite">
        <FaHeart />
        <span>{statusLabel}</span>
      </aside>

      <div className={styles.optionsGrid}>
        {SUPPORT_PRESET_AMOUNTS.map((amount) => (
          <article key={amount} className={styles.optionCard}>
            {amount === 25 && <span className={styles.badge}>Recommended</span>}
            <h2>{amount} QORT</h2>
            <p>Monthly support contribution</p>
            <button type="button" onClick={() => openPaymentModal(amount)}>
              Support monthly
            </button>
          </article>
        ))}

        <article className={`${styles.optionCard} ${styles.customCard}`}>
          <span className={styles.badge}>Custom</span>
          <h2>Custom amount</h2>
          <p>Choose any monthly amount from {SUPPORT_MIN_CUSTOM_AMOUNT} QORT.</p>
          <label>
            <span>QORT amount</span>
            <input
              type="number"
              min={SUPPORT_MIN_CUSTOM_AMOUNT}
              step="0.01"
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              placeholder={`${SUPPORT_MIN_CUSTOM_AMOUNT}.00`}
            />
          </label>
          <button
            type="button"
            onClick={() => openPaymentModal(customAmountNumber)}
            disabled={!canUseCustomAmount}
          >
            Support monthly
          </button>
        </article>
      </div>

      <div className={styles.note}>
        <strong>How it works:</strong> your Qortal wallet sends the selected QORT amount once, then
        this website stores a support record so it can show your monthly support status on future
        visits.
      </div>

      {isModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={closePaymentModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className={styles.modalClose}
              type="button"
              onClick={closePaymentModal}
              aria-label="Close"
              disabled={isSubmitting}
            >
              <FaTimes />
            </button>

            {completedRecord ? (
              <div className={styles.completeState}>
                <FaCheckCircle />
                <h2 id="support-modal-title">Thank you for your support</h2>
                <p>
                  Your monthly support is active until {formatDate(completedRecord.nextDueAt)}.
                </p>
                <button type="button" onClick={closePaymentModal}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className={styles.eyebrow}>Confirm support</p>
                <h2 id="support-modal-title">{selectedAmount?.toFixed(2)} QORT / month</h2>
                <p>
                  This will send a one-time QORT payment and publish a support record for this
                  monthly period.
                </p>

                <div className={styles.infoBox}>
                  <span>Wallet balance</span>
                  <strong>
                    {isBalanceLoading || walletBalance === null
                      ? 'Loading...'
                      : `${walletBalance.toFixed(8)} QORT`}
                  </strong>
                </div>

                {paymentError && <p className={styles.errorText}>{paymentError}</p>}

                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={submitPayment}
                  disabled={isSubmitting || isBalanceLoading}
                >
                  {isSubmitting ? 'Processing...' : 'Send support payment'}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default MonthlySupportPage;
