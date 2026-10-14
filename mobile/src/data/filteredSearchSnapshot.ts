import type { CorePayload, DetailsPayload, Manifest, ProductDetail, RateRow, SectionKey } from '../types';
import type { ProfileFilters } from './profile';
import type { Filters, MortgageRateMetric, RankMetric, SortKey } from './selectors';
import { filterRows, sortRows } from './selectors';
import { rowsForSearchScope } from './taxonomy';
import { getMandatoryEligibilityRevision, isMandatoryEligibilityReady, mandatoryEligibleRows } from './eligibilityGate';
import type { SearchIndexPayload } from './detailSearch';
import type { CoreIntegrityContext } from './sectionIntegrity';
import { scopedRateConditions, type ScopedRateConditions } from './rateConditions';

export type SearchCoverageFact =
  | { kind: 'matching-set'; state: 'complete'; variants: 'matching'; ranking: 'selected' }
  | { kind: 'specifications'; absent: 'unavailable'; emptyArrays: 'explicit' }
  | { kind: 'sources'; references: 'included'; documentBodies: 'excluded'; independentReview: 'unverified' }
  | { kind: 'history'; completeness: 'unverified' }
  | { kind: 'calculations'; unsupportedPatterns: 'unverified' }
  | { kind: 'publication-day'; state: 'current' | 'older'; publicationDate: string; australianDate: string };

export interface SearchReportRequest {
  section: SectionKey; path: string[]; hierarchyScoped: boolean; query: string;
  filters: Filters; sort: SortKey; depositMetric: RankMetric; mortgageMetric: MortgageRateMetric;
  deepSearch: boolean;
}
export interface FilteredSearchSnapshot {
  schemaVersion: 1; eligibilityRevision: number; publicationDate: string; publicationRevision: number | null;
  bundleSha256: string | null; coreSha256: string; detailsSha256: string;
  generatedAt: string; australianDate: string; request: SearchReportRequest;
  mandatoryRequirements: ProfileFilters; rows: RateRow[];
  products: { productKey: string; rank: number; detail: ProductDetail | null }[];
  coverage: SearchCoverageFact[];
  /** Exact admission captured while rows still belong to the verified core. */
  rateConditions?: ScopedRateConditions[];
}

export function australianPublicationDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeDeep(child); Object.freeze(value); }
  return value;
}

/** Caller supplies integrity-verified current details, never a stale details cache. */
export function captureFilteredSearchSnapshot(input: {
  core: CorePayload; manifest: Manifest; details: DetailsPayload; profile: ProfileFilters;
  request: SearchReportRequest; searchIndex?: SearchIndexPayload | null; now?: Date; coreIntegrity?: CoreIntegrityContext | null;
}): FilteredSearchSnapshot {
  const { core, manifest, details, request } = input;
  if (!isMandatoryEligibilityReady() || core.run_date !== manifest.run_date || details.run_date !== core.run_date) throw Error('Required publication evidence is not ready.');
  if (request.deepSearch && manifest.files.search_index && input.searchIndex?.run_date !== core.run_date) throw Error('The search index is not ready for this publication.');
  const scoped = rowsForSearchScope(core.sections[request.section].rates, request.section, request.path, request.hierarchyScoped);
  const ordered = sortRows(scoped, request.sort, request.section, request.depositMetric, request.mortgageMetric);
  const rows = filterRows(ordered, { ...request.filters, query: request.query }, details.products, request.deepSearch ? input.searchIndex : null, request.section);
  if (mandatoryEligibleRows(rows).length !== rows.length) throw Error('Requirements changed. Retry export.');
  const keys = [...new Set(rows.map(row => row.product_key))];
  const now = input.now ?? new Date();
  const snapshot: FilteredSearchSnapshot = {
    schemaVersion: 1, eligibilityRevision: getMandatoryEligibilityRevision(), publicationDate: core.run_date, publicationRevision: manifest.payload_revision?.revision ?? null,
    bundleSha256: manifest.payload_revision?.bundle_sha256 ?? null, coreSha256: manifest.files.core.sha256, detailsSha256: manifest.files.details.sha256,
    generatedAt: now.toISOString(), australianDate: australianPublicationDate(now), request, mandatoryRequirements: input.profile, rows,
    products: keys.map((productKey, index) => ({ productKey, rank: index + 1, detail: details.products[productKey] ?? null })),
    rateConditions: rows.map(row => scopedRateConditions(row, request.section, { core, manifest, details, coreIntegrity: input.coreIntegrity ?? null })),
    coverage: [
      { kind: 'matching-set', state: 'complete', variants: 'matching', ranking: 'selected' },
      { kind: 'specifications', absent: 'unavailable', emptyArrays: 'explicit' },
      { kind: 'sources', references: 'included', documentBodies: 'excluded', independentReview: 'unverified' },
      { kind: 'history', completeness: 'unverified' },
      { kind: 'calculations', unsupportedPatterns: 'unverified' },
      { kind: 'publication-day', state: core.run_date === australianPublicationDate(now) ? 'current' : 'older', publicationDate: core.run_date, australianDate: australianPublicationDate(now) },
    ],
  };
  return freezeDeep(JSON.parse(JSON.stringify(snapshot)) as FilteredSearchSnapshot);
}
