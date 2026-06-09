import FooterSocialBar from '../FooterSocialBar/FooterSocialBar';
import styles from './Footer.module.css';

function Footer() {
  return (
    <footer className={styles.footer}>
      <FooterSocialBar />
    </footer>
  );
}

export default Footer;
