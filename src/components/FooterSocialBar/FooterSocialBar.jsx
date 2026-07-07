import DirectMessageModal from '../DirectMessageModal/DirectMessageModal';
import { useFooterSocialActions } from '../../hooks/useFooterSocialActions';
import styles from './FooterSocialBar.module.css';

function FooterSocialBar() {
  const { chatAction, closeChat, isChatOpen, links, notice, showNotice } =
    useFooterSocialActions();
  const ChatIcon = chatAction.Icon;

  return (
    <div className={styles.shell}>
      {notice && <div className={styles.notice}>{notice}</div>}

      <nav className={styles.socialNav} aria-label="Qortium social actions">
        {links.map((item) => {
          const LinkIcon = item.Icon;

          return (
            <a key={item.id} className={styles.actionButton} href={item.href} aria-label={item.label}>
              <span className={styles.iconBadge}>
                <LinkIcon />
              </span>
              <span>{item.label}</span>
            </a>
          );
        })}

        <button
          type="button"
          className={styles.actionButton}
          onClick={chatAction.onClick}
          aria-label={chatAction.label}
        >
          <span className={styles.iconBadge}>
            <ChatIcon />
          </span>
          <span>{chatAction.label}</span>
        </button>
      </nav>

      <DirectMessageModal isOpen={isChatOpen} onClose={closeChat} onSent={showNotice} />
    </div>
  );
}

export default FooterSocialBar;
