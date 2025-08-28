import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

function Footer() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.footerNav}>
        <Link to="/">Home</Link>
        <Link to="/post/who-i-am">Who I Am</Link>
        <Link to="/post/my-world">My World</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/gallery">Gallery</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/guestbook">Guestbook</Link>
      </nav>
      <div className={styles.footerInfo}>
        <span>since 2021 @ iffi vaba mees</span>
        <span><a href="qortal://WEBSITE/Qortal%20Web%20Builders">Made by Qortal Web Builders</a></span>
      </div>
    </footer>
  );
}

export default Footer;
