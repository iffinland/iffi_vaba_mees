import { Link } from 'react-router-dom';
import { FaDatabase, FaHeart, FaTimes, FaUserPlus } from 'react-icons/fa';
import { useAudienceActions } from '../../hooks/useAudienceActions';
import { SUPPORT_ROUTE } from '../../services/monthlySupportService';
import styles from './AudienceActions.module.css';

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
};

const getSupportBadge = (supportStatus) => {
  if (!supportStatus || supportStatus.loading) return '';
  if (supportStatus.state === 'active') {
    return `Active until ${formatDate(supportStatus.record?.nextDueAt)}`;
  }
  if (supportStatus.state === 'due-soon') {
    return 'Renewal available soon';
  }
  if (supportStatus.state === 'ended') {
    return 'Support period ended';
  }
  return '';
};

const getSupportButtonText = (supportStatus) => {
  if (!supportStatus || supportStatus.loading) return 'Monthly Support';
  if (supportStatus.state === 'active') {
    return `Active until ${formatDate(supportStatus.record?.nextDueAt)}`;
  }
  if (supportStatus.state === 'due-soon') {
    return 'Renewal available soon';
  }
  if (supportStatus.state === 'ended') {
    return 'Renew support?';
  }
  return 'Monthly Support';
};

function AudienceActions() {
  const {
    canFollow,
    closeFollow,
    follow,
    followMessage,
    followNames,
    isFollowOpen,
    isSubmittingFollow,
    notice,
    openFollow,
    supportStatus,
  } = useAudienceActions();
  const supportBadge = getSupportBadge(supportStatus);
  const supportButtonText = getSupportButtonText(supportStatus);
  const hasSupportState = ['active', 'due-soon', 'ended'].includes(supportStatus.state);

  return (
    <div className={styles.shell}>
      {notice && <div className={styles.notice}>{notice}</div>}

      <div className={styles.actions} role="group" aria-label="Audience actions">
        <button type="button" className={styles.actionButton} onClick={openFollow}>
          <span className={styles.iconBadge}>
            <FaUserPlus />
          </span>
          <span>Follow</span>
        </button>

        <Link
          to={SUPPORT_ROUTE}
          className={`${styles.actionButton} ${hasSupportState ? styles.supportStateButton : ''} ${styles[supportStatus.state] || ''}`}
          aria-label={supportButtonText}
        >
          <span className={styles.iconBadge}>
            <FaHeart />
          </span>
          <span>{supportButtonText}</span>
        </Link>

        {supportBadge && supportStatus.state !== 'active' && (
          <span className={`${styles.statusBadge} ${styles[supportStatus.state]}`}>
            {supportBadge}
          </span>
        )}
      </div>

      {isFollowOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={closeFollow}>
          <section
            className={styles.followModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className={styles.modalClose} type="button" onClick={closeFollow} aria-label="Close">
              <FaTimes />
            </button>

            <p className={styles.eyebrow}>Qortium hosting support</p>
            <h2 id="follow-title">Follow iffi vaba mees</h2>
            <p>
              Following helps your local Qortium node mirror my published resources and makes this
              website easier for peers to retrieve.
            </p>

            <button
              className={styles.followChoice}
              type="button"
              onClick={follow}
              disabled={isSubmittingFollow || !canFollow || followNames.length === 0}
            >
              <FaDatabase />
              <span>
                <strong>Follow Website</strong>
                <small>{followNames.length > 0 ? followNames.join(', ') : 'No Qortium names found.'}</small>
              </span>
            </button>

            {!canFollow && (
              <p className={styles.followNote}>
                Open this website inside Qortium Home to enable follow controls.
              </p>
            )}
            {followMessage && (
              <p className={styles.followNote} role="status">
                {followMessage}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default AudienceActions;
