// ── Ported from Blogs project — useQdnImageUrl hook ──

import { useState, useEffect, useRef, useCallback } from 'react';
import { getQdnResourceUrl, getResourceStatus } from './qdnService';
import { requestQortium } from '../qortium/qortiumClient';

const MAX_RETRY_CHECKS = 2;
const RETRY_DELAY_MS = 2_000;

/**
 * Hook: resolve a QDN image URL with automatic recovery when the
 * browser fails to decode the image.
 *
 * Recovery strategy:
 *  1. onError → GET_QDN_RESOURCE_STATUS
 *  2. READY        → cache-bust reload (incrementing query param)
 *  3. PUBLISHED /
 *     DOWNLOADING   → request build=true, then re-check up to
 *                     MAX_RETRY_CHECKS times (RETRY_DELAY_MS apart)
 *  4. NOT_PUBLISHED → immediate fallback
 *
 * Bounded: at most MAX_RETRY_CHECKS+1 URL fetches + up to
 * MAX_RETRY_CHECKS status polls per failed decode.  When refData
 * changes the old cycle is abandoned.
 */
export function useQdnImageUrl(refData, fallbackSrc) {
  const [url, setUrl] = useState('');
  const [errorCount, setErrorCount] = useState(0);

  const activeRef = useRef(true);
  const retryTimerRef = useRef(null);
  const retryCheckCountRef = useRef(0);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Resolve the base URL on mount / ref change
  useEffect(() => {
    activeRef.current = true;
    retryCheckCountRef.current = 0;
    clearRetryTimer();
    setErrorCount(0);

    let ignore = false;
    void getQdnResourceUrl(refData)
      .then((resourceUrl) => {
        if (ignore || !activeRef.current) return;
        setUrl(resourceUrl);
      })
      .catch(() => {
        if (ignore || !activeRef.current) return;
        setUrl(fallbackSrc ?? '');
      });
    return () => {
      ignore = true;
      activeRef.current = false;
      clearRetryTimer();
    };
  }, [refData, fallbackSrc, clearRetryTimer]);

  // Cache-bust helper: strips existing cb= and increments (or starts at 1)
  const bustCache = useCallback((baseUrl) => {
    const match = baseUrl.match(/[?&]cb=(\d+)/);
    const next = match ? parseInt(match[1], 10) + 1 : 1;
    const stripped = baseUrl.replace(/[?&]cb=\d+/g, '');
    const sep = stripped.includes('?') ? '&' : '?';
    return stripped + `${sep}cb=${next}`;
  }, []);

  const handleError = useCallback(() => {
    if (!activeRef.current || !url) return;

    const attempt = errorCount + 1;
    if (attempt > MAX_RETRY_CHECKS + 1) {
      if (fallbackSrc !== undefined && url !== fallbackSrc) {
        setUrl(fallbackSrc);
      }
      return;
    }

    setErrorCount(attempt);

    void (async () => {
      try {
        const status = await getResourceStatus(
          refData.service,
          refData.name,
          refData.identifier,
        );

        if (!activeRef.current) return;

        const st = status?.status?.toUpperCase();

        if (st === 'READY') {
          // Resource is ready but decodes badly — try cache-bust
          setUrl((prev) => (prev ? bustCache(prev) : prev));
          return;
        }

        if (st === 'PUBLISHED' || st === 'DOWNLOADING' || st === 'DOWNLOADED' || st === 'BUILDING') {
          if (retryCheckCountRef.current >= MAX_RETRY_CHECKS) return;

          // Ask core to build/download missing chunks
          requestQortium({
            action: 'GET_QDN_RESOURCE_STATUS',
            service: refData.service,
            name: refData.name,
            identifier: refData.identifier,
            build: true,
          }).catch(() => undefined);

          retryCheckCountRef.current += 1;

          retryTimerRef.current = setTimeout(async () => {
            if (!activeRef.current) return;
            try {
              const retryStatus = await getResourceStatus(
                refData.service,
                refData.name,
                refData.identifier,
              );
              if (!activeRef.current) return;
              if (retryStatus?.status?.toUpperCase() === 'READY') {
                setUrl((prev) => (prev ? bustCache(prev) : prev));
              }
            } catch {
              // Retry exhausted
            }
          }, RETRY_DELAY_MS);
        }

        // NOT_PUBLISHED or other → permanent fallback on next error
      } catch {
        // Status check failed — will retry on next onError
      }
    })();
  }, [url, errorCount, refData, fallbackSrc, bustCache]);

  return { url, handleError };
}
