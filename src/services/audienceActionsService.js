import { hasQortalBridge, requestQortal } from '../utils/qortalClient';
import { APP_QORTAL_NAME, OWNER_QORTAL_NAME } from '../utils/siteConfig';

const FOLLOWED_NAMES_LIST = 'followedNames';

export const getFollowNames = () =>
  [...new Set([OWNER_QORTAL_NAME, APP_QORTAL_NAME].map((name) => name?.trim()).filter(Boolean))];

export const canUseFollowAction = () => hasQortalBridge() && getFollowNames().length > 0;

export const followWebsiteNames = async () => {
  const names = getFollowNames();

  await requestQortal({
    action: 'ADD_LIST_ITEMS',
    list_name: FOLLOWED_NAMES_LIST,
    items: names,
  });

  return names;
};
