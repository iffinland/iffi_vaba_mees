import { useCallback, useMemo, useState } from 'react';
import { FaEnvelope, FaMusic, FaPenSquare, FaPlay, FaRegComments } from 'react-icons/fa';
import { OWNER_QMAIL_LINK } from '../utils/siteConfig';

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

  const links = useMemo(
    () => [
      {
        id: 'q-blog',
        label: 'Q-Blog',
        href: 'qortal://APP/Q-Blog/iffi%20vaba%20mees/iffi%20vaba%20mees',
        Icon: FaPenSquare,
      },
      {
        id: 'q-tube',
        label: 'Q-Tube',
        href: 'qortal://APP/Q-Tube/channel/iffi%20vaba%20mees/videos',
        Icon: FaPlay,
      },
      {
        id: 'q-music',
        label: 'Q-Music',
        href: 'qortal://APP/Q-Music',
        Icon: FaMusic,
      },
      {
        id: 'q-mail',
        label: 'Q-Mail',
        href: OWNER_QMAIL_LINK,
        Icon: FaEnvelope,
      },
    ],
    [],
  );

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
