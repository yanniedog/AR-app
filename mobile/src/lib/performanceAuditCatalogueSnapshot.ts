import { mandatoryEligibleRows } from '../data/eligibilityGate';
import { visibleAccountRows } from '../data/format';
import { normalizeInterests } from '../data/interests';
import { EMPTY_FILTERS, excludeTokenDepositRates, filterRows, groupByProvider } from '../data/selectors';
import type { AppState } from '../data/storeTypes';
import { isSuitabilityFilterReady } from '../data/suitabilityGate';
import { SECTION_KEYS, type CorePayload, type RateRow } from '../types';

import type { AppHealthCatalogueObservation, CatalogueCounts, CatalogueProviderCoverage, CatalogueSectionCoverage } from './appHealth/catalogueCoverage';

function counts(rows: readonly RateRow[]): CatalogueCounts {
  return { rates: rows.length, products: new Set(rows.map(row => row.product_key)).size,
    providers: new Set(rows.map(row => row.provider)).size };
}
function identityComparison() {
  // The same row occurs in source, Search and Banks arrays. Encode each exact
  // identity once per scan, and build each array's set once for both directions.
  // Keep caches local so old publications/profile selections can be collected.
  const rows = new WeakMap<RateRow, string>();
  const arrays = new WeakMap<readonly RateRow[], Set<string>>();
  const identities = (values: readonly RateRow[]) => {
    let keys = arrays.get(values);
    if (keys) return keys;
    keys = new Set<string>();
    for (const row of values) {
      let key = rows.get(row);
      if (key === undefined) {
        key = JSON.stringify([row.provider, row.product_key, row.rate_index ?? null]);
        rows.set(row, key);
      }
      keys.add(key);
    }
    arrays.set(values, keys);
    return keys;
  };
  return (expected: readonly RateRow[], actual: readonly RateRow[]): string[] => {
    const keys = identities(actual);
    return [...identities(expected)].filter(key => !keys.has(key)).sort();
  };
}
function missingProducts(rows: readonly RateRow[], keys: ReadonlySet<string> | null): string[] | null {
  return keys == null ? null : [...new Set(rows.map(row => row.product_key))].filter(key => !keys.has(key)).sort();
}
function byProvider(rows: readonly RateRow[]): Map<string, RateRow[]> {
  const result = new Map<string, RateRow[]>();
  for (const row of rows) {
    const group = result.get(row.provider) ?? [];
    group.push(row);
    result.set(row.provider, group);
  }
  return result;
}

/**
 * No network, writes, or preference changes. Scan all published rows and compare
 * independent Search and Banks selectors against the declared display gates.
 * A blocked gate is unknown, never an empty eligible catalogue. Private filter
 * membership and public product identifiers stay in local evidence only.
 */
export function appHealthCatalogueSnapshot(state: AppState): AppHealthCatalogueObservation | null {
  const core = state.core;
  if (!core) return null;
  const ready = isSuitabilityFilterReady(state.prefs.includeNonStandard);
  const difference = identityComparison();
  const details = state.details?.products ?? null;
  const detailKeys = details ? new Set(Object.keys(details)) : null;
  const indexKeys = state.searchIndex ? new Set(Object.keys(state.searchIndex.products)) : null;
  const interests = normalizeInterests(state.prefs.interests);
  const publishedProviders = new Set<string>();
  const publishedProducts = new Set<string>();
  const sections = SECTION_KEYS.map((section): CatalogueSectionCoverage => {
    const published = core.sections[section]?.rates ?? [];
    for (const row of published) {
      publishedProviders.add(row.provider);
      publishedProducts.add(row.product_key);
    }
    const mandatory = ready ? mandatoryEligibleRows(published) : null;
    const suitable = mandatory ? visibleAccountRows(mandatory, state.prefs.includeNonStandard, details) : null;
    const eligible = suitable ? excludeTokenDepositRates(suitable, section) : null;
    const search = ready ? filterRows(published,
      { ...EMPTY_FILTERS, includeNonStandard: state.prefs.includeNonStandard }, details, null, section) : null;
    // A single-section source checks the directory's membership for each category.
    const singleSection = Object.fromEntries(SECTION_KEYS.map(key => [key,
      { ...core.sections[key], rates: key === section ? published : [] },
    ])) as CorePayload['sections'];
    const directory = ready ? groupByProvider(singleSection, state.prefs.depositRankMetric,
      state.prefs.includeNonStandard, details, section, state.prefs.mortgageRateMetric).flatMap(group => group.rows) : null;
    const buckets = [published, mandatory, suitable, eligible, search, directory].map(rows => rows && byProvider(rows));
    const [publishedByProvider, mandatoryByProvider, suitableByProvider, eligibleByProvider, searchByProvider, directoryByProvider] = buckets;
    const providers = [...publishedByProvider!.keys()].sort().map((provider): CatalogueProviderCoverage => {
      const all = publishedByProvider!.get(provider)!;
      const selected = eligibleByProvider?.get(provider) ?? [];
      return {
        provider, published: counts(all), eligible: ready ? counts(selected) : null,
        search: ready ? counts(searchByProvider?.get(provider) ?? []) : null,
        directory: ready ? counts(directoryByProvider?.get(provider) ?? []) : null,
        excluded: {
          mandatoryProfile: ready ? all.length - (mandatoryByProvider?.get(provider)?.length ?? 0) : null,
          suitability: ready ? (mandatoryByProvider?.get(provider)?.length ?? 0) - (suitableByProvider?.get(provider)?.length ?? 0) : null,
          tokenRate: ready ? (suitableByProvider?.get(provider)?.length ?? 0) - selected.length : null,
        },
        missingDetails: missingProducts(all, detailKeys)?.length ?? null,
        missingSearchIndex: missingProducts(all, indexKeys)?.length ?? null,
      };
    });
    return {
      section, selectedInterest: interests.includes(section), published: counts(published),
      eligible: eligible && counts(eligible), search: search && counts(search), directory: directory && counts(directory),
      excluded: {
        mandatoryProfile: mandatory ? published.length - mandatory.length : null,
        suitability: mandatory && suitable ? mandatory.length - suitable.length : null,
        tokenRate: suitable && eligible ? suitable.length - eligible.length : null,
      },
      searchMissing: eligible && search ? difference(eligible, search) : null,
      searchUnexpected: eligible && search ? difference(search, eligible) : null,
      directoryMissing: eligible && directory ? difference(eligible, directory) : null,
      directoryUnexpected: eligible && directory ? difference(directory, eligible) : null,
      missingDetails: missingProducts(published, detailKeys),
      missingSearchIndex: missingProducts(published, indexKeys), providers,
    };
  });
  return {
    filterState: ready ? 'ready' : 'blocked', includeNonStandard: state.prefs.includeNonStandard,
    detailsAvailable: details != null, searchIndexAvailable: indexKeys != null,
    searchIndexRunMatches: state.searchIndex ? state.searchIndex.run_date === core.run_date : null,
    detailsOnlyProductKeys: detailKeys ? [...detailKeys].filter(key => !publishedProducts.has(key)).sort() : null,
    sections,
    brandedProvidersWithoutPublishedRates: Object.keys(core.brands).filter(provider => !publishedProviders.has(provider)).sort(),
    publishedProvidersWithoutBrand: [...publishedProviders].filter(provider => !core.brands[provider]).sort(),
  };
}

