import React from 'react';
import styles from './LinkCard.module.css';

// Mähi komponent React.forwardRef-i, et saaksime ref-i edasi anda
const LinkCard = React.forwardRef(({ title, text, isVisible, index, iconSrc, iconNode }, ref) => {
  // Lisa viivitus animatsioonile, et kaardid ilmuksid üksteise järel
  const style = {
    transitionDelay: `${index * 100}ms`
  };

  return (
    // Lisa ref ja tingimuslikult 'isVisible' klass
    <div ref={ref} className={`${styles.card} ${isVisible ? styles.isVisible : ''}`} style={style}>
      <div className={styles.cardIcon}>
        {iconSrc && <img src={iconSrc} alt={`${title} icon`} />}
        {iconNode}
      </div>
      <div className={styles.cardContent}>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
});

export default LinkCard;
