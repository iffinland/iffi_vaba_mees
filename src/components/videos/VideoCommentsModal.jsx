import { useMemo, useState } from 'react';
import { FaEdit, FaReply, FaTimes } from 'react-icons/fa';
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

function VideoCommentsModal({
  comments,
  error,
  isLoading,
  isOpen,
  isSaving,
  onAddComment,
  onCommentPublished,
  onClose,
  onEditComment,
  profile,
  video,
}) {
  const [draft, setDraft] = useState('');
  const [editDrafts, setEditDrafts] = useState({});
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
    if (saved) {
      setDraft('');
      onCommentPublished?.(video);
    }
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
      onCommentPublished?.(video);
    }
  };

  const submitEdit = async (comment) => {
    const messageHtml = editDrafts[comment.id] || '';
    if (!stripHtml(messageHtml)) return;
    const saved = await onEditComment({ comment, messageHtml });
    if (saved) {
      setEditDrafts((current) => {
        const next = { ...current };
        delete next[comment.id];
        return next;
      });
    }
  };

  const canEditComment = (comment) =>
    Boolean(
      profile?.address &&
        (comment.authorAddress === profile.address || comment.authorName === profile.name),
    );

  const renderEditedTimestamp = (comment) => {
    if (!comment.updated || !comment.created || comment.updated <= comment.created) {
      return null;
    }

    return <span className={styles.editedTimestamp}>Edited {formatDate(comment.updated)}</span>;
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
                <div className={styles.timestamps}>
                  <span>{formatDate(comment.created)}</span>
                  {renderEditedTimestamp(comment)}
                </div>
              </div>
              {editDrafts[comment.id] !== undefined ? (
                <div className={styles.replyEditor}>
                  <RichTextEditor
                    value={editDrafts[comment.id]}
                    onChange={(value) =>
                      setEditDrafts((current) => ({
                        ...current,
                        [comment.id]: value,
                      }))
                    }
                    placeholder="Edit your comment"
                  />
                  <div className={styles.inlineActions}>
                    <button type="button" onClick={() => submitEdit(comment)} disabled={isSaving}>
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
                {canEditComment(comment) && (
                  <button
                    type="button"
                    className={styles.replyButton}
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
                        <div className={styles.timestamps}>
                          <span>{formatDate(reply.created)}</span>
                          {renderEditedTimestamp(reply)}
                        </div>
                      </div>
                      {editDrafts[reply.id] !== undefined ? (
                        <div className={styles.replyEditor}>
                          <RichTextEditor
                            value={editDrafts[reply.id]}
                            onChange={(value) =>
                              setEditDrafts((current) => ({
                                ...current,
                                [reply.id]: value,
                              }))
                            }
                            placeholder="Edit your reply"
                          />
                          <div className={styles.inlineActions}>
                            <button type="button" onClick={() => submitEdit(reply)} disabled={isSaving}>
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
                        <div dangerouslySetInnerHTML={{ __html: reply.messageHtml }} />
                      )}
                      {canEditComment(reply) && editDrafts[reply.id] === undefined && (
                        <div className={styles.commentActions}>
                          <button
                            type="button"
                            className={styles.replyButton}
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
      </div>
    </div>
  );
}

export default VideoCommentsModal;
