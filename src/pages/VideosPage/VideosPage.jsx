import { useMemo, useState } from 'react';
import { FaPlus, FaSearch } from 'react-icons/fa';
import VideoCard from '../../components/videos/VideoCard';
import VideoCommentsModal from '../../components/videos/VideoCommentsModal';
import VideoPublishModal from '../../components/videos/VideoPublishModal';
import VideoTipModal from '../../components/videos/VideoTipModal';
import { useQortTip } from '../../hooks/useQortTip';
import { useVideoComments } from '../../hooks/useVideoComments';
import { useVideos } from '../../hooks/useVideos';
import styles from './VideosPage.module.css';

function VideosPage() {
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [toast, setToast] = useState('');
  const {
    error,
    filteredVideos,
    hasNextPage,
    isLoading,
    isPublishing,
    likeCounts,
    page,
    profile,
    publishNewVideo,
    searchQuery,
    setPage,
    setSearchQuery,
    setSortOrder,
    sortOrder,
    likeVideo,
  } = useVideos();

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const comments = useVideoComments({ profile, notify });
  const tip = useQortTip({ notify });

  const playlists = useMemo(
    () => filteredVideos.map((video) => video.playlist).filter(Boolean),
    [filteredVideos],
  );

  const handlePublish = async (form) => {
    await publishNewVideo(form);
    notify('Video published successfully.');
  };

  const handleShare = async (video) => {
    const route = `${window.location.origin}${window.location.pathname}${window.location.hash || '#/videos'}?video=${encodeURIComponent(video.identifier)}`;
    try {
      await navigator.clipboard.writeText(route);
      notify('Video link copied.');
    } catch {
      notify('Unable to copy link.');
    }
  };

  const handleLike = async (video) => {
    try {
      await likeVideo(video);
      notify('Video liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like video.');
    }
  };

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.hero}>
        <div>
          <h1>Videos</h1>
          <p>
            Browse videos published through my Qortal gallery. Search by title or
            description, sort the newest or oldest first, and open social actions from
            each card.
          </p>
        </div>
        <button type="button" className={styles.publishButton} onClick={() => setIsPublishOpen(true)}>
          <FaPlus />
          <span>Publish video</span>
        </button>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <FaSearch />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search videos"
          />
        </label>

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
        <p className={styles.status}>Loading videos...</p>
      ) : filteredVideos.length === 0 ? (
        <p className={styles.status}>No videos found.</p>
      ) : (
        <div className={styles.grid}>
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.identifier}
              video={video}
              likeCount={likeCounts[video.identifier] || 0}
              onComment={comments.openComments}
              onLike={handleLike}
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

      <VideoPublishModal
        isOpen={isPublishOpen}
        isPublishing={isPublishing}
        onClose={() => setIsPublishOpen(false)}
        onPublish={handlePublish}
        playlists={playlists}
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
        isOpen={Boolean(comments.activeVideo)}
        isSaving={comments.isSaving}
        onAddComment={comments.addComment}
        onClose={comments.closeComments}
        video={comments.activeVideo}
      />
    </section>
  );
}

export default VideosPage;
