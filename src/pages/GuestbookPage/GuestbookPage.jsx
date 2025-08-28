import { useState } from 'react';
import styles from './GuestbookPage.module.css';
import { guestbookEntries } from '../../data/guestbookData';

function GuestbookPage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // In the future, this will send data to QDN
    console.log("New entry:", { name, message });
    alert("Thank you for your entry! (This is a demo, your message is not saved yet)");
    setName('');
    setMessage('');
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Guestbook</h1>
      <p className={styles.intro}>Feel free to leave a message, share a thought, or just say hello. All messages are welcome here.</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <textarea
          placeholder="Write something here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        <button type="submit">Save message to guestbook - THANK YOU 🤗</button>
      </form>

      <div className={styles.entries}>
        {guestbookEntries.map(entry => (
          <div key={entry.id} className={styles.entry}>
            <p className={styles.entryMessage}>"{entry.message}"</p>
            <div className={styles.entryMeta}>
              <strong>- {entry.name}</strong> on {entry.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GuestbookPage;