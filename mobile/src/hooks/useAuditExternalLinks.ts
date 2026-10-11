import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  captureExternalAuditLinks,
  getExternalLinkCaptureGeneration,
  isCapturingExternalLinks,
  subscribeExternalLinkCapture,
} from '../lib/externalLinkInventory';
import type { TrustedExternalUrlRequest } from '../lib/trustedExternalUrl';

/** Records available buttons during an audit without pressing or opening them. */
export function useAuditExternalLinks(requests: readonly TrustedExternalUrlRequest[]): void {
  const generation = useSyncExternalStore(subscribeExternalLinkCapture, getExternalLinkCaptureGeneration, getExternalLinkCaptureGeneration);
  const latest = useRef(requests);
  latest.current = requests;
  const signature = isCapturingExternalLinks() ? JSON.stringify(requests) : '';
  useEffect(() => {
    captureExternalAuditLinks(latest.current);
  }, [generation, signature]);
}
