// ── Ported from Blogs project — QdnPreviewModal ──

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, ExternalLink, Copy, RotateCw, FileText, Eye, EyeOff } from 'lucide-react';
import { buildQdnAddress } from '../../services/qdn/embedService';
import { resolvePreview } from '../../services/qdn/previewService';
import { requestQortium } from '../../services/qortium/qortiumClient';

export function QdnPreviewModal({ target, displayName, onClose }) {
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [showSource, setShowSource] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    let active = true;

    setPhase('loading');
    setError('');
    setResult(null);

    void resolvePreview(target, ac.signal)
      .then((r) => {
        if (!active) return;
        // Native viewer — delegate to Home, don't show Blogs modal
        if (r.kind === 'native-viewer') {
          void requestQortium({
            action: 'OPEN_QDN_DOCUMENT_VIEWER',
            service: r.service,
            name: r.name,
            identifier: r.identifier,
            filename: r.filename ?? undefined,
            path: undefined,
          }).catch(() => {
            setError('Qortium Home document viewer is not available. Use Open in QDN instead.');
            setPhase('error');
          }).finally(() => {
            if (active) onClose();
          });
          return;
        }
        setResult(r); setPhase('ready');
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Preview failed.');
        setPhase('error');
      });

    return () => {
      active = false;
      ac.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.service, target.name, target.identifier, target.path, target.filename, onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const openInQdn = () => {
    const addr = buildQdnAddress(target.service, target.name, target.identifier);
    void requestQortium({ action: 'OPEN_NEW_TAB', address: addr }).catch(() => {
      window.open(addr, '_blank');
    });
  };

  const copyLink = async () => {
    const addr = buildQdnAddress(target.service, target.name, target.identifier);
    try {
      await navigator.clipboard.writeText(addr);
    } catch {
      // fallback silent
    }
  };

  const downloadUrl = result && ('url' in result) ? result.url : undefined;
  const resolvedDisplayName = displayName || target.filename || target.identifier;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={`Preview: ${resolvedDisplayName}`}>
        {/* Header */}
        <div className="modal-header">
          <div className="preview-header-info">
            <span className="qdn-embed-badge">{target.service}</span>
            <strong className="preview-filename">{resolvedDisplayName}</strong>
            <span className="preview-identity">{target.name} · {target.identifier}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close preview"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="preview-body">
          {phase === 'loading' && <PreviewLoading />}
          {phase === 'error' && <PreviewError message={error} />}
          {phase === 'ready' && result && <PreviewContent result={result} showSource={showSource} />}
        </div>

        {/* Footer */}
        <div className="modal-actions">
          {result?.kind === 'markdown' ? (
            <button type="button" className="command-button" onClick={() => setShowSource((s) => !s)}>
              {showSource ? <Eye size={14} /> : <EyeOff size={14} />}
              {showSource ? 'Rendered' : 'Source'}
            </button>
          ) : null}
          <button type="button" className="command-button" onClick={copyLink}><Copy size={14} /> Copy link</button>
          {downloadUrl ? (
            <a className="command-button" href={downloadUrl} target="_blank" rel="noreferrer" download>
              <Download size={14} /> Download
            </a>
          ) : null}
          <button type="button" className="command-button" onClick={openInQdn}><ExternalLink size={14} /> Open in QDN</button>
          {phase === 'error' ? (
            <button type="button" className="command-button" onClick={() => {
              setPhase('loading'); setError('');
              const ac = new AbortController(); abortRef.current = ac;
              void resolvePreview(target, ac.signal).then((r) => { setResult(r); setPhase('ready'); }).catch((e) => {
                setError(e instanceof Error ? e.message : 'Preview failed.'); setPhase('error');
              });
            }}><RotateCw size={14} /> Retry</button>
          ) : null}
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function PreviewLoading() {
  return <div className="preview-loading"><span className="preview-spinner" /> Preparing preview…</div>;
}

function PreviewError({ message }) {
  return <div className="preview-error"><FileText size={48} /><p>{message}</p></div>;
}

function PreviewContent({ result, showSource }) {
  switch (result.kind) {
    case 'image': return <PreviewImage url={result.url} />;
    case 'video': return <video className="preview-video" src={result.url} controls preload="metadata" />;
    case 'audio':
      return (
        <div className="preview-audio"><FileText size={48} /><audio controls preload="metadata" src={result.url} /></div>
      );
    case 'native-viewer': return null; // Handled before modal renders
    case 'markdown':
      return showSource ? <pre className="preview-text">{result.text}</pre> : <SafeMarkdown text={result.text} />;
    case 'text': return <pre className="preview-text">{result.text}</pre>;
    case 'json': return <pre className="preview-text">{result.text}</pre>;
    case 'unsupported':
      return (
        <div className="preview-unsupported">
          <EyeOff size={48} />
          <p>{result.reason || 'Preview not available for this file type.'}</p>
          {result.mimeType ? <p className="preview-mime">{result.mimeType}</p> : null}
        </div>
      );
  }
}

function PreviewImage({ url }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) return <PreviewError message="Failed to load image." />;
  return <img className="preview-image" src={url} alt="" onError={() => setImgError(true)} />;
}

// ── Safe Markdown renderer ──────────────────────────────────

function SafeMarkdown({ text }) {
  const html = useMemo(() => renderMarkdownSafe(text), [text]);
  return <div className="preview-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

const renderMarkdownSafe = (text) => {
  let html = text
    // Escape existing HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links: only allow qdn:// and https://
    .replace(/\[([^\]]+)\]\((qdn:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // Remove any remaining markdown-style links that weren't matched (unsafe protocols)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Paragraphs: double newlines
    .replace(/\n\n+/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap in paragraphs
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs and combine adjacent lists
  html = html.replace(/<p><\/p>/g, '');

  return html;
};
