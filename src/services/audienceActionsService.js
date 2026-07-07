import { hasQortiumBridge, requestQortium } from './qortium/qortiumClient';
import { APP_QORTIUM_NAME, OWNER_QORTIUM_NAME } from '../utils/siteConfig';

const FOLLOWED_NAMES_LIST = 'followedNames';

export const getFollowNames = () =>
  [...new Set([OWNER_QORTIUM_NAME, APP_QORTIUM_NAME].map((name) => name?.trim()).filter(Boolean))];

export const canUseFollowAction = () => hasQortiumBridge() && getFollowNames().length > 0;

export const followWebsiteNames = async () => {
  const names = getFollowNames();

  await requestQortium({
    action: 'ADD_LIST_ITEMS',
    list_name: FOLLOWED_NAMES_LIST,
    items: names,
  });

  return names;
};
