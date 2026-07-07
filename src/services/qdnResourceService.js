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
