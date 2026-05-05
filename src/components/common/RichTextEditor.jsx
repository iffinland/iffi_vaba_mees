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

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const runCommand = (command) => {
    document.execCommand(command, false, null);
    onChange(editorRef.current?.innerHTML || '');
  };

  const addLink = () => {
    const url = window.prompt('Paste a link');
    if (!url) return;
    document.execCommand('createLink', false, url);
    onChange(editorRef.current?.innerHTML || '');
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
            onClick={() => runCommand(item.command)}
          >
            {item.icon}
          </button>
        ))}
        <button type="button" title="Add link" aria-label="Add link" onClick={addLink}>
          <FaLink />
        </button>
      </div>
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
      />
    </div>
  );
}

export default RichTextEditor;
