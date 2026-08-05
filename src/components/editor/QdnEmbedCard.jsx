// ── Ported from Blogs project — QdnEmbedCard ──

import { useCallback } from 'react';
import { buildQdnAddress } from '../../services/qdn/embedService';
import { requestQortium } from '../../services/qortium/qortiumClient';
import { useQdnImageUrl } from '../../services/qdn/useQdnImageUrl';

/**
 * Renders a QDN embed card with optional image, label, description,
 * service badge, and publisher/identifier.
 *
 * The entire card is a single interactive link that opens the target
 * via the existing internal Qortium navigation system (OPEN_NEW_TAB).
 */
export function QdnEmbedCard({ embed }) {
  const { target, presentation } = embed;
  const address = buildQdnAddress(target.service, target.name, target.identifier);

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      void requestQortium({ action: 'OPEN_NEW_TAB', address }).catch(() => {
        window.open(address, '_blank');
      });
    },
    [address],
  );

  const hasImage = Boolean(presentation?.image);
  const hasLabel = Boolean(presentation?.label);
  const hasDescription = Boolean(presentation?.description);

  return (
    <a
      className="qdn-embed-card"
      href={address}
      onClick={handleClick}
      target="_blank"
      rel="noreferrer"
    >
      {hasImage ? (
        <EmbedImage refData={presentation.image} />
      ) : null}

      <div className="qdn-embed-body">
        <span className="qdn-embed-badge">{target.service}</span>

        {hasLabel ? (
          <strong className="qdn-embed-label">{presentation.label}</strong>
        ) : null}

        {hasDescription ? (
          <p className="qdn-embed-description">{presentation.description}</p>
        ) : null}

        <span className="qdn-embed-meta">
          {target.name}
          {target.identifier ? ` · ${target.identifier}` : ''}
        </span>
      </div>
    </a>
  );
}

function EmbedImage({ refData }) {
  if (!refData) return null;

  return (
    <QdnEmbedImageInner refData={refData} />
  );
}

function QdnEmbedImageInner({ refData }) {
  const { url, handleError } = useQdnImageUrl(
    {
      service: refData.service,
      name: refData.name,
      identifier: refData.identifier,
      filename: refData.filename,
      mimeType: refData.mimeType,
      size: refData.size,
    },
  );

  if (!url) {
    return <div className="qdn-embed-image qdn-embed-image-loading" />;
  }

  return (
    <img
      className="qdn-embed-image"
      src={url}
      alt=""
      onError={handleError}
    />
  );
}
