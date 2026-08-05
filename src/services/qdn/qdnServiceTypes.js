// ── QDN Service type constants (ported from Blogs project) ──

/** Confirmed image-capable services (Core: IMAGE=400, THUMBNAIL=410, QCHAT_IMAGE=420, IMAGE_GALLERY=430, GIF_REPOSITORY=1200). */
export const IMAGE_CAPABLE_SERVICES = [
  'IMAGE', 'THUMBNAIL', 'QCHAT_IMAGE', 'IMAGE_GALLERY', 'GIF_REPOSITORY',
];

/** All 40 PUBLIC QDN services sourced from qortium-home/electron/qdn-public-services.ts. */
export const QDN_SERVICES = [
  'APP', 'WEBSITE',
  'IMAGE', 'THUMBNAIL', 'QCHAT_IMAGE', 'IMAGE_GALLERY', 'GIF_REPOSITORY',
  'VIDEO',
  'AUDIO', 'VOICE', 'PODCAST',
  'DOCUMENT', 'FILE', 'FILES',
  'JSON', 'METADATA',
  'BLOG', 'BLOG_POST', 'BLOG_COMMENT',
  'LIST', 'PLAYLIST',
  'GIT_REPOSITORY',
  'STORE', 'PRODUCT', 'OFFER', 'COUPON',
  'CODE', 'PLUGIN', 'EXTENSION',
  'GAME', 'ITEM', 'NFT',
  'DATABASE', 'SNAPSHOT',
  'COMMENT', 'CHAIN_COMMENT', 'CHAIN_DATA',
  'ATTACHMENT',
  'MAIL', 'MESSAGE',
];
