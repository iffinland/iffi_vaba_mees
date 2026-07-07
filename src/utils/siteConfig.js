export const OWNER_QORTIUM_NAME = 'iffi vaba mees';
export const OWNER_QORTIUM_ADDRESS = 'QWifxJWGbJZ6Yo6kiimFkBGcm4AxQefdUm';
export const APP_QORTIUM_NAME = 'iffi vaba mees';

export const isOwnerName = (name) =>
  typeof name === 'string' && name.trim().toLowerCase() === OWNER_QORTIUM_NAME;

export const isOwnerAddress = (address) =>
  typeof address === 'string' && address.trim() === OWNER_QORTIUM_ADDRESS;

export const isOwnerProfile = (profile) =>
  isOwnerName(profile?.name) || isOwnerAddress(profile?.address);
