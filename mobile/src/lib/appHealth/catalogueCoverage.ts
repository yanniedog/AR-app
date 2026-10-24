import { SECTION_KEYS } from '../../types';
import { validatePayloadAccounting } from './payloadAccounting';
import { APP_HEALTH_CHECK_CODES, type AppHealthCheck, type AppHealthDataSnapshot } from './types';
import type { SectionKey } from '../../types';

export interface CatalogueCounts { rates: number; products: number; providers: number }
export interface CatalogueProviderCoverage {
  provider: string;
  published: CatalogueCounts;
  eligible: CatalogueCounts | null;
  search: CatalogueCounts | null;
  directory: CatalogueCounts | null;
  excluded: { mandatoryProfile: number | null; suitability: number | null; tokenRate: number | null };
  missingDetails: number | null;
  missingSearchIndex: number | null;
}
export interface CatalogueSectionCoverage {
  section: SectionKey;
  selectedInterest: boolean;
  published: CatalogueCounts;
  eligible: CatalogueCounts | null;
  search: CatalogueCounts | null;
  directory: CatalogueCounts | null;
  excluded: { mandatoryProfile: number | null; suitability: number | null; tokenRate: number | null };
  /** Exact tier set differences, so equal totals cannot conceal substituted rows. */
  searchMissing: string[] | null;
  searchUnexpected: string[] | null;
  directoryMissing: string[] | null;
  directoryUnexpected: string[] | null;
  missingDetails: string[] | null;
  missingSearchIndex: string[] | null;
  providers: CatalogueProviderCoverage[];
}
export interface AppHealthCatalogueObservation {
  filterState: 'ready' | 'blocked';
  includeNonStandard: boolean;
  detailsAvailable: boolean;
  searchIndexAvailable: boolean;
  searchIndexRunMatches: boolean | null;
  /** Detail records without a published headline-rate row are counted separately. */
  detailsOnlyProductKeys: string[] | null;
  sections: CatalogueSectionCoverage[];
  brandedProvidersWithoutPublishedRates: string[];
  publishedProvidersWithoutBrand: string[];
}

/** Full loaded-catalogue identity check. It does not certify upstream or visual coverage. */
export function evaluateAppHealthCatalogueCoverage(snapshot: AppHealthDataSnapshot): AppHealthCheck {
  const catalogue = snapshot.catalogue;
  const history = snapshot.historyCoverage;
  const historyMetrics: AppHealthCheck['metrics'] = {
    historyAvailable: history?.available ?? false,
    historyDaysChecked: history?.days ?? 0,
    historySourceGapDays: JSON.stringify(history?.sourceGapDays ?? []),
    historyGaps: JSON.stringify(history?.gaps ?? []),
    historyProcessingMismatches: history?.processingMismatches ?? null,
    historyChartProjectionMismatches: history?.chartProjectionMismatches ?? null,
    historicalPixelsVerified: false,
  };
  const base = { id: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, code: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE,
    label: 'All banks and products: catalogue coverage', domain: 'data-completeness' as const };
  if (!snapshot.core || !catalogue) return { ...base, status: 'unavailable',
    metrics: { ...historyMetrics, catalogueAvailable: false, publishedProducts: null, eligibleProducts: null,
      sourceIdentityInventoryAvailable: false, allProductsRendered: false },
    summary: 'A current catalogue and selector snapshot are required to reconcile all banks and products.' };
  const accounting = validatePayloadAccounting(snapshot);
  const sections = catalogue.sections;
  const ready = catalogue.filterState === 'ready';
  const sum = (f: (s: CatalogueSectionCoverage) => number) => sections.reduce((total, section) => total + f(section), 0);
  const missingDetails = catalogue.detailsAvailable ? new Set(sections.flatMap(section => section.missingDetails ?? [])).size : null;
  const missingSearchIndex = catalogue.searchIndexAvailable ? new Set(sections.flatMap(section => section.missingSearchIndex ?? [])).size : null;
  const identityMismatches = ready ? sum(section => (section.searchMissing?.length ?? 0) +
    (section.searchUnexpected?.length ?? 0) + (section.directoryMissing?.length ?? 0) +
    (section.directoryUnexpected?.length ?? 0)) : null;
  const unavailable = !ready || !catalogue.detailsAvailable || !catalogue.searchIndexAvailable;
  const status = identityMismatches || catalogue.searchIndexRunMatches === false || (history?.processingMismatches ?? 0) > 0 || (history?.chartProjectionMismatches ?? 0) > 0 ? 'fail'
    : (missingDetails ?? 0) > 0 || (missingSearchIndex ?? 0) > 0 || (history?.gaps.length ?? 0) > 0 ? 'warn'
      : unavailable ? 'unavailable' : 'pass';
  const allRows = SECTION_KEYS.flatMap(section => snapshot.core!.sections[section]?.rates ?? []);
  const metrics: AppHealthCheck['metrics'] = {
    ...historyMetrics,
    catalogueAvailable: true, exhaustiveLoadedCatalogueScan: true, sourceIdentityInventoryAvailable: false,
    allProductsRendered: false, filterReady: ready, includeNonStandard: catalogue.includeNonStandard,
    publishedRates: allRows.length, publishedProducts: new Set(allRows.map(row => row.product_key)).size,
    publishedProviders: new Set(allRows.map(row => row.provider)).size,
    sourceProducts: accounting.valid ? accounting.sourceProducts : null,
    sourceRates: accounting.valid ? accounting.sourceRates : null,
    explainedSourceRateExclusions: accounting.valid ? accounting.excludedRates : null,
    explainedSourceProductsWithoutRates: accounting.valid ? accounting.productsWithoutRates : null,
    eligibleRates: ready ? sum(section => section.eligible!.rates) : null,
    eligibleProducts: ready ? sum(section => section.eligible!.products) : null,
    eligibleProviders: ready ? new Set(sections.flatMap(section => section.providers.filter(provider => (provider.eligible?.rates ?? 0) > 0).map(provider => provider.provider))).size : null,
    mandatoryProfileExcludedRates: ready ? sum(section => section.excluded.mandatoryProfile!) : null,
    suitabilityExcludedRates: ready ? sum(section => section.excluded.suitability!) : null,
    tokenRateExcludedRates: ready ? sum(section => section.excluded.tokenRate!) : null,
    identityMismatches, missingDetails, missingSearchIndex,
    detailsOnlyProducts: catalogue.detailsOnlyProductKeys?.length ?? null,
    searchIndexRunMatches: catalogue.searchIndexRunMatches,
    brandedProvidersWithoutPublishedRates: catalogue.brandedProvidersWithoutPublishedRates.length,
    publishedProvidersWithoutBrand: catalogue.publishedProvidersWithoutBrand.length,
  };
  for (const section of sections) {
    const prefix = section.section;
    metrics[`${prefix}PublishedProducts`] = section.published.products;
    metrics[`${prefix}PublishedProviders`] = section.published.providers;
    metrics[`${prefix}EligibleProducts`] = section.eligible?.products ?? null;
    metrics[`${prefix}EligibleProviders`] = section.eligible?.providers ?? null;
    metrics[`${prefix}SelectedInterest`] = section.selectedInterest;
  }
  return { ...base, status, metrics,
    summary: !ready ? 'Visibility is blocked while eligibility or suitability is preparing; eligible coverage remains unknown.'
      : identityMismatches ? 'Exact product/tier identities differ between the eligible catalogue and Search or Banks.'
        : catalogue.searchIndexRunMatches === false ? 'Search index identities belong to a different publication run.'
        : `${metrics.publishedProducts} published products across ${metrics.publishedProviders} banks were reconciled by identity. ` +
          `${metrics.eligibleProducts} products remain after profile, suitability and token-rate exclusions. ` +
          `Missing details: ${missingDetails ?? 'unknown'}; missing search index entries: ${missingSearchIndex ?? 'unknown'}. ` +
          'See the per-bank/category breakdown. Foreground rendering is sampled; loaded records alone do not prove complete upstream bank catalogues.',
    localEvidence: { historyCoverage: history, sections, brandedProvidersWithoutPublishedRates: catalogue.brandedProvidersWithoutPublishedRates,
      publishedProvidersWithoutBrand: catalogue.publishedProvidersWithoutBrand,
      detailsOnlyProductKeys: catalogue.detailsOnlyProductKeys,
      sourceAccounting: accounting.valid ? snapshot.core.coverage?.payload_accounting : null,
      producerFailures: snapshot.core.coverage?.provider_failures ?? snapshot.core.coverage?.failures ?? null,
      producerLimitations: snapshot.core.coverage?.limitations ?? null },
  };
}
