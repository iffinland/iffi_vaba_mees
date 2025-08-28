import React, { useState, useEffect, useRef } from 'react';
import styles from './ContactPage.module.css';
import LinkCard from '../../components/LinkCard/LinkCard';
import { FaEnvelope, FaUserSecret, FaComments } from 'react-icons/fa';

function ContactPage() {
  const contactOptions = [
    { id: 'mail', href: 'mailto:example@example.com', title: 'Send mail', text: 'A direct and reliable way to get in touch for any inquiries.', icon: <FaEnvelope /> },
    { id: 'pm', href: '#', title: 'Send Private Message', text: 'For sensitive or private matters, use a secure messaging platform.', icon: <FaUserSecret /> },
    { id: 'chat', href: '#', title: 'Join chat', text: 'Join the community chat to discuss ideas and collaborate with others.', icon: <FaComments /> }
  ];

  const [visibleCards, setVisibleCards] = useState(() => Array(contactOptions.length).fill(false));
  const cardRefs = useRef([]);
  cardRefs.current = contactOptions.map((_, i) => cardRefs.current[i] ?? React.createRef());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = cardRefs.current.findIndex((ref) => ref.current === entry.target);
          if (index !== -1) {
            setVisibleCards((prev) => {
              const newVisible = [...prev];
              newVisible[index] = entry.isIntersecting;
              return newVisible;
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    cardRefs.current.forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => cardRefs.current.forEach((ref) => ref.current && observer.unobserve(ref.current));
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Contact Me</h1>
      <p>Here are the best ways to get in touch with me. Choose the one that suits your needs best.</p>
      <section className={styles.optionsSection}>
        {contactOptions.map((option, index) => (
          <a href={option.href} key={option.id} className={styles.linkWrapper} target="_blank" rel="noopener noreferrer">
            <LinkCard ref={cardRefs.current[index]} title={option.title} text={option.text} isVisible={visibleCards[index]} index={index} iconNode={option.icon} />
          </a>
        ))}
      </section>
    </div>
  );
}

export default ContactPage;