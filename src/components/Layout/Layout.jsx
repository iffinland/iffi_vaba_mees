import { useLocation } from 'react-router-dom';
import styles from './Layout.module.css';
import collageImage from '../../assets/collage.jpg';

function Layout({ children }) {
  const location = useLocation();
  const isWidePage =
    location.pathname.startsWith('/videos') ||
    location.pathname.startsWith('/gallery') ||
    location.pathname.startsWith('/blog') ||
    location.pathname.startsWith('/storybook') ||
    (location.pathname.startsWith('/projects/') && location.pathname !== '/projects');

  return (
    <div className={`${styles.container} ${isWidePage ? styles.widePage : ''}`}>
      <div className={styles.textColumn}>
        {children}
      </div>
      {!isWidePage && (
        <div className={styles.collageColumn}>
          <img src={collageImage} alt="Collage" className={styles.collageImage} />
        </div>
      )}
    </div>
  );
}

export default Layout;
