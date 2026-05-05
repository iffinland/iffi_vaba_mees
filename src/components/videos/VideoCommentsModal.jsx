import { useMemo, useState } from 'react';
import { FaReply, FaTimes } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import styles from './VideoCommentsModal.module.css';

const stripHtml = (html = '') =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function VideoCommentsModal({ comments, error, isLoading, isOpen, isSaving, onAddComment, onClose, video }) {
  const [draft, setDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});

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

  if (!isOpen) return null;

  const submitComment = async () => {
    if (!stripHtml(draft)) return;
    const saved = await onAddComment({ messageHtml: draft });
    if (saved) setDraft('');
  };

  const submitReply = async (parentId) => {
    const messageHtml = replyDrafts[parentId] || '';
    if (!stripHtml(messageHtml)) return;
    const saved = await onAddComment({ messageHtml, parentId });
    if (saved) {
      setReplyDrafts((current) => {
        const next = { ...current };
        delete next[parentId];
        return next;
      });
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2>Comments</h2>
            <p>{video?.title || 'Untitled video'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className={styles.editorBlock}>
          <RichTextEditor value={draft} onChange={setDraft} placeholder="Add a comment" />
          <button type="button" onClick={submitComment} disabled={isSaving}>
            {isSaving ? 'Publishing...' : 'Publish comment'}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {isLoading && <p className={styles.status}>Loading comments...</p>}

        <div className={styles.commentList}>
          {!isLoading && groups.length === 0 && <p className={styles.status}>No comments yet.</p>}
          {groups.map(({ comment, replies }) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <strong>{comment.authorName}</strong>
                <span>{formatDate(comment.created)}</span>
              </div>
              <div className={styles.commentBody} dangerouslySetInnerHTML={{ __html: comment.messageHtml }} />
              <button
                type="button"
                className={styles.replyButton}
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

              {replyDrafts[comment.id] !== undefined && (
                <div className={styles.replyEditor}>
                  <RichTextEditor
                    value={replyDrafts[comment.id]}
                    onChange={(value) =>
                      setReplyDrafts((current) => ({
                        ...current,
                        [comment.id]: value,
                      }))
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
                        <span>{formatDate(reply.created)}</span>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: reply.messageHtml }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VideoCommentsModal;
