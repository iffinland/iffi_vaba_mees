export const OWNER_QORTAL_NAME = 'iffi vaba mees';
export const APP_QORTAL_NAME = 'iffi vaba mees';

export const isOwnerName = (name) =>
  typeof name === 'string' && name.trim().toLowerCase() === OWNER_QORTAL_NAME;
