import type { EconomicOutlookPayload } from '../data/economicOutlookTypes';
import type { DetailsPayload, ProductLinks } from '../types';
import type { VersionChangelogSummary } from './changelog';
import { trustedExternalUrl, type TrustedExternalUrlRequest } from './trustedExternalUrl';

export const FIXED_EXTERNAL_AUDIT_LINKS: readonly TrustedExternalUrlRequest[] = [
  { url: 'https://www.asx.com.au/markets/trade-our-derivatives-market/futures-market/rba-rate-tracker', purpose: 'official_market_source', label: 'ASX RBA Rate Tracker' },
  { url: 'https://www.rba.gov.au/statistics/tables/csv/j1-cash-rate.csv', purpose: 'official_economic_source', label: 'RBA economist survey' },
  { url: 'https://www.rba.gov.au/statistics/tables/csv/f17-forward-rates.csv', purpose: 'official_economic_source', label: 'RBA bond forward rates' },
  { url: 'https://www.rba.gov.au/statistics/tables/', purpose: 'official_economic_source', label: 'RBA statistics tables' },
  { url: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release', purpose: 'official_economic_source', label: 'ABS CPI release' },
];

function targetKey(request: TrustedExternalUrlRequest): string {
  const trusted = trustedExternalUrl(request);
  return JSON.stringify([request.purpose, trusted.ok ? trusted.url : request.url]);
}

function rawTargetKey(request: TrustedExternalUrlRequest): string {
  return JSON.stringify([request.purpose, request.url]);
}

/** URLs retain their query for checking, while reports expose only host/path. */
export function uniqueExternalAuditLinks(requests: Iterable<TrustedExternalUrlRequest>): TrustedExternalUrlRequest[] {
  const unique = new Map<string, TrustedExternalUrlRequest>();
  const rawSeen = new Set<string>();
  for (const request of requests) {
    const raw = rawTargetKey(request);
    if (rawSeen.has(raw)) continue;
    rawSeen.add(raw);
    const key = targetKey(request);
    if (!unique.has(key)) unique.set(key, { ...request });
  }
  return [...unique.values()];
}

interface ExternalAuditLinkInput {
  details?: DetailsPayload | null;
  economicOutlook?: Pick<EconomicOutlookPayload, 'indicators'> | null;
  releaseNotes?: readonly Pick<VersionChangelogSummary, 'releaseUrl' | 'version'>[];
  observed?: readonly TrustedExternalUrlRequest[];
}

export function* iterateExternalAuditLinks({
  details,
  economicOutlook,
  releaseNotes = [],
  observed = [],
}: ExternalAuditLinkInput = {}): Generator<TrustedExternalUrlRequest> {
  yield* FIXED_EXTERNAL_AUDIT_LINKS;
  yield* observed;
  for (const productKey in details?.products ?? {}) {
    if (!Object.prototype.hasOwnProperty.call(details?.products, productKey)) continue;
    const detail = details!.products[productKey];
    for (const [kind, url] of Object.entries(detail.links ?? {})) {
      if (url) yield { url, label: `Lender ${kind} source`, purpose: 'lender_source' };
    }
    for (const document of detail.sourceDocuments ?? []) {
      const url = document.sourceUrl ?? document.url;
      if (url) yield { url, label: document.label || 'Lender source document', purpose: 'lender_source' };
    }
  }
  for (const indicator of economicOutlook?.indicators ?? []) {
    if (indicator.sourceUrl) yield { url: indicator.sourceUrl, label: `${indicator.label} source`, purpose: 'official_economic_source' };
  }
  for (const entry of releaseNotes) {
    yield { url: entry.releaseUrl, label: `Australian Rates ${entry.version} changelog`, purpose: 'app_release' };
  }
}

/** Private, allocation-free per-candidate cursor. Hermes generator resumptions
 * and iterator-result objects are costly across tens of thousands of duplicate
 * references. The public generator above retains independently owned entries. */
function createExternalLinkCursor(input: ExternalAuditLinkInput = {}) {
  let phase = 0;
  let index = 0;
  let productIndex = 0;
  let productKeys: string[] | null = null;
  let linkKeys: (keyof ProductLinks)[] | null = null;
  let documentIndex = 0;
  const assign = (target: TrustedExternalUrlRequest, url: string, label: string,
    purpose: TrustedExternalUrlRequest['purpose']) => {
    target.url = url; target.label = label; target.purpose = purpose;
    return true;
  };
  return (target: TrustedExternalUrlRequest): boolean => {
    for (;;) {
      if (phase < 2) {
        const entries = phase === 0 ? FIXED_EXTERNAL_AUDIT_LINKS : input.observed ?? [];
        if (index < entries.length) {
          const entry = entries[index++];
          return assign(target, entry.url, entry.label, entry.purpose);
        }
      } else if (phase === 2) {
        productKeys ??= Object.keys(input.details?.products ?? {});
        while (productIndex < productKeys.length) {
          const detail = input.details?.products[productKeys[productIndex]];
          linkKeys ??= Object.keys(detail?.links ?? {}) as (keyof ProductLinks)[];
          while (index < linkKeys.length) {
            const kind = linkKeys[index++];
            const url = detail?.links?.[kind];
            if (url) return assign(target, url, `Lender ${kind} source`, 'lender_source');
          }
          const documents = detail?.sourceDocuments ?? [];
          while (documentIndex < documents.length) {
            const document = documents[documentIndex++];
            const url = document.sourceUrl ?? document.url;
            if (url) return assign(target, url, document.label || 'Lender source document', 'lender_source');
          }
          productIndex++; linkKeys = null; index = 0; documentIndex = 0;
        }
      } else if (phase === 3) {
        const indicators = input.economicOutlook?.indicators ?? [];
        while (index < indicators.length) {
          const indicator = indicators[index++];
          if (indicator.sourceUrl) return assign(target, indicator.sourceUrl, `${indicator.label} source`, 'official_economic_source');
        }
      } else if (phase === 4) {
        const entries = input.releaseNotes ?? [];
        if (index < entries.length) {
          const entry = entries[index++];
          return assign(target, entry.releaseUrl, `Australian Rates ${entry.version} changelog`, 'app_release');
        }
      } else return false;
      phase++; index = 0;
    }
  };
}

export function collectExternalAuditLinks(input: Parameters<typeof iterateExternalAuditLinks>[0] = {}): TrustedExternalUrlRequest[] {
  return uniqueExternalAuditLinks(iterateExternalAuditLinks(input));
}

export interface ExternalAuditLinkCollectionProgress {
  slices: number;
  scannedCandidates: number;
  policyValidations: number;
  activeCpuMs: number;
  maxSliceMs: number;
}

/** Reuse policy work only within one audit. Every call still enumerates its
 * current sources, so changed details, labels and mounted links remain visible.
 * Rejected URLs are retained for foreground failure evidence, without a cap. */
export function createExternalAuditLinkCollector() {
  const keys = new Map<TrustedExternalUrlRequest['purpose'], Map<string, string>>();
  return async (
    input: Parameters<typeof iterateExternalAuditLinks>[0],
    checkpoint: (uniqueDestinations: number, progress: Readonly<ExternalAuditLinkCollectionProgress>) => Promise<void>,
    clock: () => number = () => globalThis.performance?.now?.() ?? Date.now(),
  ): Promise<TrustedExternalUrlRequest[]> => {
    const unique = new Map<string, TrustedExternalUrlRequest>();
    const rawSeen = new Map<TrustedExternalUrlRequest['purpose'], Set<string>>();
    const next = createExternalLinkCursor(input);
    const request: TrustedExternalUrlRequest = { url: '', label: '', purpose: 'lender_source' };
    const progress: ExternalAuditLinkCollectionProgress = {
      slices: 0, scannedCandidates: 0, policyValidations: 0, activeCpuMs: 0, maxSliceMs: 0,
    };
    let done = false;
    // The caller checks cancellation, pauses and its whole-operation deadline
    // before each slice, then yields the native task queue for input/ETA work.
    while (!done) {
      await checkpoint(unique.size, { ...progress });
      const started = clock();
      let validations = 0;
      // Cached and duplicate entries are cheap. A tiny count cap forces the
      // final native pass to wait hundreds of times for little CPU work.
      // CPU time and new policy parses retain their original tight bounds.
      // Reading the native high-resolution clock for every duplicate is more
      // costly than its set lookup on Hermes. Check every 16 cheap candidates
      // and after every policy parse, with the same cooperative 8 ms target.
      for (let scanned = 0; scanned < 4_096 && validations < 16; scanned++) {
        if (scanned % 16 === 0 && clock() - started >= 8) break;
        if (!next(request)) { done = true; break; }
        progress.scannedCandidates++;
        let seen = rawSeen.get(request.purpose);
        if (!seen) { seen = new Set(); rawSeen.set(request.purpose, seen); }
        if (seen.has(request.url)) continue;
        seen.add(request.url);
        let purposeKeys = keys.get(request.purpose);
        if (!purposeKeys) { purposeKeys = new Map(); keys.set(request.purpose, purposeKeys); }
        let key = purposeKeys.get(request.url);
        if (key == null) {
          validations++;
          progress.policyValidations++;
          key = targetKey(request);
          purposeKeys.set(request.url, key);
          if (!unique.has(key)) unique.set(key, { ...request });
          if (clock() - started >= 8) break;
          continue;
        }
        if (!unique.has(key)) unique.set(key, { ...request });
      }
      const duration = clock() - started;
      progress.slices++;
      progress.activeCpuMs += duration;
      progress.maxSliceMs = Math.max(progress.maxSliceMs, duration);
    }
    // Also catch synchronous work that finishes after the caller's deadline.
    await checkpoint(unique.size, { ...progress });
    return [...unique.values()];
  };
}

export interface ExternalLinkCaptureHandle { generation: number }
let generation = 0;
let capture: ExternalLinkCaptureHandle | null = null;
const captured = new Map<string, TrustedExternalUrlRequest>();
const listeners = new Set<() => void>();
export const subscribeExternalLinkCapture = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getExternalLinkCaptureGeneration = (): number => generation;
export const isCapturingExternalLinks = (): boolean => capture != null;

export function beginExternalLinkCapture(): ExternalLinkCaptureHandle {
  captured.clear();
  generation += 1;
  capture = Object.freeze({ generation });
  for (const listener of listeners) listener();
  return capture;
}

export function endExternalLinkCapture(handle: ExternalLinkCaptureHandle): void {
  if (capture !== handle) return;
  capture = null;
  captured.clear();
  generation += 1;
  for (const listener of listeners) listener();
}

export function captureExternalAuditLinks(requests: readonly TrustedExternalUrlRequest[]): void {
  if (!capture) return;
  for (const request of requests) {
    const key = targetKey(request);
    if (!captured.has(key)) captured.set(key, { ...request });
  }
}

export function getCapturedExternalAuditLinks(): TrustedExternalUrlRequest[] {
  return [...captured.values()].map((request) => ({ ...request }));
}
