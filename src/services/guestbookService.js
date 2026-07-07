import {
  encodeObjectToBase64,
  getSelectedQortiumProfile,
  requestQortium,
} from './qortium/qortiumClient';

const ENTRY_IDENTIFIER_PREFIX = 'iffivabamees_guestbook_';
const ENTRY_SERVICE = 'DOCUMENT';
const SEARCH_PAGE_SIZE = 100;

const sanitizeNameSegment = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
};

const randomSuffix = () => Math.random().toString(36).slice(2, 10);

const generateEntryIdentifier = (authorName, authorAddress) => {
  const base =
    sanitizeNameSegment(authorName) ||
    sanitizeNameSegment(authorAddress) ||
    `guest`;
  return `${ENTRY_IDENTIFIER_PREFIX}${base}_${randomSuffix()}`;
};

const sanitizeEntry = (payload = {}, summary = {}) => {
  const message =
    typeof payload.message === 'string'
      ? payload.message.trim()
      : typeof summary.description === 'string'
        ? summary.description.trim()
        : '';
  if (!message) {
    return null;
  }

  const created = Number(payload.created ?? summary.created ?? Date.now());
  const updated = Number(payload.updated ?? summary.updated ?? created);
  const identifier = payload.identifier || summary.identifier;

  return {
    id: identifier,
    identifier,
    authorName:
      typeof payload.authorName === 'string' && payload.authorName.length > 0
        ? payload.authorName
        : typeof summary.name === 'string'
          ? summary.name
          : 'Unknown',
    authorAddress:
      typeof payload.authorAddress === 'string' ? payload.authorAddress : '',
    message,
    created,
    updated,
  };
};

const fetchSummaries = async () => {
  const aggregated = [];
  let offset = 0;

  while (true) {
    const page = await requestQortium({
      action: 'SEARCH_QDN_RESOURCES',
      service: ENTRY_SERVICE,
      mode: 'ALL',
      identifier: ENTRY_IDENTIFIER_PREFIX,
      prefix: true,
      limit: SEARCH_PAGE_SIZE,
      offset,
      reverse: true,
      includeStatus: true,
      excludeBlocked: true,
      exactMatchNames: false,
    });

    if (Array.isArray(page)) {
      aggregated.push(...page);
      if (page.length < SEARCH_PAGE_SIZE) {
        break;
      }
      offset += page.length;
    } else {
      break;
    }
  }

  return aggregated;
};

export const fetchGuestbookEntries = async () => {
  const summaries = await fetchSummaries();

  const entries = [];

  for (const summary of summaries) {
    if (
      !summary ||
      typeof summary.identifier !== 'string' ||
      !summary.identifier.startsWith(ENTRY_IDENTIFIER_PREFIX)
    ) {
      continue;
    }

    try {
      const resource = await requestQortium({
        action: 'FETCH_QDN_RESOURCE',
        service: ENTRY_SERVICE,
        name: summary.name,
        identifier: summary.identifier,
      });
      const sanitized = sanitizeEntry(resource ?? {}, summary);
      if (sanitized) {
        entries.push(sanitized);
      }
    } catch (error) {
      console.error('Failed to fetch guestbook entry', summary.identifier, error);
    }
  }

  return entries.sort(
    (a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0),
  );
};

export const getCurrentUserProfile = async () => {
  const profile = await getSelectedQortiumProfile();
  return {
    address: profile.address,
    names: profile.names,
    name: profile.name,
  };
};

export const publishGuestbookEntry = async ({
  message,
  authorName,
  authorAddress,
  existingIdentifier,
  created,
}) => {
  if (!authorName) {
    throw new Error('Qortium name is required to publish a guestbook entry.');
  }

  const identifier = existingIdentifier ?? generateEntryIdentifier(authorName, authorAddress);
  const now = Date.now();

  const payload = {
    id: identifier,
    identifier,
    authorName,
    authorAddress,
    message: message.trim(),
    created: created ?? now,
    updated: now,
  };

  await requestQortium({
    action: 'PUBLISH_QDN_RESOURCE',
    name: authorName,
    service: ENTRY_SERVICE,
    identifier,
    data64: encodeObjectToBase64(payload),
    encoding: 'base64',
    title: `Guestbook entry by ${authorName}`,
    description: payload.message.slice(0, 4000),
  });

  return payload;
};
