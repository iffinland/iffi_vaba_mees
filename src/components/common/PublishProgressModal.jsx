import { useEffect, useRef } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaSpinner, FaTimes } from 'react-icons/fa';
import { PUBLISH_PHASES, RESOURCE_STATUS } from '../../hooks/usePublishProgress';
import styles from './PublishProgressModal.module.css';

// ---------------------------------------------------------------------------
// Status icons (accessible — text alongside icons)
// ---------------------------------------------------------------------------
const ResourceStatusIcon = ({ status }) => {
  switch (status) {
    case RESOURCE_STATUS.PUBLISHED:
      return (
        <span className={styles.statusIcon} title="Published">
          <FaCheckCircle className={styles.iconSuccess} aria-hidden="true" />
        </span>
      );
    case RESOURCE_STATUS.FAILED:
      return (
        <span className={styles.statusIcon} title="Failed">
          <FaExclamationCircle className={styles.iconFailed} aria-hidden="true" />
        </span>
      );
    case RESOURCE_STATUS.PREPARING:
    case RESOURCE_STATUS.SUBMITTED:
      return (
        <span className={styles.statusIcon} title="In progress">
          <FaSpinner className={styles.iconActive} aria-hidden="true" />
        </span>
      );
    default:
      return (
        <span className={styles.statusIcon} title="Waiting">
          <span className={styles.iconWaiting} aria-hidden="true">○</span>
        </span>
      );
  }
};

// ---------------------------------------------------------------------------
// Determinate progress bar
// ---------------------------------------------------------------------------
const DeterminateBar = ({ current, total }) => {
  const width = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={styles.progressBarTrack} role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total} aria-label={`${current} of ${total} resources prepared`}>
      <div className={styles.progressBarFill} style={{ width: `${width}%` }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Indeterminate progress bar
// ---------------------------------------------------------------------------
const IndeterminateBar = () => (
  <div className={styles.progressBarTrack} role="progressbar" aria-label="Publication in progress">
    <div className={styles.indeterminateFill} />
  </div>
);

// ---------------------------------------------------------------------------
// Resource list row
// ---------------------------------------------------------------------------
const ResourceRow = ({ resource }) => (
  <div className={`${styles.resourceRow} ${resource.status === RESOURCE_STATUS.FAILED ? styles.resourceRowFailed : ''}`}>
    <ResourceStatusIcon status={resource.status} />
    <span className={styles.resourceService}>{resource.service}</span>
    <span className={styles.resourceLabel}>{resource.label}</span>
    {resource.error && <span className={styles.resourceError}>{resource.error}</span>}
  </div>
);

// ---------------------------------------------------------------------------
// PublishProgressModal
// ---------------------------------------------------------------------------

/**
 * Reusable publication progress modal.
 *
 * Displays honest, phase-based progress for QDN publication workflows.
 * Does NOT fabricate byte percentages or use timers to simulate progress.
 *
 * Props:
 * - isOpen: boolean
 * - title: string (modal title)
 * - phase: string (PUBLISH_PHASES value)
 * - current: number (determinate progress numerator)
 * - total: number (determinate progress denominator)
 * - resources: Array<{ id, label, service, identifier, status, error }>
 * - message: string (current phase message)
 * - error: string (error message for failed state)
 * - stage1Complete: boolean
 * - stage2Complete: boolean
 * - canClose: boolean
 * - onClose: () => void
 * - onDone: () => void (shown on complete instead of close)
 */
function PublishProgressModal({
  isOpen,
  title = 'Publishing',
  phase,
  current = 0,
  total = 0,
  resources = [],
  message = '',
  stage1Complete = false,
  stage2Complete = false,
  canClose = true,
  onClose,
  onDone,
}) {
  const doneButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousPhaseRef = useRef(phase);

  // Focus management: focus "Done" button when complete, "Close" button when failed
  useEffect(() => {
    if (phase === PUBLISH_PHASES.COMPLETE && previousPhaseRef.current !== PUBLISH_PHASES.COMPLETE) {
      doneButtonRef.current?.focus();
    } else if (phase === PUBLISH_PHASES.FAILED && previousPhaseRef.current !== PUBLISH_PHASES.FAILED) {
      closeButtonRef.current?.focus();
    }
    previousPhaseRef.current = phase;
  }, [phase]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (event) => {
      if (event.key === 'Escape' && canClose) {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, canClose, onClose]);

  if (!isOpen) return null;

  const isComplete = phase === PUBLISH_PHASES.COMPLETE;
  const isFailed = phase === PUBLISH_PHASES.FAILED;
  const isActive = !isComplete && !isFailed;
  const showDeterminate = phase === PUBLISH_PHASES.PREPARING && total > 0;
  const showIndeterminate = isActive && !showDeterminate;
  const showResourceList = resources.length > 0 && (phase === PUBLISH_PHASES.PREPARING || phase === PUBLISH_PHASES.FAILED || isComplete);

  // Split message lines for rendering
  const messageLines = message ? message.split('\n') : [];

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-progress-title"
      onClick={canClose ? onClose : undefined}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 id="publish-progress-title">
            {isComplete && <FaCheckCircle className={styles.headerIconSuccess} aria-hidden="true" />}
            {isFailed && <FaExclamationCircle className={styles.headerIconFailed} aria-hidden="true" />}
            {isActive && <FaSpinner className={styles.headerIconActive} aria-hidden="true" />}
            {' '}
            {title}
          </h2>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              ref={closeButtonRef}
              className={styles.closeButton}
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* Phase status — live region for major transitions */}
        <div className={styles.phaseStatus} aria-live="polite">
          {/* Stage indicators */}
          <div className={styles.stageIndicators}>
            <div className={`${styles.stageBadge} ${stage1Complete || isComplete ? styles.stageDone : isActive && phase !== PUBLISH_PHASES.PREPARING ? styles.stageActive : ''}`}>
              {stage1Complete || isComplete ? '✓' : '1'} Media
            </div>
            <div className={styles.stageConnector} />
            <div className={`${styles.stageBadge} ${stage2Complete ? styles.stageDone : phase === PUBLISH_PHASES.PUBLISHING_METADATA || phase === PUBLISH_PHASES.WAITING_FOR_METADATA_APPROVAL ? styles.stageActive : ''}`}>
              {stage2Complete ? '✓' : '2'} Info
            </div>
          </div>

          {/* Progress bar */}
          {showDeterminate && (
            <div className={styles.progressSection}>
              <DeterminateBar current={current} total={total} />
              <p className={styles.progressCount}>
                {current} of {total} resources prepared
              </p>
            </div>
          )}

          {showIndeterminate && (
            <div className={styles.progressSection}>
              <IndeterminateBar />
            </div>
          )}

          {/* Message */}
          <div className={`${styles.messageBlock} ${isFailed ? styles.messageFailed : ''} ${isComplete ? styles.messageSuccess : ''}`}>
            {messageLines.map((line, index) => (
              <p key={index} className={styles.messageLine}>{line || '\u00A0'}</p>
            ))}
          </div>

          {/* Current step detail (preparation phase) */}
          {phase === PUBLISH_PHASES.PREPARING && resources.length > 0 && (
            <p className={styles.currentStep}>
              Current step: {resources.find(r => r.status === RESOURCE_STATUS.PREPARING)?.label || 'Preparing…'}
            </p>
          )}
        </div>

        {/* Resource list */}
        {showResourceList && (
          <div className={styles.resourceList} role="list" aria-label="Resource status">
            {resources.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className={styles.footer}>
          {isComplete && onDone && (
            <button
              type="button"
              className={styles.doneButton}
              onClick={onDone}
              ref={doneButtonRef}
            >
              Done
            </button>
          )}
          {isFailed && (
            <button
              type="button"
              className={styles.closeButtonText}
              onClick={onClose}
              ref={closeButtonRef}
            >
              Close
            </button>
          )}
          {isActive && (
            <p className={styles.activeHint}>Please keep this window open.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublishProgressModal;
