import { utf8ToBytes } from '@noble/hashes/utils';
import type { DetailsPayload } from '../types';
import { iterateExternalAuditLinks } from './externalLinkInventory';
import { trustedExternalUrl, type TrustedExternalUrlRequest } from './trustedExternalUrl';

export const PASSIVE_LINK_MAX_BYTES = 900 * 1024;
export const PASSIVE_LINK_MAX_COUNT = 5_000;
export const passiveLinkRequestIdentity = (request: Pick<TrustedExternalUrlRequest, 'purpose' | 'url'>): string =>
  JSON.stringify([request.purpose, request.url]);

export interface PassiveLinkQueue {
  pending: TrustedExternalUrlRequest[];
  iterator: Generator<TrustedExternalUrlRequest>;
  rawSeen: Set<string>;
  canonicalSeen: Set<string>;
  bytes: number;
  done: boolean;
  capped: boolean;
}

export function createPassiveLinkQueue(details: DetailsPayload): PassiveLinkQueue {
  return { pending: [], iterator: iterateExternalAuditLinks({ details }), rawSeen: new Set(),
    canonicalSeen: new Set(), bytes: 0, done: false, capped: false };
}

/** Inventory preparation is itself passive work: at most sixteen URL parses,
 * 256 cheap raw candidates or 20ms per slice. Repeated source URLs are skipped
 * before parsing, while the same canonical deduplication as foreground remains. */
export function advancePassiveLinkQueue(queue: PassiveLinkQueue, stopped: () => boolean,
  clock: () => number = Date.now): void {
  const started = clock();
  let validations = 0;
  for (let scanned = 0; !queue.done && scanned < 256 && validations < 16 && clock() - started < 20 && !stopped(); scanned++) {
    const next = queue.iterator.next();
    if (next.done) { queue.done = true; break; }
    const request = next.value;
    const rawKey = passiveLinkRequestIdentity(request);
    if (queue.rawSeen.has(rawKey)) continue;
    // Bound even a malicious catalogue of distinct rejected URLs. All omitted
    // requests are still assessed normally by the foreground audit.
    if (queue.rawSeen.size >= 20_000) { queue.done = true; queue.capped = true; break; }
    queue.rawSeen.add(rawKey);
    validations++;
    const trusted = trustedExternalUrl(request);
    if (!trusted.ok) continue;
    const canonical = passiveLinkRequestIdentity(trusted);
    if (queue.canonicalSeen.has(canonical)) continue;
    queue.canonicalSeen.add(canonical);
    const compact = { ...request, label: request.label.slice(0, 60) };
    const bytes = utf8ToBytes(JSON.stringify(compact)).length + 80;
    if (queue.bytes + bytes > PASSIVE_LINK_MAX_BYTES - 2048 || queue.pending.length >= PASSIVE_LINK_MAX_COUNT) {
      queue.done = true; queue.capped = true; break;
    }
    queue.bytes += bytes;
    queue.pending.push(compact);
  }
  if (queue.done) { queue.iterator.return(undefined); queue.rawSeen.clear(); queue.canonicalSeen.clear(); }
}
