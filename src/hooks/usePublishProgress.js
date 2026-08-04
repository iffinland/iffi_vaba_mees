import { useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Phase constants — honest, phase-based progress model
// ---------------------------------------------------------------------------
export const PUBLISH_PHASES = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  WAITING_FOR_MEDIA_APPROVAL: 'waiting-for-media-approval',
  PUBLISHING_MEDIA: 'publishing-media',
  VALIDATING_MEDIA: 'validating-media',
  WAITING_FOR_METADATA_APPROVAL: 'waiting-for-metadata-approval',
  PUBLISHING_METADATA: 'publishing-metadata',
  COMPLETE: 'complete',
  FAILED: 'failed',
};

// ---------------------------------------------------------------------------
// Resource statuses — real states only
// ---------------------------------------------------------------------------
export const RESOURCE_STATUS = {
  QUEUED: 'queued',
  PREPARING: 'preparing',
  PREPARED: 'prepared',
  SUBMITTED: 'submitted',
  PUBLISHED: 'published',
  FAILED: 'failed',
};

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------
const createInitialState = () => ({
  phase: PUBLISH_PHASES.IDLE,
  isModalOpen: false,
  current: 0,
  total: 0,
  resources: [],
  message: '',
  error: '',
  title: '',
  stage1Complete: false,
  stage2Complete: false,
  completeMessage: '',
});

/**
 * Reusable publication progress hook.
 *
 * Tracks phase-based (non-fabricated) progress for QDN publication workflows.
 * Designed for Gallery create initially; reusable for Gallery edit, Video,
 * Blog, Projects, and other publishing features.
 *
 * @returns {{
 *   state: object,
 *   startPublish: (title: string, total: number, resources: object[]) => void,
 *   updateProgress: (event: object) => void,
 *   finishSuccess: (message: string) => void,
 *   finishError: (error: string) => void,
 *   reset: () => void,
 * }}
 */
export const usePublishProgress = () => {
  const [state, setState] = useState(createInitialState);
  const resourceMapRef = useRef(new Map());

  const reset = useCallback(() => {
    resourceMapRef.current.clear();
    setState(createInitialState());
  }, []);

  const startPublish = useCallback((title, total, resources = []) => {
    resourceMapRef.current.clear();

    const initialResources = resources.map((r, index) => ({
      id: r.id || `resource-${index}`,
      label: r.label || `Resource ${index + 1}`,
      service: r.service || '',
      identifier: r.identifier || '',
      status: RESOURCE_STATUS.QUEUED,
      error: '',
    }));

    for (const resource of initialResources) {
      resourceMapRef.current.set(resource.id, resource);
    }

    setState({
      phase: PUBLISH_PHASES.PREPARING,
      isModalOpen: true,
      current: 0,
      total,
      resources: initialResources,
      message: 'Preparing media…',
      error: '',
      title: title || 'Publishing',
      stage1Complete: false,
      stage2Complete: false,
      completeMessage: '',
    });
  }, []);

  const updateProgress = useCallback((event) => {
    if (!event || typeof event !== 'object') return;

    const { phase, current, total, resource, resources, message, error, stage1Complete: explicitStage1, stage2Complete: explicitStage2 } = event;

    setState((prev) => {
      const next = { ...prev };

      if (phase) {
        next.phase = phase;

        // Phase-specific default messages
        switch (phase) {
          case PUBLISH_PHASES.PREPARING:
            next.message = message || 'Preparing media…';
            break;
          case PUBLISH_PHASES.WAITING_FOR_MEDIA_APPROVAL:
            next.message = message || 'Waiting for Qortium approval…\n\nPlease approve the media publication in the Qortium Home window.';
            break;
          case PUBLISH_PHASES.PUBLISHING_MEDIA:
            next.message = message || 'Publishing media resources through Qortium Home…';
            break;
          case PUBLISH_PHASES.VALIDATING_MEDIA:
            next.message = message || 'Checking publication results…';
            break;
          case PUBLISH_PHASES.WAITING_FOR_METADATA_APPROVAL:
            next.message = message || 'Gallery media published successfully.\n\nApprove the final Gallery information publication in Qortium Home.';
            // Only auto-set stage1Complete if not explicitly provided in event
            next.stage1Complete = explicitStage1 !== undefined ? explicitStage1 : true;
            break;
          case PUBLISH_PHASES.PUBLISHING_METADATA:
            next.message = message || 'Saving Gallery information…';
            break;
          case PUBLISH_PHASES.COMPLETE:
            next.message = message || 'Gallery published successfully.';
            next.stage2Complete = explicitStage2 !== undefined ? explicitStage2 : true;
            break;
          case PUBLISH_PHASES.FAILED:
            next.message = message || 'Publication failed.';
            next.error = error || message || '';
            break;
          default:
            if (message) next.message = message;
            break;
        }
      }

      // Allow explicit stage overrides outside of phase transitions
      if (explicitStage1 !== undefined) {
        next.stage1Complete = explicitStage1;
      }
      if (explicitStage2 !== undefined) {
        next.stage2Complete = explicitStage2;
      }

      if (typeof current === 'number' && current >= 0) {
        next.current = current;
      }

      if (typeof total === 'number' && total > 0) {
        next.total = total;
      }

      if (message && !phase) {
        next.message = message;
      }

      if (error) {
        next.error = error;
      }

      // Update individual resource in the resource map
      if (resource && resource.id) {
        const existing = resourceMapRef.current.get(resource.id);
        if (existing) {
          const updated = { ...existing, ...resource };
          resourceMapRef.current.set(resource.id, updated);
        }
      }

      // Bulk resource update from batch result validation
      if (Array.isArray(resources)) {
        for (const res of resources) {
          if (res.id) {
            const existing = resourceMapRef.current.get(res.id);
            if (existing) {
              resourceMapRef.current.set(res.id, { ...existing, ...res });
            }
          }
        }
      }

      // Rebuild resources array from map
      next.resources = Array.from(resourceMapRef.current.values());

      return next;
    });
  }, []);

  const finishSuccess = useCallback((message) => {
    setState((prev) => ({
      ...prev,
      phase: PUBLISH_PHASES.COMPLETE,
      stage2Complete: true,
      stage1Complete: true,
      completeMessage: message || 'Gallery published successfully.',
      message: message || 'Gallery published successfully.',
      error: '',
    }));
  }, []);

  const finishError = useCallback((errorMessage) => {
    setState((prev) => ({
      ...prev,
      phase: PUBLISH_PHASES.FAILED,
      error: errorMessage || 'Publication failed.',
      message: errorMessage || 'Publication failed.',
    }));
  }, []);

  return {
    state,
    startPublish,
    updateProgress,
    finishSuccess,
    finishError,
    reset,
  };
};
