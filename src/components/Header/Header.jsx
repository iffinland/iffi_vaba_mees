import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import { FaImages, FaBookOpen, FaPenSquare, FaVideo, FaEnvelope, FaHome } from 'react-icons/fa';

function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.navigation}>
        <Link to="/" className={styles.navButton} aria-label="Home">
          <FaHome />
        </Link>
        <Link to="/gallery" className={styles.navButton} aria-label="Gallery">
          <FaImages />
        </Link>
        <Link to="/guestbook" className={styles.navButton} aria-label="Guestbook">
          <FaBookOpen />
        </Link>
        <a href="qortal://APP/Q-Blog/iffi%20vaba%20mees/q-blog-iffi%20vaba%20mees" className={styles.navButton} aria-label="Q-Blog">
          <FaPenSquare />
        </a>
        <Link to="/videos" className={styles.navButton} aria-label="Videos">
          <FaVideo />
        </Link>
        <a href="qortal://APP/Q-Mail/to/iffi%20vaba%20mees" className={styles.navButton} aria-label="Q-Mail">
          <FaEnvelope />
        </a>
      </nav>
    </header>
  );
}

export default Header;
