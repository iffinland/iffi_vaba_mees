import { useState } from 'react';
import styles from './GalleryPage.module.css';
import { albums } from '../../data/galleryData';

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";

function GalleryPage() {
  const [activeAlbumIndex, setActiveAlbumIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const activeAlbum = albums[activeAlbumIndex];

  const openLightbox = (imageIndex) => {
    setLightboxIndex(imageIndex);
    setLightboxOpen(true);
  };

  return (
    <div className={styles.galleryContainer}>
      <h1 className={styles.title}>my life in pictures</h1>
      <h4><i><center>I will be launching a full image gallery app soon. Here is a selection of just a few pictures from thousands that have been snapped over the past few years.</center></i></h4>
      <div className={styles.albumSelector}>
        {albums.map((album, index) => (
          <button
            key={album.name}
            className={`${styles.albumButton} ${index === activeAlbumIndex ? styles.active : ''}`}
            onClick={() => setActiveAlbumIndex(index)}
          >
            {album.name}
          </button>
        ))}
      </div>

      <div className={styles.imageGrid}>
        {activeAlbum.slides.map((slide, index) => (
          <div key={slide.src} className={styles.imageWrapper} onClick={() => openLightbox(index)}>
            <img src={slide.src} alt={slide.title} className={styles.thumbnail} />
          </div>
        ))}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={activeAlbum.slides}
        index={lightboxIndex}
        plugins={[Thumbnails, Fullscreen]}
      />
    </div>
  );
}

export default GalleryPage;