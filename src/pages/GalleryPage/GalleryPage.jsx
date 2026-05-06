import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import GalleryCard from '../../components/gallery/GalleryCard';
import GalleryPublishModal from '../../components/gallery/GalleryPublishModal';
import VideoCommentsModal from '../../components/videos/VideoCommentsModal';
import VideoTipModal from '../../components/videos/VideoTipModal';
import { useGalleries } from '../../hooks/useGalleries';
import { useGalleryComments } from '../../hooks/useGalleryComments';
import { useQortTip } from '../../hooks/useQortTip';
import styles from './GalleryPage.module.css';

const OWNER_QORTAL_NAME = 'iffi vaba mees';

function GalleryPage() {
  const navigate = useNavigate();
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [toast, setToast] = useState('');
  const {
    error,
    galleries,
    hasNextPage,
    isLoading,
    isPublishing,
    likeCounts,
    likeGallery,
    page,
    profile,
    publishNewGallery,
    setPage,
    setSortOrder,
    sortOrder,
  } = useGalleries();

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const comments = useGalleryComments({ profile, notify });
  const tip = useQortTip({ notify });
  const canPublishGalleries = profile.name.trim().toLowerCase() === OWNER_QORTAL_NAME;

  const openGalleryDetail = (gallery) => {
    navigate(`/gallery/${encodeURIComponent(gallery.identifier)}`);
  };

  const handlePublish = async (form) => {
    await publishNewGallery(form);
    notify('Gallery published successfully.');
  };

  const handleShare = async (gallery) => {
    const route = `${window.location.origin}${window.location.pathname}#/gallery/${encodeURIComponent(gallery.identifier)}`;
    try {
      await navigator.clipboard.writeText(route);
      notify('Gallery link copied.');
    } catch {
      notify('Unable to copy link.');
    }
  };

  const handleLike = async (gallery) => {
    try {
      await likeGallery(gallery);
      notify('Gallery liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like gallery.');
    }
  };

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.hero}>
        <div>
          <h1>Gallery</h1>
          <p>
            Browse image galleries published to QDN. Each gallery keeps its images,
            thumbnails, comments, and share links outside the application bundle.
          </p>
        </div>
        {canPublishGalleries && (
          <button type="button" className={styles.publishButton} onClick={() => setIsPublishOpen(true)}>
            <FaPlus />
            <span>Publish gallery</span>
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.sortBox}>
          Sort
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.status}>Loading galleries...</p>
      ) : galleries.length === 0 ? (
        <p className={styles.status}>No galleries found.</p>
      ) : (
        <div className={styles.grid}>
          {galleries.map((gallery) => (
            <GalleryCard
              gallery={gallery}
              key={gallery.identifier}
              likeCount={likeCounts[gallery.identifier] || 0}
              onComment={comments.openComments}
              onLike={handleLike}
              onOpen={openGalleryDetail}
              onShare={handleShare}
              onTip={tip.openTip}
            />
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || isLoading}>
          Previous
        </button>
        <span>Page {page}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={!hasNextPage || isLoading}>
          Next
        </button>
      </div>

      <GalleryPublishModal
        isOpen={canPublishGalleries && isPublishOpen}
        isPublishing={isPublishing}
        onClose={() => setIsPublishOpen(false)}
        onPublish={handlePublish}
      />

      <VideoTipModal
        amount={tip.amount}
        balance={tip.balance}
        error={tip.error}
        isLoading={tip.isLoading}
        isOpen={tip.isOpen}
        isSending={tip.isSending}
        onAmountChange={tip.setAmount}
        onClose={tip.closeTip}
        onSend={tip.sendTip}
        recipientAddress={tip.recipientAddress}
        video={tip.video}
      />

      <VideoCommentsModal
        comments={comments.comments}
        error={comments.error}
        isLoading={comments.isLoading}
        isOpen={Boolean(comments.activeEntity)}
        isSaving={comments.isSaving}
        onAddComment={comments.addComment}
        onClose={comments.closeComments}
        onEditComment={comments.editComment}
        profile={profile}
        video={comments.activeEntity}
      />
    </section>
  );
}

export default GalleryPage;
