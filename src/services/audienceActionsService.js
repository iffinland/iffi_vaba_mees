import { hasQortiumBridge } from './qortium/qortiumClient';
import { APP_QORTIUM_NAME, OWNER_QORTIUM_NAME } from '../utils/siteConfig';

export const getFollowNames = () =>
  [...new Set([OWNER_QORTIUM_NAME, APP_QORTIUM_NAME].map((name) => name?.trim()).filter(Boolean))];

export const canUseFollowAction = () => hasQortiumBridge() && getFollowNames().length > 0;

export const followWebsiteNames = async () => {
  throw new Error(
    'The Qortium list/follow API is not yet available in the current version of Qortium Home. ' +
      'This feature will be enabled in a future update.',
  );
};
