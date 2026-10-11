import type { EconomicOutlookPayload } from '../data/economicOutlookTypes';
import type { DetailsPayload } from '../types';
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

/** URLs retain their query for checking, while reports expose only host/path. */
export function uniqueExternalAuditLinks(requests: readonly TrustedExternalUrlRequest[]): TrustedExternalUrlRequest[] {
  const unique = new Map<string, TrustedExternalUrlRequest>();
  for (const request of requests) {
    const key = targetKey(request);
    if (!unique.has(key)) unique.set(key, { ...request });
  }
  return [...unique.values()];
}

export function collectExternalAuditLinks({
  details,
  economicOutlook,
  releaseNotes = [],
  observed = [],
}: {
  details?: DetailsPayload | null;
  economicOutlook?: Pick<EconomicOutlookPayload, 'indicators'> | null;
  releaseNotes?: readonly Pick<VersionChangelogSummary, 'releaseUrl' | 'version'>[];
  observed?: readonly TrustedExternalUrlRequest[];
} = {}): TrustedExternalUrlRequest[] {
  const requests: TrustedExternalUrlRequest[] = [...FIXED_EXTERNAL_AUDIT_LINKS, ...observed];
  for (const detail of Object.values(details?.products ?? {})) {
    for (const [kind, url] of Object.entries(detail.links ?? {})) {
      if (url) requests.push({ url, label: `Lender ${kind} source`, purpose: 'lender_source' });
    }
    for (const document of detail.sourceDocuments ?? []) {
      const url = document.sourceUrl ?? document.url;
      if (url) requests.push({ url, label: document.label || 'Lender source document', purpose: 'lender_source' });
    }
  }
  for (const indicator of economicOutlook?.indicators ?? []) {
    if (indicator.sourceUrl) requests.push({ url: indicator.sourceUrl, label: `${indicator.label} source`, purpose: 'official_economic_source' });
  }
  for (const entry of releaseNotes) {
    requests.push({ url: entry.releaseUrl, label: `Australian Rates ${entry.version} changelog`, purpose: 'app_release' });
  }
  return uniqueExternalAuditLinks(requests);
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
