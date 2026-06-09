import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './InteractiveLinks.module.css';
import LinkCard from '../LinkCard/LinkCard';

// Impordime uued ikoonid
import iconWhoIAm from '../../assets/icon-who-i-am.png';
import iconMyWorld from '../../assets/icon-my-world.png';
import iconProject from '../../assets/icon-project.png';
import iconStorybook from '../../assets/icon-storybook.png';

function InteractiveLinks() {
  const links = [
    { id: 'who-i-am', path: '/post/who-i-am', title: 'Who I Am - why I voluntarily came to live in the forest', text: 'I will briefly write a little about myself here, why I live in the forest voluntarily and who I am...', icon: iconWhoIAm },
    { id: 'my-world', path: '/post/my-world', title: 'what kind of world I am creating for myself or where I want to live', text: 'For the moment i have already taken a small step towards my desired worlg', icon: iconMyWorld },
    { id: 'projects', path: '/projects', title: 'all my projects on Qortal and life', text: 'An overview of the projects I m working on - the list is not complete, I ve highlighted the most important ones for me', icon: iconProject },
    { id: 'storybook', path: '/storybook', title: 'my life storybook', text: 'Chronological chapters from my life journey, arranged by the time period they describe.', icon: iconStorybook }
  ];

  // State, mis hoiab iga kaardi nähtavuse staatust
  const [visibleCards, setVisibleCards] = useState(() => Array(links.length).fill(false));

  // Massiiv ref-idest iga kaardi elemendi jaoks
  const cardRefs = useRef([]);
  cardRefs.current = links.map((_, i) => cardRefs.current[i] ?? React.createRef());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Leia kaardi indeks
          const index = cardRefs.current.findIndex((ref) => ref.current === entry.target);
          if (index !== -1) {
            // Uuenda selle kaardi nähtavuse staatust vastavalt sellele,
            // kas see on ekraanil nähtav (isIntersecting) või mitte.
            setVisibleCards((prev) => {
              const newVisible = [...prev];
              newVisible[index] = entry.isIntersecting;
              return newVisible;
            });
          }
        });
      },
      {
        threshold: 0.2, // Käivita, kui 20% elemendist on nähtav
      }
    );

    cardRefs.current.forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => {
      cardRefs.current.forEach((ref) => {
        if (ref.current) observer.unobserve(ref.current);
      });
    };
  }, []);

  return (
    <section className={styles.linksSection}>
      {links.map((linkData, index) => (
        <Link to={linkData.path} key={linkData.id} className={styles.linkWrapper}>
          <LinkCard ref={cardRefs.current[index]} title={linkData.title} text={linkData.text} isVisible={visibleCards[index]} index={index} iconSrc={linkData.icon} />
        </Link>
      ))}
    </section>
  );
}

export default InteractiveLinks;
