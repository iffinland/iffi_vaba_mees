// ── Ported from Blogs project — RichTextEditor (complete, with media + QDN) ──

import {
  Bold,
  Code,
  FileUp,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Quote,
  SmilePlus,
  Underline,
  Video,
  X,
  LayoutGrid,
} from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { QdnEmbedModal } from './QdnEmbedModal';
import {
  prepareBlogMedia,
  publishBlogImage,
  publishBlogVideo,
  publishBlogAttachment,
} from '../../services/blog/mediaService';
import {
  RICH_TEXT_FORMAT_TAGS,
  applyColorFormat,
  applyLinkFormat,
  applyListFormat,
  applyWrapFormat,
  encodeQdnMediaTag,
  insertAtSelection,
} from '../../services/blog/richText';

const formatButtons = [
  { type: 'bold', label: 'Bold', shortLabel: 'B', icon: Bold },
  { type: 'italic', label: 'Italic', shortLabel: 'I', icon: Italic },
  { type: 'underline', label: 'Underline', shortLabel: 'U', icon: Underline },
  { type: 'heading2', label: 'Heading', shortLabel: 'H2', icon: Heading2 },
  { type: 'heading3', label: 'Subheading', shortLabel: 'H3', icon: Heading3 },
  { type: 'quote', label: 'Quote', shortLabel: 'Quote', icon: Quote },
  { type: 'code', label: 'Code', shortLabel: 'Code', icon: Code },
  { type: 'link', label: 'Link', shortLabel: 'Link', icon: LinkIcon },
];

const emojiOptions = ['🙂', '😀', '😁', '😂', '😍', '🔥', '👍', '🙏', '🎉', '💡', '⭐', '❤️'];

const colorOptions = [
  '#111827',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
];

export function RichTextEditor({
  value,
  ownerName,
  accountNames,
  disabled = false,
  placeholder = 'Write your post...',
  onMediaQueued,
  onChange,
}) {
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const linkUrlInputRef = useRef(null);
  const [status, setStatus] = useState('');
  const [isLinkPopupOpen, setIsLinkPopupOpen] = useState(false);
  const [isEmojiPopupOpen, setIsEmojiPopupOpen] = useState(false);
  const [isColorPopupOpen, setIsColorPopupOpen] = useState(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [customColor, setCustomColor] = useState(colorOptions[0]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [savedSelection, setSavedSelection] = useState({ selectionStart: 0, selectionEnd: 0 });
  const isUploadDisabled = disabled || !ownerName;

  const focusSelection = useCallback((selectionStart, selectionEnd) => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  }, []);

  const applyResult = useCallback((result) => {
    onChange(result.value);
    focusSelection(result.nextSelectionStart, result.nextSelectionEnd);
  }, [onChange, focusSelection]);

  const getSelection = useCallback(() => ({
    selectionStart: textareaRef.current?.selectionStart ?? value.length,
    selectionEnd: textareaRef.current?.selectionEnd ?? value.length,
  }), [value]);

  const openLinkPopup = useCallback(() => {
    const selection = getSelection();
    const selectedText = value.slice(selection.selectionStart, selection.selectionEnd).trim();
    const selectedIsLink = selectedText.toLowerCase().startsWith('qdn://');
    setIsEmojiPopupOpen(false);
    setIsColorPopupOpen(false);
    setSavedSelection(selection);
    setLinkUrl(selectedIsLink ? selectedText : '');
    setLinkLabel(selectedIsLink ? '' : selectedText);
    setIsLinkPopupOpen(true);
    setStatus('');
    requestAnimationFrame(() => linkUrlInputRef.current?.focus());
  }, [value, getSelection]);

  const openEmojiPopup = useCallback(() => {
    setSavedSelection(getSelection());
    setIsLinkPopupOpen(false);
    setIsColorPopupOpen(false);
    setIsEmojiPopupOpen((current) => !current);
    setStatus('');
  }, [getSelection]);

  const openColorPopup = useCallback(() => {
    setSavedSelection(getSelection());
    setIsLinkPopupOpen(false);
    setIsEmojiPopupOpen(false);
    setIsColorPopupOpen((current) => !current);
    setStatus('');
  }, [getSelection]);

  const closeLinkPopup = useCallback(() => {
    setIsLinkPopupOpen(false);
    focusSelection(savedSelection.selectionStart, savedSelection.selectionEnd);
  }, [focusSelection, savedSelection]);

  const addLink = useCallback(() => {
    if (!linkUrl.trim()) {
      setStatus('Add a QDN link first.');
      requestAnimationFrame(() => linkUrlInputRef.current?.focus());
      return;
    }

    applyResult(
      applyLinkFormat({
        value,
        ...savedSelection,
        url: linkUrl,
        label: linkLabel,
      }),
    );
    setIsLinkPopupOpen(false);
    setLinkUrl('');
    setLinkLabel('');
    setStatus('Link inserted.');
  }, [linkUrl, linkLabel, value, savedSelection, applyResult]);

  const insertEmoji = useCallback((emoji) => {
    applyResult(insertAtSelection({ value, ...savedSelection, snippet: emoji }));
    setIsEmojiPopupOpen(false);
  }, [value, savedSelection, applyResult]);

  const applyTextColor = useCallback((color) => {
    applyResult(applyColorFormat({ value, ...savedSelection, color }));
    setIsColorPopupOpen(false);
  }, [value, savedSelection, applyResult]);

  useEffect(() => {
    if (!isLinkPopupOpen && !isEmojiPopupOpen && !isColorPopupOpen) return;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setIsLinkPopupOpen(false);
      setIsEmojiPopupOpen(false);
      setIsColorPopupOpen(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          savedSelection.selectionStart,
          savedSelection.selectionEnd,
        );
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isColorPopupOpen, isEmojiPopupOpen, isLinkPopupOpen, savedSelection]);

  const handleFormat = useCallback((format) => {
    if (format === 'link') {
      openLinkPopup();
      return;
    }

    const [openTag, closeTag] = RICH_TEXT_FORMAT_TAGS[format];
    applyResult(
      applyWrapFormat({
        value,
        ...getSelection(),
        openTag,
        closeTag,
        placeholder: 'text',
      }),
    );
  }, [value, getSelection, applyResult, openLinkPopup]);

  const handleList = useCallback((ordered) => {
    applyResult(applyListFormat({ value, ...getSelection(), ordered }));
  }, [value, getSelection, applyResult]);

  /**
   * Insert a block-level snippet with deterministic spacing.
   */
  const insertSnippet = useCallback((snippet) => {
    const { selectionStart, selectionEnd } = getSelection();
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);

    const normalizedBefore = before.replace(/\n+$/, '');
    const normalizedAfter = after.replace(/^\n+/, '');

    const sepBefore = normalizedBefore ? '\n\n' : '';
    const sepAfter = normalizedAfter ? '\n\n' : '';

    const cleanSnippet = snippet.trim();
    const result = `${normalizedBefore}${sepBefore}${cleanSnippet}${sepAfter}${normalizedAfter}`;
    const nextPos = normalizedBefore.length + sepBefore.length + cleanSnippet.length + sepAfter.length;

    applyResult({ value: result, nextSelectionStart: nextPos, nextSelectionEnd: nextPos });
  }, [value, getSelection, applyResult]);

  const uploadSelectedFile = useCallback(async (event, type) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isUploadDisabled) return;

    try {
      if (onMediaQueued) {
        const media = prepareBlogMedia(file, ownerName, type);
        onMediaQueued(media);
        insertSnippet(encodeQdnMediaTag(type, media.ref));
        setStatus(`${file.name} queued for publish.`);
        return;
      }

      setStatus(`Uploading ${type} to QDN...`);
      const ref =
        type === 'image'
          ? await publishBlogImage(file, ownerName)
          : type === 'video'
            ? await publishBlogVideo(file, ownerName)
            : await publishBlogAttachment(file, ownerName);
      insertSnippet(encodeQdnMediaTag(type, ref));
      setStatus(`${file.name} inserted.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to upload ${type}.`);
    }
  }, [isUploadDisabled, onMediaQueued, ownerName, insertSnippet]);

  const IconComponent = ({ icon: Icon, size = 17 }) =>
    Icon ? <Icon size={size} /> : null;

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" aria-label="Post formatting tools">
        {formatButtons.map((button) => (
          <button
            key={button.type}
            type="button"
            className="tool-button"
            title={button.label}
            aria-label={button.label}
            onMouseDown={(e) => { e.preventDefault(); handleFormat(button.type); }}
            disabled={disabled}
          >
            <span className="tool-icon">
              <IconComponent icon={button.icon} />
            </span>
            <span className="tool-label">{button.shortLabel}</span>
          </button>
        ))}
        {isLinkPopupOpen ? (
          <div className="editor-popover link-popover" role="dialog" aria-label="Add link">
            <div className="editor-popover-header">
              <span>Add link</span>
              <button type="button" onClick={closeLinkPopup} aria-label="Close link editor">
                <X size={16} />
              </button>
            </div>
            <label>
              Link
              <input
                ref={linkUrlInputRef}
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="qdn://APP/name/identifier"
              />
            </label>
            <label>
              Label
              <input
                value={linkLabel}
                onChange={(event) => setLinkLabel(event.target.value)}
                placeholder="Optional label"
              />
            </label>
            <div className="link-popover-actions">
              <button type="button" onClick={addLink}>
                Add
              </button>
              <button type="button" onClick={closeLinkPopup}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="tool-button"
          title="Insert emoji"
          aria-label="Insert emoji"
          onMouseDown={(e) => { e.preventDefault(); openEmojiPopup(); }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <SmilePlus size={17} />
          </span>
          <span className="tool-label">Emoji</span>
        </button>
        {isEmojiPopupOpen ? (
          <div className="editor-popover emoji-popover" role="dialog" aria-label="Insert emoji">
            <div className="editor-popover-header">
              <span>Insert emoji</span>
              <button
                type="button"
                onClick={() => setIsEmojiPopupOpen(false)}
                aria-label="Close emoji picker"
              >
                <X size={16} />
              </button>
            </div>
            <div className="emoji-grid">
              {emojiOptions.map((emoji) => (
                <button type="button" key={emoji} onMouseDown={(e) => { e.preventDefault(); insertEmoji(emoji); }}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="tool-button"
          title="Text color"
          aria-label="Text color"
          onMouseDown={(e) => { e.preventDefault(); openColorPopup(); }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <Palette size={17} />
          </span>
          <span className="tool-label">Color</span>
        </button>
        {isColorPopupOpen ? (
          <div className="editor-popover color-popover" role="dialog" aria-label="Text color">
            <div className="editor-popover-header">
              <span>Text color</span>
              <button
                type="button"
                onClick={() => setIsColorPopupOpen(false)}
                aria-label="Close color picker"
              >
                <X size={16} />
              </button>
            </div>
            <div className="color-grid">
              {colorOptions.map((color) => (
                <button
                  type="button"
                  key={color}
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => { e.preventDefault(); applyTextColor(color); }}
                  aria-label={`Use ${color}`}
                />
              ))}
            </div>
            <label className="custom-color-field">
              Custom
              <input
                type="color"
                value={customColor}
                onChange={(event) => setCustomColor(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="popover-primary-button"
              onMouseDown={(e) => { e.preventDefault(); applyTextColor(customColor); }}
            >
              Apply
            </button>
          </div>
        ) : null}
        <span className="toolbar-divider" />
        <button
          type="button"
          className="tool-button"
          title="Bulleted list"
          aria-label="Bulleted list"
          onMouseDown={(e) => { e.preventDefault(); handleList(false); }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <List size={17} />
          </span>
          <span className="tool-label">List</span>
        </button>
        <button
          type="button"
          className="tool-button"
          title="Numbered list"
          aria-label="Numbered list"
          onMouseDown={(e) => { e.preventDefault(); handleList(true); }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <ListOrdered size={17} />
          </span>
          <span className="tool-label">1.2.</span>
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className="tool-button"
          title="Upload image"
          aria-label="Upload image"
          onClick={() => imageInputRef.current?.click()}
          disabled={isUploadDisabled}
        >
          <span className="tool-icon">
            <ImagePlus size={17} />
          </span>
          <span className="tool-label">IMG</span>
        </button>
        <button
          type="button"
          className="tool-button"
          title="Upload video"
          aria-label="Upload video"
          onClick={() => videoInputRef.current?.click()}
          disabled={isUploadDisabled}
        >
          <span className="tool-icon">
            <Video size={17} />
          </span>
          <span className="tool-label">VID</span>
        </button>
        <button
          type="button"
          className="tool-button"
          title="Upload attachment"
          aria-label="Upload attachment"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadDisabled}
        >
          <span className="tool-icon">
            <FileUp size={17} />
          </span>
          <span className="tool-label">FILE</span>
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className="tool-button"
          title="Search, link, and insert QDN content"
          aria-label="Add QDN Content"
          onMouseDown={(e) => { e.preventDefault(); setIsEmbedModalOpen(true); }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <LayoutGrid size={17} />
          </span>
          <span className="tool-label">Add QDN Content</span>
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="rich-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(event) => void uploadSelectedFile(event, 'image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg"
        hidden
        onChange={(event) => void uploadSelectedFile(event, 'video')}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={(event) => void uploadSelectedFile(event, 'file')}
      />
      {status ? <div className="editor-status">{status}</div> : null}

      {isEmbedModalOpen ? (
        <QdnEmbedModal
          ownerName={ownerName}
          accountNames={accountNames?.length ? accountNames : (ownerName ? [ownerName] : [])}
          onInsert={(tag) => {
            insertSnippet(tag);
          }}
          onClose={() => setIsEmbedModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
