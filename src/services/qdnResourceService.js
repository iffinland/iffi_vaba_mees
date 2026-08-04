import { requestQortium } from './qortium/qortiumClient';

const QDN_READY_STATUS = 'READY';
const QDN_BUILDABLE_STATUSES = new Set([
  'PUBLISHED',
  'DOWNLOADING',
  'DOWNLOADED',
  'BUILDING',
]);
const QDN_TERMINAL_ERROR_STATUSES = new Set([
  'UNSUPPORTED',
  'BLOCKED',
  'NOT_PUBLISHED',
  'MISSING_DATA',
]);

const sleep = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const normalizeStatusField = (value) =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

const toFiniteNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

export const normalizeQdnStatus = (value) => {
  if (typeof value === 'string') {
    return {
      status: normalizeStatusField(value) || 'UNKNOWN',
      description: value,
    };
  }

  if (!value || typeof value !== 'object') {
    return { status: 'UNKNOWN' };
  }

  const localChunkCount =
    toFiniteNumber(value.localChunkCount) ??
    toFiniteNumber(value.localChunk_count) ??
    toFiniteNumber(value.localChunk);
  const totalChunkCount =
    toFiniteNumber(value.totalChunkCount) ??
    toFiniteNumber(value.totalChunk_count) ??
    toFiniteNumber(value.totalChunk);
  const percentLoaded =
    toFiniteNumber(value.percentLoaded) ??
    toFiniteNumber(value.percent_loaded) ??
    (localChunkCount !== undefined && totalChunkCount !== undefined && totalChunkCount > 0
      ? Math.round((localChunkCount / totalChunkCount) * 100)
      : undefined);

  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    status:
      normalizeStatusField(value.status) ||
      normalizeStatusField(value.localStatus) ||
      'UNKNOWN',
    description: typeof value.description === 'string' ? value.description : undefined,
    localChunkCount,
    totalChunkCount,
    percentLoaded,
  };
};

export const isQdnResourceReady = (status) =>
  normalizeStatusField(status) === QDN_READY_STATUS;

const shouldTriggerQdnBuild = (status) =>
  QDN_BUILDABLE_STATUSES.has(normalizeStatusField(status));

const isTerminalQdnError = (status) =>
  QDN_TERMINAL_ERROR_STATUSES.has(normalizeStatusField(status));

export const getQdnResourceStatus = async ({ service, name, identifier, build = false }) => {
  const result = await requestQortium({
    action: 'GET_QDN_RESOURCE_STATUS',
    service,
    name,
    identifier,
    ...(build ? { build: true } : {}),
  });

  return normalizeQdnStatus(result);
};

export const waitForQdnResourceReady = async ({
  service,
  name,
  identifier,
  timeoutMs = 45000,
  pollIntervalMs = 1500,
  onStatusChange,
}) => {
  const startedAt = Date.now();
  let buildTriggered = false;
  let latestStatus = { status: 'UNKNOWN' };

  while (Date.now() - startedAt <= timeoutMs) {
    latestStatus = await getQdnResourceStatus({
      service,
      name,
      identifier,
      build: false,
    });
    onStatusChange?.(latestStatus);

    if (isQdnResourceReady(latestStatus.status) || isTerminalQdnError(latestStatus.status)) {
      return latestStatus;
    }

    if (!buildTriggered && shouldTriggerQdnBuild(latestStatus.status)) {
      buildTriggered = true;
      latestStatus = await getQdnResourceStatus({
        service,
        name,
        identifier,
        build: true,
      });
      onStatusChange?.(latestStatus);

      if (isQdnResourceReady(latestStatus.status) || isTerminalQdnError(latestStatus.status)) {
        return latestStatus;
      }
    }

    await sleep(pollIntervalMs);
  }

  return latestStatus;
};

export const getQdnResourceUrl = async ({ service, name, identifier }) => {
  const result = await requestQortium({
    action: 'GET_QDN_RESOURCE_URL',
    service,
    name,
    identifier,
  });

  return typeof result === 'string' && result !== 'Resource does not exist' ? result : '';
};

// ---------------------------------------------------------------------------
// Batch publication helper
// ---------------------------------------------------------------------------

/**
 * Submits multiple QDN resources in a single PUBLISH_MULTIPLE_QDN_RESOURCES
 * bridge request with one combined Home approval dialog.
 *
 * The bridge processes resources sequentially in array order. It is NOT atomic:
 * later resources are still published after an earlier resource fails.
 * Successful resources remain published even when another resource fails.
 *
 * Callers MUST validate the returned { published, failures, complete } fields
 * and MUST NOT treat a truthy result alone as complete success.
 *
 * @param {Array<{
 *   service: string,
 *   name: string,
 *   identifier?: string,
 *   data64: string,
 *   encoding?: string,
 *   filename?: string,
 *   title?: string,
 *   description?: string,
 * }>} resources
 * @returns {Promise<{
 *   accepted: boolean,
 *   published: Array<{
 *     result: unknown,
 *     resource: { identifier: string|null, name: string, service: string },
 *     transactionSignature: string,
 *   }>,
 *   failures: Array<{
 *     error: string,
 *     resource: { identifier: string|null, name: string, service: string },
 *   }>,
 *   complete: boolean,
 * }>}
 */
export const publishMultipleQdnResources = async (resources) => {
  if (!Array.isArray(resources) || resources.length === 0) {
    throw new Error('At least one resource is required for batch publication.');
  }

  const result = await requestQortium({
    action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
    resources,
  });

  if (!result || typeof result !== 'object') {
    throw new Error('QDN batch publication returned an unexpected response.');
  }

  const published = Array.isArray(result.published) ? result.published : [];
  const failures = Array.isArray(result.failures) ? result.failures : [];

  return {
    accepted: result.accepted === true,
    published,
    failures,
    complete: failures.length === 0 && published.length === resources.length,
  };
};

/**
 * Builds a deterministic collision-safe resource identity key.
 *
 * @param {{ service: string, name: string, identifier?: string }} resource
 * @returns {string}
 */
export const buildResourceKey = ({ service, name, identifier }) =>
  `${service}:${name}:${identifier || ''}`;

/**
 * Validates a batch publication result against an expected set of resource keys.
 *
 * Returns null when the result is fully valid. Returns a structured error object
 * describing the first mismatch when validation fails.
 *
 * @param {ReturnType<typeof publishMultipleQdnResources>['published']} published
 * @param {ReturnType<typeof publishMultipleQdnResources>['failures']} failures
 * @param {Set<string>} expectedKeys - set of buildResourceKey outputs
 * @returns {null|{ reason: string, detail: string }}
 */
export const validateBatchResult = (published, failures, expectedKeys) => {
  if (!Array.isArray(published)) {
    return { reason: 'INVALID_RESPONSE', detail: 'published is not an array.' };
  }

  if (!Array.isArray(failures)) {
    return { reason: 'INVALID_RESPONSE', detail: 'failures is not an array.' };
  }

  if (failures.length > 0) {
    const first = failures[0];
    return {
      reason: 'PARTIAL_FAILURE',
      detail: `Batch publication failed for ${first?.resource?.service || 'unknown'}:${first?.resource?.identifier || ''} — ${first?.error || 'unknown error'}`,
    };
  }

  const publishedKeys = new Set(
    published.map((entry) =>
      buildResourceKey({
        service: entry.resource?.service,
        name: entry.resource?.name,
        identifier: entry.resource?.identifier,
      }),
    ),
  );

  if (publishedKeys.size !== published.length) {
    return { reason: 'DUPLICATE_RESULT', detail: 'Duplicate resource entries in batch response.' };
  }

  for (const key of expectedKeys) {
    if (!publishedKeys.has(key)) {
      return { reason: 'MISSING_RESOURCE', detail: `Expected resource not found in batch result: ${key}` };
    }
  }

  for (const key of publishedKeys) {
    if (!expectedKeys.has(key)) {
      return { reason: 'UNEXPECTED_RESOURCE', detail: `Unexpected resource in batch result: ${key}` };
    }
  }

  for (const entry of published) {
    if (!entry.transactionSignature || typeof entry.transactionSignature !== 'string') {
      return {
        reason: 'MISSING_SIGNATURE',
        detail: `Missing transaction signature for ${entry.resource?.service || 'unknown'}:${entry.resource?.identifier || ''}`,
      };
    }
  }

  return null;
};
