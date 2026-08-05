// ── Ported from Blogs project — QdnEmbedModal ──

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as LinkIcon, Search, Upload, X } from 'lucide-react';
import { IMAGE_CAPABLE_SERVICES, QDN_SERVICES } from '../../services/qdn/qdnServiceTypes';
import { searchQdnResources, resolveDisplayName, resolveSecondaryLabel, highlightMatch } from '../../services/qdn/searchService';
import { encodeQdnEmbedTag, parseQdnUri } from '../../services/qdn/embedService';
import { publishBlogImage } from '../../services/blog/mediaService';
import { useQdnImageUrl } from '../../services/qdn/useQdnImageUrl';

const PAGE_SIZE = 20;

export function QdnEmbedModal({ ownerName, accountNames, onInsert, onClose }) {
  const [targetKind, setTargetKind] = useState('none');
  const [pastedTarget, setPastedTarget] = useState('');
  const [targetError, setTargetError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [results, setResults] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchIdRef = useRef(0);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [imageSource, setImageSource] = useState({ kind: 'none' });
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const imageInputRef = useRef(null);
  const filePreviewUrlRef = useRef(null);
  const searchingForImageRef = useRef(false);

  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState('');

  useEffect(() => {
    return () => {
      if (filePreviewUrlRef.current) URL.revokeObjectURL(filePreviewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTargetPaste = () => {
    setTargetError('');
    const trimmed = pastedTarget.trim();
    if (!trimmed) { setSelected(null); return; }
    const parsed = parseQdnUri(trimmed);
    if (!parsed) { setTargetError('Invalid QDN URL. Expected: qdn://SERVICE/Name/identifier'); return; }
    setSelected({ name: parsed.name, service: parsed.service, identifier: parsed.identifier });
  };

  const clearTarget = () => { setSelected(null); setPastedTarget(''); setTargetError(''); };

  const doSearch = useCallback(async (append = false) => {
    const currentOffset = append ? offset + PAGE_SIZE : 0;
    const searchId = ++searchIdRef.current;
    setIsSearching(true); setSearchError('');
    try {
      const params = { limit: PAGE_SIZE, offset: currentOffset };
      if (service) params.service = service;
      if (publisherName) params.name = publisherName;
      if (query.trim()) params.query = query.trim();
      const items = await searchQdnResources(params);
      if (searchId !== searchIdRef.current) return;
      if (append) { setResults((prev) => [...prev, ...items]); setOffset(currentOffset); }
      else { setResults(items); setOffset(0); }
      setHasMore(items.length >= PAGE_SIZE);
    } catch (err) {
      if (searchId !== searchIdRef.current) return;
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
    } finally { if (searchId === searchIdRef.current) setIsSearching(false); }
  }, [offset, query, service, publisherName]);

  const handleSelectResult = (item) => { setSelected(item); };

  const handleImagePaste = () => {
    setImageError('');
    const trimmed = imageUrl.trim();
    if (!trimmed) { setImageSource({ kind: 'none' }); return; }
    const parsed = parseQdnUri(trimmed);
    if (!parsed) { setImageError('Invalid QDN URL. Expected: qdn://SERVICE/Name/identifier'); return; }
    if (!IMAGE_CAPABLE_SERVICES.includes(parsed.service)) {
      setImageError(`"${parsed.service}" is not an image-capable service. Use: ${IMAGE_CAPABLE_SERVICES.join(', ')}`); return;
    }
    setImageSource({ kind: 'qdn', ref: { service: parsed.service, name: parsed.name, identifier: parsed.identifier } });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (filePreviewUrlRef.current) URL.revokeObjectURL(filePreviewUrlRef.current);
    if (!file.type.startsWith('image/')) { setImageError('Only image files are supported.'); return; }
    filePreviewUrlRef.current = URL.createObjectURL(file);
    setImageSource({ kind: 'file', file, previewUrl: filePreviewUrlRef.current });
    setImageError('');
  };

  const openImageSearch = () => {
    setQuery(''); setService('IMAGE'); setPublisherName(ownerName);
    setResults([]); setOffset(0); setHasMore(false); setSearchError('');
    setShowSearch(true); searchingForImageRef.current = true;
  };

  const handleSelectImageResult = (item) => {
    searchingForImageRef.current = false;
    setImageSource({ kind: 'qdn', ref: { service: item.service, name: item.name, identifier: item.identifier } });
    setShowSearch(false);
  };

  const handleInsert = async () => {
    if (!selected || isInserting) return;
    setIsInserting(true); setInsertError('');
    try {
      let finalImageRef = (imageSource.kind === 'qdn' ? imageSource.ref : undefined);
      if (imageSource.kind === 'file') { finalImageRef = await publishBlogImage(imageSource.file, ownerName); }
      const embed = {
        target: { service: selected.service, name: selected.name, identifier: selected.identifier },
        presentation: {
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(finalImageRef ? { image: finalImageRef } : {}),
        },
      };
      onInsert(encodeQdnEmbedTag(embed));
      onClose();
    } catch (err) {
      setInsertError(err instanceof Error ? err.message : 'Failed to insert embed.');
      setIsInserting(false);
    }
  };

  const canInsert = selected !== null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-dialog-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert QDN Content">
        <div className="modal-header">
          <h2>Insert QDN Content</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="qdn-builder-body">
          {/* Target */}
          <fieldset className="qdn-builder-field">
            <legend>Target</legend>
            <div className="qdn-target-tabs">
              <button type="button" className={targetKind === 'paste' ? 'active' : ''}
                onClick={() => { setTargetKind('paste'); setShowSearch(false); }}>
                <LinkIcon size={14} /> Paste QDN URL
              </button>
              <button type="button" className={targetKind === 'search' ? 'active' : ''}
                onClick={() => { setTargetKind('search'); setShowSearch(true); }}>
                <Search size={14} /> Search QDN
              </button>
            </div>
            {targetKind === 'paste' ? (
              <div className="qdn-target-paste">
                <input type="text" value={pastedTarget} onChange={(e) => setPastedTarget(e.target.value)}
                  placeholder="qdn://APP/Name/identifier" onKeyDown={(e) => { if (e.key === 'Enter') handleTargetPaste(); }} />
                <button type="button" className="command-button" onClick={handleTargetPaste}>Apply</button>
              </div>
            ) : null}
            {targetError ? <p className="modal-error">{targetError}</p> : null}
          </fieldset>

          {/* Target summary */}
          {selected ? (
            <div className="qdn-builder-target">
              <span className="qdn-embed-badge">{selected.service}</span>
              <strong>{selected.name}</strong>
              <code>{selected.identifier}</code>
              <button type="button" className="icon-button" onClick={clearTarget} aria-label="Clear target" style={{ marginLeft: 'auto' }}><X size={14} /></button>
            </div>
          ) : (
            <div className="qdn-builder-target qdn-builder-target-empty"><span>No target selected</span></div>
          )}

          {/* Search (collapsible) */}
          {showSearch ? (
            <div className="qdn-search-inline">
              <div className="qdn-search-row">
                <input className="qdn-search-input" type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch(false); }} placeholder="Search QDN…" />
                <button type="button" className="command-button" onClick={() => doSearch(false)} disabled={isSearching}>
                  <Search size={16} /><span>Search</span>
                </button>
              </div>
              <div className="qdn-filter-row">
                <select value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="">All services</option>
                  {QDN_SERVICES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <select value={publisherName} onChange={(e) => setPublisherName(e.target.value)}>
                  <option value="">All QDN</option>
                  {accountNames.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
              {searchError ? <p className="modal-error">{searchError}</p> : null}
              <div className="qdn-search-results">
                {results.length === 0 && !isSearching ? <p className="qdn-search-empty">Enter a search term and click Search.</p> : null}
                {results.map((item, i) => {
                  const displayName = resolveDisplayName(item);
                  const secondary = resolveSecondaryLabel(item);
                  const nameSegments = highlightMatch(displayName, query);
                  const metaSegments = highlightMatch(secondary, query);
                  return (
                    <button key={`${item.service}:${item.name}:${item.identifier}:${i}`} type="button" className="qdn-search-result"
                      onClick={() => { if (searchingForImageRef.current) handleSelectImageResult(item); else handleSelectResult(item); }}>
                      <span className="qdn-result-service">{item.service}</span>
                      <span className="qdn-result-title">{renderHighlighted(nameSegments)}</span>
                      <span className="qdn-result-meta">{renderHighlighted(metaSegments)}</span>
                    </button>
                  );
                })}
                {isSearching ? <p className="qdn-search-status">Searching…</p> : null}
                {hasMore && !isSearching ? <button type="button" className="command-button" onClick={() => doSearch(true)}>Load more</button> : null}
              </div>
            </div>
          ) : null}

          {/* Presentation */}
          <label className="qdn-builder-field">Label (optional)
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={selected?.title || selected?.identifier || ''} />
          </label>
          <label className="qdn-builder-field">Description (optional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description…" rows={2} />
          </label>

          {/* Image */}
          <fieldset className="qdn-builder-field">
            <legend>Image (optional)</legend>
            <div className="qdn-image-source-tabs">
              <button type="button" className={imageSource.kind === 'none' ? 'active' : ''} onClick={() => setImageSource({ kind: 'none' })}>None</button>
              <button type="button" className={imageSource.kind === 'qdn' ? 'active' : ''}
                onClick={() => setImageSource({ kind: 'qdn', ref: { service: 'IMAGE', name: '', identifier: '' } })}>
                <LinkIcon size={14} /> Paste QDN URL
              </button>
              <button type="button" className={imageSource.kind === 'file' ? 'active' : ''}
                onClick={() => imageInputRef.current?.click()}><Upload size={14} /> Upload</button>
              <button type="button" className="command-button" onClick={openImageSearch}><Search size={14} /> Search QDN</button>
            </div>
            {imageSource.kind === 'qdn' ? (
              <div className="qdn-image-url-input">
                <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="qdn://IMAGE/Name/identifier" onKeyDown={(e) => { if (e.key === 'Enter') handleImagePaste(); }} />
                <button type="button" className="command-button" onClick={handleImagePaste}>Apply</button>
                {imageSource.ref.name ? <p className="qdn-image-url-ok">✓ {imageSource.ref.service} · {imageSource.ref.name}/{imageSource.ref.identifier}</p> : null}
              </div>
            ) : null}
            {imageError ? <p className="modal-error">{imageError}</p> : null}
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            {imageSource.kind === 'file' ? <img className="qdn-embed-image-preview" src={imageSource.previewUrl} alt="Preview" />
              : imageSource.kind === 'qdn' && imageSource.ref.name ? <EmbedPreviewImage refData={imageSource.ref} /> : null}
          </fieldset>

          {/* Preview */}
          {selected ? (
            <div className="qdn-builder-preview">
              <h3>Preview</h3>
              <div className="qdn-embed-card qdn-embed-preview">
                {imageSource.kind === 'file' ? <img className="qdn-embed-image" src={imageSource.previewUrl} alt="" />
                  : imageSource.kind === 'qdn' && imageSource.ref.name ? <EmbedPreviewImage refData={imageSource.ref} /> : null}
                <div className="qdn-embed-body">
                  <span className="qdn-embed-badge">{selected.service}</span>
                  {label.trim() ? <strong className="qdn-embed-label">{label.trim()}</strong> : null}
                  {description.trim() ? <p className="qdn-embed-description">{description.trim()}</p> : null}
                  <span className="qdn-embed-meta">{selected.name} · {selected.identifier}</span>
                </div>
              </div>
            </div>
          ) : null}

          {insertError ? <p className="modal-error">{insertError}</p> : null}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className="command-button" onClick={() => void handleInsert()}
              disabled={!canInsert || isInserting}>
              {isInserting ? 'Inserting…' : 'Insert into post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbedPreviewImage({ refData }) {
  const { url, handleError } = useQdnImageUrl({
    service: refData.service, name: refData.name, identifier: refData.identifier,
  });
  if (!url) return <div className="qdn-embed-image qdn-embed-image-loading" />;
  return <img className="qdn-embed-image" src={url} alt="" onError={handleError} />;
}

function renderHighlighted(segments) {
  return segments.map((seg, i) =>
    seg.kind === 'match'
      ? <mark key={i} className="qdn-highlight">{seg.value}</mark>
      : <span key={i}>{seg.value}</span>,
  );
}
