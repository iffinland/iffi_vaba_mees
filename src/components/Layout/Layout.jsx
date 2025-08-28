import styles from './Layout.module.css';
import collageImage from '../../assets/collage.jpg';

// Layout komponent võtab vastu "children", mis on kõik elemendid,
// mis me talle App.jsx-is sisse anname (Header, Welcome jne).
function Layout({ children }) {
  return (
    <div className={styles.container}>
      <div className={styles.textColumn}>
        {children}
      </div>
      <div className={styles.collageColumn}>
        <img src={collageImage} alt="Collage" className={styles.collageImage} />
      </div>
    </div>
  );
}

export default Layout;

