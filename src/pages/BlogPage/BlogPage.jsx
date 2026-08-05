import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import BlogCard from '../../components/blog/BlogCard';
import BlogPublishModal from '../../components/blog/BlogPublishModal';
import { useBlogPosts } from '../../hooks/useBlogPosts';
import { buildBlogPageLink } from '../../services/blogService';
import { isOwnerProfile } from '../../utils/siteConfig';
import { copyTextToClipboard } from '../../utils/videoLinks';
import styles from './BlogPage.module.css';

function BlogPage() {
  const navigate = useNavigate();
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [toast, setToast] = useState('');
  const {
    categories,
    commentCounts,
    error,
    hasNextPage,
    isLoading,
    isPublishing,
    likeCounts,
    likePost,
    page,
    posts,
    profile,
    publishNewPost,
    searchQuery,
    selectedCategory,
    selectedTag,
    setPage,
    setSearchQuery,
    setSelectedCategory,
    setSortOrder,
    setTagFilter,
    sortOrder,
    tagInventory,
  } = useBlogPosts();

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const canPublishPosts = isOwnerProfile(profile);

  const openPostDetail = (post) => {
    navigate(`/blog/${encodeURIComponent(post.identifier)}`);
  };

  const handlePublish = async (form, options = {}) => {
    await publishNewPost(form, options);
    notify('Blog post published successfully.');
  };

  const handleShare = async (post) => {
    try {
      await copyTextToClipboard(buildBlogPageLink(post));
      notify('Blog post link copied.');
    } catch {
      notify('Sharing is temporarily disabled until Qortium Home confirms the supported app deep-link format.');
    }
  };

  const handleLike = async (post) => {
    try {
      await likePost(post);
      notify('Blog post liked.');
    } catch (err) {
      notify(err?.message || 'Unable to like blog post.');
    }
  };

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.hero}>
        <div>
          <h1>Blog</h1>
        </div>
        {canPublishPosts && (
          <button type="button" className={styles.publishButton} onClick={() => setIsPublishOpen(true)}>
            <FaPlus />
            <span>Publish post</span>
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <FaSearch />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search blog"
          />
        </label>

        <label className={styles.sortBox}>
          Sort
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>

        <label className={styles.sortBox}>
          Categories
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedTag && (
        <div className={styles.tagFilterBar}>
          <span>
            Posts tagged &ldquo;{selectedTag}&rdquo;
          </span>
          <button
            type="button"
            className={styles.clearTagButton}
            onClick={() => setTagFilter('')}
            aria-label={`Clear tag filter: ${selectedTag}`}
          >
            <FaTimes size={12} />
            <span>Clear tag filter</span>
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.status}>Loading blog posts...</p>
      ) : posts.length === 0 ? (
        selectedTag ? (
          <p className={styles.status}>
            No posts found with the tag &ldquo;{selectedTag}&rdquo;.
            {' '}
            <button
              type="button"
              className={styles.inlineClearButton}
              onClick={() => setTagFilter('')}
            >
              Clear tag filter
            </button>
          </p>
        ) : (
          <p className={styles.status}>No blog posts found.</p>
        )
      ) : (
        <div className={styles.grid}>
          {posts.map((post) => (
            <BlogCard
              key={post.identifier}
              commentCount={commentCounts[post.identifier]}
              likeCount={likeCounts[post.identifier] || 0}
              onComment={openPostDetail}
              onLike={handleLike}
              onOpenDetail={openPostDetail}
              onShare={handleShare}
              post={post}
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

      <BlogPublishModal
        categories={categories}
        isOpen={canPublishPosts && isPublishOpen}
        isPublishing={isPublishing}
        ownerName={profile?.name || ''}
        accountNames={profile?.names || (profile?.name ? [profile.name] : [])}
        onClose={() => setIsPublishOpen(false)}
        onPublish={handlePublish}
        tagInventory={tagInventory}
      />
    </section>
  );
}

export default BlogPage;
