import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import {
  FaImages,
  FaBookOpen,
  FaPenSquare,
  FaVideo,
  FaEnvelope,
  FaHome,
  FaRegComments,
} from 'react-icons/fa';
import AudienceActions from '../AudienceActions/AudienceActions';
import DirectMessageModal from '../DirectMessageModal/DirectMessageModal';
import { OWNER_QMAIL_LINK } from '../../utils/siteConfig';

function Header() {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  return (
    <header className={styles.header}>
      {notice && <div className={styles.notice}>{notice}</div>}
      <AudienceActions />
      <nav className={styles.navigation}>
        <Link to="/" className={styles.navButton} aria-label="Home">
          <FaHome />
        </Link>
        <Link to="/blog" className={styles.navButton} aria-label="Blog">
          <FaPenSquare />
        </Link>
        <Link to="/gallery" className={styles.navButton} aria-label="Image gallery">
          <FaImages />
        </Link>
        <Link to="/videos" className={styles.navButton} aria-label="Video gallery">
          <FaVideo />
        </Link>
        <Link to="/guestbook" className={styles.navButton} aria-label="Guestbook">
          <FaBookOpen />
        </Link>
        <a href={OWNER_QMAIL_LINK} className={styles.navButton} aria-label="Q-Mail">
          <FaEnvelope />
        </a>
        <button
          type="button"
          className={styles.navButton}
          aria-label="Let's chat"
          onClick={() => setIsMessageModalOpen(true)}
        >
          <FaRegComments />
        </button>
      </nav>
      <DirectMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        onSent={showNotice}
      />
    </header>
  );
}

export default Header;
