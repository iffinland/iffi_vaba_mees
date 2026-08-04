import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Quote,
  SmilePlus,
  Underline,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  RICH_TEXT_FORMAT_TAGS,
  applyColorFormat,
  applyLinkFormat,
  applyListFormat,
  applyWrapFormat,
  insertAtSelection,
} from '../../../utils/richTextUtils';

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

const emojiOptions = [
  '🙂', '😀', '😁', '😂', '😍', '🔥', '👍', '🙏', '🎉', '💡', '⭐', '❤️',
];

const colorOptions = [
  '#111827', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#0891b2', '#2563eb', '#7c3aed',
];

export default function RichTextEditor({
  value,
  disabled = false,
  placeholder = 'Write here...',
  onChange,
}) {
  const textareaRef = useRef(null);
  const linkUrlInputRef = useRef(null);
  const [status, setStatus] = useState('');
  const [isLinkPopupOpen, setIsLinkPopupOpen] = useState(false);
  const [isEmojiPopupOpen, setIsEmojiPopupOpen] = useState(false);
  const [isColorPopupOpen, setIsColorPopupOpen] = useState(false);
  const [customColor, setCustomColor] = useState(colorOptions[0]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [savedSelection, setSavedSelection] = useState({
    selectionStart: 0,
    selectionEnd: 0,
  });

  // ── Selection helpers ───────────────────────────────────

  const focusSelection = (selectionStart, selectionEnd) => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const applyResult = (result) => {
    onChange(result.value);
    focusSelection(result.nextSelectionStart, result.nextSelectionEnd);
  };

  const getSelection = () => ({
    selectionStart: textareaRef.current?.selectionStart ?? value.length,
    selectionEnd: textareaRef.current?.selectionEnd ?? value.length,
  });

  // ── Popup management ────────────────────────────────────

  const openLinkPopup = () => {
    const selection = getSelection();
    const selectedText = value
      .slice(selection.selectionStart, selection.selectionEnd)
      .trim();
    const selectedIsLink = selectedText.toLowerCase().startsWith('qdn://');
    setIsEmojiPopupOpen(false);
    setIsColorPopupOpen(false);
    setSavedSelection(selection);
    setLinkUrl(selectedIsLink ? selectedText : '');
    setLinkLabel(selectedIsLink ? '' : selectedText);
    setIsLinkPopupOpen(true);
    setStatus('');
    requestAnimationFrame(() => linkUrlInputRef.current?.focus());
  };

  const openEmojiPopup = () => {
    setSavedSelection(getSelection());
    setIsLinkPopupOpen(false);
    setIsColorPopupOpen(false);
    setIsEmojiPopupOpen((current) => !current);
    setStatus('');
  };

  const openColorPopup = () => {
    setSavedSelection(getSelection());
    setIsLinkPopupOpen(false);
    setIsEmojiPopupOpen(false);
    setIsColorPopupOpen((current) => !current);
    setStatus('');
  };

  const closeLinkPopup = () => {
    setIsLinkPopupOpen(false);
    focusSelection(savedSelection.selectionStart, savedSelection.selectionEnd);
  };

  // ── Actions ─────────────────────────────────────────────

  const addLink = () => {
    if (!linkUrl.trim()) {
      setStatus('Add a link URL first.');
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
  };

  const insertEmoji = (emoji) => {
    applyResult(
      insertAtSelection({ value, ...savedSelection, snippet: emoji }),
    );
    setIsEmojiPopupOpen(false);
  };

  const applyTextColor = (color) => {
    applyResult(applyColorFormat({ value, ...savedSelection, color }));
    setIsColorPopupOpen(false);
  };

  // ── Escape key for popups ───────────────────────────────

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

  // ── Format handlers ─────────────────────────────────────

  const handleFormat = (format) => {
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
  };

  const handleList = (ordered) => {
    applyResult(applyListFormat({ value, ...getSelection(), ordered }));
  };

  // ── Render ──────────────────────────────────────────────

  const IconComponent = ({ icon: Icon, size = 17 }) =>
    Icon ? <Icon size={size} /> : null;

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" aria-label="Formatting tools">
        {formatButtons.map((button) => (
          <button
            key={button.type}
            type="button"
            className="tool-button"
            title={button.label}
            aria-label={button.label}
            aria-pressed={false}
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormat(button.type);
            }}
            disabled={disabled}
          >
            <span className="tool-icon">
              <IconComponent icon={button.icon} />
            </span>
            <span className="tool-label">{button.shortLabel}</span>
          </button>
        ))}

        {/* Link popup */}
        {isLinkPopupOpen ? (
          <div
            className="editor-popover link-popover"
            role="dialog"
            aria-label="Add link"
          >
            <div className="editor-popover-header">
              <span>Add link</span>
              <button
                type="button"
                onClick={closeLinkPopup}
                aria-label="Close link editor"
              >
                <X size={16} />
              </button>
            </div>
            <label>
              Link
              <input
                ref={linkUrlInputRef}
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://example.com"
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

        {/* Emoji button + popup */}
        <button
          type="button"
          className="tool-button"
          title="Insert emoji"
          aria-label="Insert emoji"
          onMouseDown={(e) => {
            e.preventDefault();
            openEmojiPopup();
          }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <SmilePlus size={17} />
          </span>
          <span className="tool-label">Emoji</span>
        </button>

        {isEmojiPopupOpen ? (
          <div
            className="editor-popover emoji-popover"
            role="dialog"
            aria-label="Insert emoji"
          >
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
                <button
                  type="button"
                  key={emoji}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertEmoji(emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Color button + popup */}
        <button
          type="button"
          className="tool-button"
          title="Text color"
          aria-label="Text color"
          onMouseDown={(e) => {
            e.preventDefault();
            openColorPopup();
          }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <Palette size={17} />
          </span>
          <span className="tool-label">Color</span>
        </button>

        {isColorPopupOpen ? (
          <div
            className="editor-popover color-popover"
            role="dialog"
            aria-label="Text color"
          >
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyTextColor(color);
                  }}
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
              onMouseDown={(e) => {
                e.preventDefault();
                applyTextColor(customColor);
              }}
            >
              Apply
            </button>
          </div>
        ) : null}

        <span className="toolbar-divider" />

        {/* List buttons */}
        <button
          type="button"
          className="tool-button"
          title="Bulleted list"
          aria-label="Bulleted list"
          onMouseDown={(e) => {
            e.preventDefault();
            handleList(false);
          }}
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
          onMouseDown={(e) => {
            e.preventDefault();
            handleList(true);
          }}
          disabled={disabled}
        >
          <span className="tool-icon">
            <ListOrdered size={17} />
          </span>
          <span className="tool-label">1.2.</span>
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

      {status ? <div className="editor-status">{status}</div> : null}
    </div>
  );
}
