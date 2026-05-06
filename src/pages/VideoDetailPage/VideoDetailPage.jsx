import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaEdit, FaReply } from 'react-icons/fa';
import RichTextEditor from '../../components/common/RichTextEditor';
import VideoPublishModal from '../../components/videos/VideoPublishModal';
import { useVideoResource } from '../../hooks/useVideoResource';
import {
  fetchVideoByIdentifier,
  getCurrentUserProfile,
  updateVideo,
} from '../../services/videoService';
import {
  fetchVideoComments,
  publishVideoComment,
  updateVideoComment,
} from '../../services/videoEngagementService';
import styles from './VideoDetailPage.module.css';

const OWNER_QORTAL_NAME = 'iffi vaba mees';

const stripHtml = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value) => {
  if (!value) return 'No date selected';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function VideoDetailPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [isEditVideoOpen, setIsEditVideoOpen] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [editDrafts, setEditDrafts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfile(await getCurrentUserProfile());
      } catch (err) {
        console.warn('Unable to load Qortal profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const loadVideo = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextVideo = await fetchVideoByIdentifier(decodeURIComponent(videoId || ''));
        setVideo(nextVideo);
        if (nextVideo) {
          setComments(await fetchVideoComments(nextVideo.identifier));
        }
      } catch (err) {
        setError(err?.message || 'Unable to load video details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  const groups = useMemo(() => {
    const replies = comments.reduce((accumulator, comment) => {
      if (!comment.parentId) return accumulator;
      accumulator[comment.parentId] = accumulator[comment.parentId] || [];
      accumulator[comment.parentId].push(comment);
      return accumulator;
    }, {});

    return comments
      .filter((comment) => !comment.parentId)
      .map((comment) => ({
        comment,
        replies: replies[comment.id] || [],
      }));
  }, [comments]);

  const canEditVideo = profile.name.trim().toLowerCase() === OWNER_QORTAL_NAME;
  const playlists = video?.playlist ? [video.playlist] : [];
  const videoResource = useVideoResource(video);

  const canEditComment = (comment) =>
    Boolean(
      profile.address &&
        (comment.authorAddress === profile.address || comment.authorName === profile.name),
    );

  const renderEditedTimestamp = (comment) => {
    if (!comment.updated || !comment.created || comment.updated <= comment.created) {
      return null;
    }

    return <span className={styles.editedTimestamp}>Edited {formatDateTime(comment.updated)}</span>;
  };

  const addComment = async ({ messageHtml, parentId = '' }) => {
    if (!video || !stripHtml(messageHtml)) return false;
    if (!profile.name || !profile.address) {
      setError('A Qortal account with a registered name is required.');
      return false;
    }

    setIsSaving(true);
    setError('');

    try {
      const savedComment = await publishVideoComment({
        videoId: video.identifier,
        videoTitle: video.title,
        parentId,
        authorName: profile.name,
        authorAddress: profile.address,
        messageHtml,
        messageText: stripHtml(messageHtml),
      });
      setComments((current) => [...current, savedComment]);
      return true;
    } catch (err) {
      setError(err?.message || 'Unable to publish comment.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const editComment = async (comment) => {
    const messageHtml = editDrafts[comment.id] || '';
    if (!video || !stripHtml(messageHtml)) return false;
    if (!canEditComment(comment)) {
      setError('Only the comment author can edit this comment.');
      return false;
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedComment = await updateVideoComment({
        comment,
        videoTitle: video.title,
        authorName: profile.name,
        authorAddress: profile.address,
        messageHtml,
        messageText: stripHtml(messageHtml),
      });
      setComments((current) =>
        current.map((item) =>
          item.identifier === updatedComment.identifier ? updatedComment : item,
        ),
      );
      setEditDrafts((current) => {
        const next = { ...current };
        delete next[comment.id];
        return next;
      });
      return true;
    } catch (err) {
      setError(err?.message || 'Unable to update comment.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const submitComment = async () => {
    const saved = await addComment({ messageHtml: draft });
    if (saved) setDraft('');
  };

  const submitReply = async (parentId) => {
    const saved = await addComment({
      messageHtml: replyDrafts[parentId] || '',
      parentId,
    });
    if (saved) {
      setReplyDrafts((current) => {
        const next = { ...current };
        delete next[parentId];
        return next;
      });
    }
  };

  const saveVideoEdits = async (form) => {
    if (!video || !canEditVideo) {
      throw new Error('Only the site owner can edit this video.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedVideo = await updateVideo({
        video,
        form,
        authorName: profile.name,
      });
      setVideo(updatedVideo);
      setIsEditVideoOpen(false);
    } catch (err) {
      setError(err?.message || 'Unable to update video.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className={styles.status}>Loading video details...</p>;
  }

  if (!video) {
    return (
      <section className={styles.page}>
        <Link to="/videos" className={styles.backLink}>Back to videos</Link>
        <p className={styles.status}>{error || 'Video not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Link to="/videos" className={styles.backLink}>Back to videos</Link>

      <article className={styles.detail}>
        <div className={styles.mediaPanel}>
          {videoResource.resourceUrl ? (
            <video
              aria-label={video.title || 'Video player'}
              className={styles.videoPlayer}
              controls
              poster={video.thumbnailUrl || undefined}
              preload="metadata"
              src={videoResource.resourceUrl}
            />
          ) : (
            <>
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt={video.title || 'Video thumbnail'} />
              ) : (
                <div className={styles.placeholder}>Video</div>
              )}
              <div className={styles.playerStatus}>
                {videoResource.isLoading ? (
                  <span>
                    Video is syncing from QDN
                    {videoResource.progress ? ` (${videoResource.progress}%)` : '...'}
                  </span>
                ) : (
                  <span>
                    {videoResource.error ||
                      'This source cannot be played directly in the video player yet.'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.infoPanel}>
          <h1>{video.title || 'Untitled video'}</h1>
          <p className={styles.meta}>{formatDate(video.publishedDate)}</p>
          {video.performer && <p className={styles.strongMeta}>{video.performer}</p>}
          {video.playlist && <p className={styles.strongMeta}>{video.playlist}</p>}
          {canEditVideo && (
            <button
              type="button"
              className={styles.editVideoButton}
              onClick={() => setIsEditVideoOpen(true)}
            >
              <FaEdit />
              <span>Edit video</span>
            </button>
          )}
        </div>
      </article>

      <section className={styles.descriptionSection}>
        <h2>Description</h2>
        {video.descriptionHtml ? (
          <div
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: video.descriptionHtml }}
          />
        ) : (
          <p className={styles.status}>No description added yet.</p>
        )}
      </section>

      <section className={styles.commentsSection}>
        <h2>Comments</h2>
        <div className={styles.editorBlock}>
          <RichTextEditor value={draft} onChange={setDraft} placeholder="Add a comment" />
          <button type="button" onClick={submitComment} disabled={isSaving}>
            {isSaving ? 'Publishing...' : 'Publish comment'}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.commentList}>
          {groups.length === 0 && <p className={styles.status}>No comments yet.</p>}
          {groups.map(({ comment, replies }) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <strong>{comment.authorName}</strong>
                <div className={styles.timestamps}>
                  <span>{formatDateTime(comment.created)}</span>
                  {renderEditedTimestamp(comment)}
                </div>
              </div>

              {editDrafts[comment.id] !== undefined ? (
                <div className={styles.replyEditor}>
                  <RichTextEditor
                    value={editDrafts[comment.id]}
                    onChange={(value) =>
                      setEditDrafts((current) => ({ ...current, [comment.id]: value }))
                    }
                    placeholder="Edit your comment"
                  />
                  <div className={styles.inlineActions}>
                    <button type="button" onClick={() => editComment(comment)} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditDrafts((current) => {
                          const next = { ...current };
                          delete next[comment.id];
                          return next;
                        })
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.commentBody} dangerouslySetInnerHTML={{ __html: comment.messageHtml }} />
              )}

              <div className={styles.commentActions}>
                <button
                  type="button"
                  onClick={() =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [comment.id]: current[comment.id] || '',
                    }))
                  }
                >
                  <FaReply />
                  Reply
                </button>
                {canEditComment(comment) && editDrafts[comment.id] === undefined && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditDrafts((current) => ({
                        ...current,
                        [comment.id]: current[comment.id] || comment.messageHtml,
                      }))
                    }
                  >
                    <FaEdit />
                    Edit
                  </button>
                )}
              </div>

              {replyDrafts[comment.id] !== undefined && (
                <div className={styles.replyEditor}>
                  <RichTextEditor
                    value={replyDrafts[comment.id]}
                    onChange={(value) =>
                      setReplyDrafts((current) => ({ ...current, [comment.id]: value }))
                    }
                    placeholder="Add a reply"
                  />
                  <button type="button" onClick={() => submitReply(comment.id)} disabled={isSaving}>
                    {isSaving ? 'Publishing...' : 'Publish reply'}
                  </button>
                </div>
              )}

              {replies.length > 0 && (
                <div className={styles.replies}>
                  {replies.map((reply) => (
                    <div key={reply.id} className={styles.reply}>
                      <div className={styles.commentHeader}>
                        <strong>{reply.authorName}</strong>
                        <div className={styles.timestamps}>
                          <span>{formatDateTime(reply.created)}</span>
                          {renderEditedTimestamp(reply)}
                        </div>
                      </div>
                      {editDrafts[reply.id] !== undefined ? (
                        <div className={styles.replyEditor}>
                          <RichTextEditor
                            value={editDrafts[reply.id]}
                            onChange={(value) =>
                              setEditDrafts((current) => ({ ...current, [reply.id]: value }))
                            }
                            placeholder="Edit your reply"
                          />
                          <div className={styles.inlineActions}>
                            <button type="button" onClick={() => editComment(reply)} disabled={isSaving}>
                              {isSaving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditDrafts((current) => {
                                  const next = { ...current };
                                  delete next[reply.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.commentBody} dangerouslySetInnerHTML={{ __html: reply.messageHtml }} />
                      )}
                      {canEditComment(reply) && editDrafts[reply.id] === undefined && (
                        <div className={styles.commentActions}>
                          <button
                            type="button"
                            onClick={() =>
                              setEditDrafts((current) => ({
                                ...current,
                                [reply.id]: current[reply.id] || reply.messageHtml,
                              }))
                            }
                          >
                            <FaEdit />
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <VideoPublishModal
        editVideo={video}
        isOpen={canEditVideo && isEditVideoOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditVideoOpen(false)}
        onPublish={saveVideoEdits}
        playlists={playlists}
      />
    </section>
  );
}

export default VideoDetailPage;
