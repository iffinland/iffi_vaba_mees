// ── Ported from Blogs project — RichTextContent renderer ──

import { Download, Eye, Maximize } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getQdnResourceUrl } from '../../services/qdn/qdnService';
import { useQdnImageUrl } from '../../services/qdn/useQdnImageUrl';
import { decodeQdnEmbedPayload } from '../../services/qdn/embedService';
import { getSafeLinkHref, autolinkText } from '../../services/blog/richText';
import { requestQortium } from '../../services/qortium/qortiumClient';
import { QdnEmbedCard } from './QdnEmbedCard';
import { QdnPreviewModal } from '../preview/QdnPreviewModal';

// ── Link type classification ───────────────────────────────

const classifyLinkHref = (href) => {
  const lower = href.toLowerCase();
  if (lower.startsWith('qdn://') || lower.startsWith('home://') || lower.startsWith('core://')) {
    return 'internal-nav';
  }
  if (lower.startsWith('https://') || lower.startsWith('http://')) return 'web';
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) return 'local';
  return 'blocked';
};

// ── Internal-link navigation (Qortium Home OPEN_NEW_TAB) ────

const openInternalLink = async (address) => {
  try {
    await requestQortium({ action: 'OPEN_NEW_TAB', address });
  } catch {
    window.open(address, '_blank');
  }
};

// ── Clipboard ───────────────────────────────────────────────

const copyWithTextarea = (value) => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.setAttribute('readonly', 'readonly');
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
};

const copyText = async (value) => {
  if (copyWithTextarea(value)) return true;
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return copyWithTextarea(value);
  }
};

// ── RichLink ────────────────────────────────────────────────

const COPY_BADGE_MS = 1800;

function RichLink({ href, children }) {
  const kind = classifyLinkHref(href);
  const [copyState, setCopyState] = useState('idle');
  const timerRef = useRef(undefined);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleClick = useCallback(
    async (event) => {
      if (kind === 'internal-nav') {
        event.preventDefault();
        await openInternalLink(href);
        return;
      }
      if (kind === 'web') {
        event.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        const ok = await copyText(href);
        setCopyState(ok ? 'copied' : 'failed');
        timerRef.current = setTimeout(() => setCopyState('idle'), COPY_BADGE_MS);
      }
    },
    [href, kind],
  );

  if (kind === 'blocked') return <span>{children}</span>;

  return (
    <span className="rich-link-wrapper">
      <a
        href={href}
        onClick={handleClick}
      >
        {children}
      </a>
      {copyState !== 'idle' && (
        <span
          className={`rich-copy-badge${copyState === 'failed' ? ' rich-copy-badge-failed' : ''}`}
          role="status"
        >
          {copyState === 'copied' ? 'Copied' : 'Copy failed'}
        </span>
      )}
    </span>
  );
}

// ── Tokenizer / renderer ────────────────────────────────────

const tokenPattern =
  /\[(b|i|u|h2|h3|quote|code)\]([\s\S]*?)\[\/\1\]|\[color=(#[0-9a-f]{6})\]([\s\S]*?)\[\/color\]|\[url=([^\]]+)\]([\s\S]*?)\[\/url\]|\[(image|video|file)qdn\]([\s\S]*?)\[\/\7qdn\]|\[qdnembed\]([\s\S]*?)\[\/qdnembed\]/gi;

const decodeTagValue = (value) => {
  try {
    return decodeURIComponent(value ?? '');
  } catch {
    return value ?? '';
  }
};

const parseMediaRef = (type, payload) => {
  const [name, identifier, filename, mimeType, size] = payload.split('|').map(decodeTagValue);
  const serviceByType = {
    image: 'IMAGE',
    video: 'VIDEO',
    file: 'FILE',
  };

  return {
    service: serviceByType[type],
    name,
    identifier,
    filename: filename || undefined,
    mimeType: mimeType || undefined,
    size: Number.isFinite(Number(size)) ? Number(size) : undefined,
  };
};

const tokenize = (value) => {
  const tokens = [];
  let cursor = 0;
  let match;
  tokenPattern.lastIndex = 0;

  while ((match = tokenPattern.exec(value))) {
    if (match.index > cursor) {
      tokens.push({ kind: 'text', value: value.slice(cursor, match.index) });
    }

    if (match[1]) {
      tokens.push({ kind: 'wrap', tag: match[1].toLowerCase(), value: match[2] });
    } else if (match[3]) {
      tokens.push({ kind: 'wrap', tag: 'color', param: match[3], value: match[4] });
    } else if (match[5]) {
      tokens.push({ kind: 'wrap', tag: 'url', param: match[5], value: match[6] });
    } else if (match[7]) {
      tokens.push({
        kind: 'media',
        type: match[7].toLowerCase(),
        value: match[8],
      });
    } else if (match[9]) {
      tokens.push({ kind: 'embed', value: match[9] });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    tokens.push({ kind: 'text', value: value.slice(cursor) });
  }

  return tokens;
};

const renderTextSegments = (segments, keyPrefix) =>
  segments.flatMap((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    if (segment.kind === 'link') {
      const href = getSafeLinkHref(segment.href);
      if (!href) return splitTextLines(segment.value, key);
      return <RichLink key={key} href={href}>{segment.value}</RichLink>;
    }
    return splitTextLines(segment.value, key);
  });

const splitTextLines = (value, keyPrefix) =>
  value.split(/\r?\n/).flatMap((line, index, lines) => {
    const displayLine = /^\s*-\s+/.test(line)
      ? line.replace(/^\s*-\s+/, '• ')
      : /^\s*\d+\.\s+/.test(line)
        ? line.trim()
        : line;
    const nodes = [<span key={`${keyPrefix}-${index}`}>{displayLine}</span>];
    if (index < lines.length - 1) nodes.push(<br key={`${keyPrefix}-${index}-br`} />);
    return nodes;
  });

function MediaNode({ type, payload, onPreview }) {
  const ref = useMemo(() => parseMediaRef(type, payload), [payload, type]);

  // Always call hooks unconditionally — video/file branch needs these
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (type === 'image') return; // image uses useQdnImageUrl, not this fetch

    let active = true;
    void getQdnResourceUrl(ref)
      .then((resourceUrl) => { if (active) setUrl(resourceUrl); })
      .catch(() => { if (active) setUrl(''); });
    return () => { active = false; };
  }, [ref, type]);

  if (type === 'image') {
    return <MediaImage refData={ref} onPreview={onPreview} />;
  }

  if (!url) {
    return <div className="media-placeholder">{ref.filename || ref.identifier}</div>;
  }

  if (type === 'video') {
    return (
      <div className="rich-media-wrapper">
        <video className="rich-media-video" src={url} controls preload="metadata" />
        <button type="button" className="media-preview-btn" onClick={() => onPreview?.(ref)}
          title="Preview in larger view" aria-label="Preview video">
          <Eye size={14} /> Preview
        </button>
      </div>
    );
  }

  return (
    <div className="rich-media-wrapper">
      <a className="rich-file-card" href={url} download={ref.filename} target="_blank" rel="noreferrer">
        <Download size={18} />
        <span>{ref.filename || ref.identifier}</span>
      </a>
      <button type="button" className="media-preview-btn" onClick={() => onPreview?.(ref)}
        title="Preview file" aria-label="Preview file">
        <Eye size={14} /> Preview
      </button>
    </div>
  );
}

function MediaImage({ refData, onPreview }) {
  const { url, handleError } = useQdnImageUrl(refData);

  if (!url) {
    return <div className="media-placeholder">{refData.filename || refData.identifier}</div>;
  }

  return (
    <div className="rich-media-wrapper">
      <img className="rich-media-image" src={url} alt={refData.filename || refData.identifier} onError={handleError} />
      <button type="button" className="media-preview-btn media-preview-btn-overlay"
        onClick={() => onPreview?.(refData)} title="View larger" aria-label="View larger">
        <Maximize size={14} />
      </button>
    </div>
  );
}

// ── Wrapper that holds preview state ────────────────────────

function RichTextContentInner({ value }) {
  const [previewTarget, setPreviewTarget] = useState(null);

  const handlePreview = useCallback((ref) => {
    setPreviewTarget({ ref, name: ref.filename || ref.identifier });
  }, []);

  return (
    <>
      <div className="rich-content">{renderTokens(tokenize(value), 'root', handlePreview)}</div>
      {previewTarget ? (
        <QdnPreviewModal
          target={{ service: previewTarget.ref.service, name: previewTarget.ref.name, identifier: previewTarget.ref.identifier, filename: previewTarget.ref.filename }}
          displayName={previewTarget.name}
          onClose={() => setPreviewTarget(null)}
        />
      ) : null}
    </>
  );
}

const renderTokens = (tokens, keyPrefix, onPreview) =>
  tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.kind === 'text') return renderTextSegments(autolinkText(token.value), key);
    if (token.kind === 'media')
      return <MediaNode key={key} type={token.type} payload={token.value} onPreview={onPreview} />;
    if (token.kind === 'embed') {
      const embed = decodeQdnEmbedPayload(token.value);
      if (!embed) return <div key={key} className="media-placeholder">[invalid embed]</div>;
      return <QdnEmbedCard key={key} embed={embed} />;
    }

    const children = renderTokens(tokenize(token.value), key);
    if (token.tag === 'b') return <strong key={key}>{children}</strong>;
    if (token.tag === 'i') return <em key={key}>{children}</em>;
    if (token.tag === 'u') return <u key={key}>{children}</u>;
    if (token.tag === 'h2') return <h2 key={key}>{children}</h2>;
    if (token.tag === 'h3') return <h3 key={key}>{children}</h3>;
    if (token.tag === 'quote') return <blockquote key={key}>{children}</blockquote>;
    if (token.tag === 'code') return <code key={key}>{token.value}</code>;
    if (token.tag === 'color') {
      const color = /^#[0-9a-f]{6}$/i.test(token.param ?? '') ? token.param : undefined;
      return (
        <span key={key} style={color ? { color } : undefined}>
          {children}
        </span>
      );
    }
    if (token.tag === 'url') {
      const href = getSafeLinkHref(token.param);
      if (!href) return <span key={key}>{children}</span>;
      return <RichLink key={key} href={href}>{children}</RichLink>;
    }
    return children;
  });

export function RichTextContent({ value }) {
  return <RichTextContentInner value={value} />;
}
