import { useEffect, useRef } from 'react';
import styles from './RichTextEditor.module.css';
import { FaBold, FaItalic, FaLink, FaListOl, FaListUl } from 'react-icons/fa';

const commands = [
  { command: 'bold', label: 'Bold', icon: <FaBold /> },
  { command: 'italic', label: 'Italic', icon: <FaItalic /> },
  { command: 'insertUnorderedList', label: 'Bullet list', icon: <FaListUl /> },
  { command: 'insertOrderedList', label: 'Numbered list', icon: <FaListOl /> },
];

function RichTextEditor({ value, onChange, placeholder = 'Write here...' }) {
  const editorRef = useRef(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (
      editorRef.current &&
      !isFocusedRef.current &&
      editorRef.current.innerHTML !== value
    ) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const runCommand = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    onChange(editorRef.current?.innerHTML || '');
  };

  const addLink = () => {
    const url = window.prompt('Paste a link');
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand('createLink', false, url);
    onChange(editorRef.current?.innerHTML || '');
  };

  const keepEditorSelection = (event) => {
    event.preventDefault();
  };

  return (
    <div className={styles.editorShell}>
      <div className={styles.toolbar} aria-label="Formatting tools">
        {commands.map((item) => (
          <button
            key={item.command}
            type="button"
            title={item.label}
            aria-label={item.label}
            onMouseDown={keepEditorSelection}
            onClick={() => runCommand(item.command)}
          >
            {item.icon}
          </button>
        ))}
        <button
          type="button"
          title="Add link"
          aria-label="Add link"
          onMouseDown={keepEditorSelection}
          onClick={addLink}
        >
          <FaLink />
        </button>
      </div>
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
        }}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
      />
    </div>
  );
}

export default RichTextEditor;
