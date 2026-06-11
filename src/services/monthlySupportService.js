import {
  createShortId,
  encodeObjectToBase64,
  hasQortalBridge,
  requestQortal,
  sanitizeIdentifierSegment,
} from '../utils/qortalClient';
import { OWNER_QORTAL_NAME } from '../utils/siteConfig';
import { getCurrentUserProfile } from './videoService';

export const SUPPORT_ROUTE = '/support';
export const SUPPORT_RECORD_PREFIX = 'ivm_sup_';
export const SUPPORT_SERVICE = 'PRODUCT';
export const SUPPORT_INTERVAL_DAYS = 30;
export const SUPPORT_PRESET_AMOUNTS = [5, 10, 25];
export const SUPPORT_MIN_CUSTOM_AMOUNT = 25;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IDENTIFIER_LENGTH = 60;

const toFixedQort = (amount) => Number(amount).toFixed(2);

const toFiniteAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const buildSupportIdentifier = ({ supporterName, supporterAddress }) => {
  const base =
    sanitizeIdentifierSegment(supporterName) ||
    sanitizeIdentifierSegment(supporterAddress) ||
    'supporter';
  const suffix = `${Date.now().toString(36)}_${createShortId()}`;
  const maxBaseLength = Math.max(
    8,
    MAX_IDENTIFIER_LENGTH - SUPPORT_RECORD_PREFIX.length - suffix.length - 1,
  );

  return `${SUPPORT_RECORD_PREFIX}${base.slice(0, maxBaseLength)}_${suffix}`;
};

export const resolveOwnerAddress = async () => {
  const response = await requestQortal({
    action: 'GET_NAME_DATA',
    name: OWNER_QORTAL_NAME,
  });

  if (!response?.owner) {
    throw new Error('Unable to resolve the support recipient address.');
  }

  return response.owner;
};

export const sendSupportPayment = async ({ recipientAddress, amount }) => {
  const response = await requestQortal({
    action: 'SEND_COIN',
    coin: 'QORT',
    recipient: recipientAddress,
    amount,
  });

  if (!response?.signature) {
    throw new Error('Payment failed: no transaction signature was returned.');
  }

  return response.signature;
};

export const publishSupportRecord = async ({
  amount,
  ownerAddress,
  paymentTxSignature,
  supporterAddress,
  supporterName,
}) => {
  if (!supporterName) {
    throw new Error('A Qortal name is required to publish a support record.');
  }

  const paidAt = Date.now();
  const nextDueAt = paidAt + SUPPORT_INTERVAL_DAYS * DAY_MS;
  const identifier = buildSupportIdentifier({ supporterName, supporterAddress });
  const amountQort = toFixedQort(amount);

  const payload = {
    schema: 'ivm-monthly-support@v1',
    id: identifier,
    identifier,
    ownerName: OWNER_QORTAL_NAME,
    ownerAddress,
    supporterName,
    supporterAddress,
    amountQort,
    intervalDays: SUPPORT_INTERVAL_DAYS,
    paymentTxSignature,
    paidAt,
    nextDueAt,
    created: paidAt,
  };

  await requestQortal({
    action: 'PUBLISH_QDN_RESOURCE',
    name: supporterName,
    service: SUPPORT_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Monthly support for ${OWNER_QORTAL_NAME}`.slice(0, 80),
    description: `${amountQort} QORT monthly support record`,
  });

  return payload;
};

export const createMonthlySupportPayment = async ({ amount }) => {
  const normalizedAmount = toFiniteAmount(amount);
  if (normalizedAmount <= 0) {
    throw new Error('Choose a valid QORT amount.');
  }

  const [supporterProfile, ownerAddress] = await Promise.all([
    getCurrentUserProfile(),
    resolveOwnerAddress(),
  ]);

  if (!supporterProfile.address || !supporterProfile.name) {
    throw new Error('A Qortal account with a registered name is required.');
  }

  const paymentTxSignature = await sendSupportPayment({
    recipientAddress: ownerAddress,
    amount: normalizedAmount,
  });

  return publishSupportRecord({
    amount: normalizedAmount,
    ownerAddress,
    paymentTxSignature,
    supporterAddress: supporterProfile.address,
    supporterName: supporterProfile.name,
  });
};

const sanitizeSupportRecord = (payload = {}, summary = {}) => {
  const identifier = payload.identifier || summary.identifier;
  if (!identifier || !String(identifier).startsWith(SUPPORT_RECORD_PREFIX)) {
    return null;
  }

  const amount = toFiniteAmount(payload.amountQort);
  const paidAt = Number(payload.paidAt ?? payload.created ?? summary.created ?? 0);
  const intervalDays = Number(payload.intervalDays ?? SUPPORT_INTERVAL_DAYS);
  const nextDueAt =
    Number(payload.nextDueAt) ||
    (paidAt > 0 ? paidAt + Math.max(1, intervalDays) * DAY_MS : 0);

  if (!amount || !paidAt || !nextDueAt) {
    return null;
  }

  return {
    id: identifier,
    identifier,
    ownerName: payload.ownerName || OWNER_QORTAL_NAME,
    ownerAddress: typeof payload.ownerAddress === 'string' ? payload.ownerAddress : '',
    supporterName: typeof payload.supporterName === 'string' ? payload.supporterName : summary.name || '',
    supporterAddress:
      typeof payload.supporterAddress === 'string' ? payload.supporterAddress : '',
    amountQort: toFixedQort(amount),
    intervalDays,
    paymentTxSignature:
      typeof payload.paymentTxSignature === 'string' ? payload.paymentTxSignature : '',
    paidAt,
    nextDueAt,
    created: Number(payload.created ?? paidAt),
  };
};

const fetchSupportRecord = async (summary) => {
  try {
    const payload = await requestQortal({
      action: 'FETCH_QDN_RESOURCE',
      service: SUPPORT_SERVICE,
      name: summary.name,
      identifier: summary.identifier,
    });

    return sanitizeSupportRecord(payload, summary);
  } catch (error) {
    console.warn('Failed to fetch support record', summary?.identifier, error);
    return null;
  }
};

const fetchCurrentSupportRecords = async ({ supporterName, limit = 12 }) => {
  const summaries = await requestQortal({
    action: 'SEARCH_QDN_RESOURCES',
    service: SUPPORT_SERVICE,
    mode: 'ALL',
    name: supporterName,
    identifier: SUPPORT_RECORD_PREFIX,
    prefix: true,
    exactMatchNames: true,
    reverse: true,
    limit,
    offset: 0,
    includeStatus: true,
    includeMetadata: true,
    excludeBlocked: true,
  });

  const records = await Promise.all(
    (Array.isArray(summaries) ? summaries : []).map(fetchSupportRecord),
  );

  return records
    .filter(Boolean)
    .sort((a, b) => Number(b.paidAt) - Number(a.paidAt));
};

export const getMonthlySupportStatus = async () => {
  if (!hasQortalBridge()) {
    return { state: 'unavailable', record: null };
  }

  const profile = await getCurrentUserProfile();
  if (!profile.address || !profile.name) {
    return { state: 'needs-name', record: null };
  }

  const records = await fetchCurrentSupportRecords({ supporterName: profile.name });
  const record = records[0] ?? null;

  if (!record) {
    return { state: 'none', record: null, profile };
  }

  const now = Date.now();
  const timeRemainingMs = record.nextDueAt - now;
  const isActive = timeRemainingMs > 0;
  const isDueSoon = isActive && timeRemainingMs <= 3 * DAY_MS;

  return {
    state: isActive ? (isDueSoon ? 'due-soon' : 'active') : 'ended',
    record,
    profile,
    timeRemainingMs,
  };
};
