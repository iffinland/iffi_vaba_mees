import { useCallback, useMemo, useState } from 'react';
import { FaRegComments } from 'react-icons/fa';

export const useFooterSocialActions = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }, []);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const links = useMemo(() => [], []);

  const chatAction = useMemo(
    () => ({
      id: 'chat',
      label: "Let's chat",
      Icon: FaRegComments,
      onClick: openChat,
    }),
    [openChat],
  );

  return {
    chatAction,
    closeChat,
    isChatOpen,
    links,
    notice,
    showNotice,
  };
};
