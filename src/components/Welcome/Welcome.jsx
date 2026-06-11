import { useState } from 'react';
import styles from './Welcome.module.css';
import avatarImage from '../../assets/avatar.png';
import DirectMessageModal from '../DirectMessageModal/DirectMessageModal';

function Welcome() {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  return (
    <section className={styles.welcomeSection}>
      {notice && <div className={styles.notice}>{notice}</div>}
      <div className={styles.titleContainer}>
        <img src={avatarImage} alt="Avatar" className={styles.avatar} />
        <h2>Welcome to iffi's World 🤗</h2>
      </div>
      <p>
        My life changed completely on December 15, 2021. Until then, I was just an ordinary CITIZEN —going to work, living in a rented apartment, and following the usual routines of everyday life...
      </p>
      <p>Now, my world is filled with freedom, happiness, and kindness. It is a place where small communities and communes thrive in a spirit of friendship, mutual support, and care. Here, people help one another selflessly, without seeking profit or taking advantage of others.</p>
      <button className={styles.chatButton} type="button" onClick={() => setIsMessageModalOpen(true)}>
        Let's chat &rarr;
      </button>
      <DirectMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        onSent={showNotice}
      />
    </section>
  );
}

export default Welcome;
