import { requestQortal } from '../utils/qortalClient';

const OWNER_CHAT_ADDRESS = 'QRTUysZHKgxrdqsATotaffNVfFrD4KPE2Q';

const buildChatContent = (message) => ({
  messageText: {
    type: 'doc',
    content: message.split('\n').map((line) => ({
      type: 'paragraph',
      content: line
        ? [
            {
              type: 'text',
              text: line,
            },
          ]
        : [],
    })),
  },
  version: 3,
});

export const sendOwnerDirectMessage = async (message) => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error('Write a message before sending.');
  }

  return requestQortal({
    action: 'SEND_CHAT_MESSAGE',
    recipient: OWNER_CHAT_ADDRESS,
    fullContent: buildChatContent(trimmedMessage),
  });
};
