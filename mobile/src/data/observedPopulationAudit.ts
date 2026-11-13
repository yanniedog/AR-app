import type { AppHealthDataSnapshot, AppHealthSourceContract } from '../lib/appHealth/types';
import { publishedV1SourceContract } from '../lib/appHealth/v1Contract';
import type { CandidateEdition } from './observedPopulationAssets';
import { OBSERVED_POPULATION_CAPABILITY, OBSERVED_POPULATION_CANDIDATE_TAG, OBSERVED_POPULATION_INDEX_URL } from './observedPopulationChannel';

/** Selected candidate evidence, never a replacement for the legacy audit's source contract. */
export function observedPopulationAuditEvidence(edition: CandidateEdition, source: 'cache' | 'remote', appVersion: string): {
  snapshot: AppHealthDataSnapshot; contract: AppHealthSourceContract;
} {
  const { core, details, integrity, selection } = edition, manifest = selection.manifest;
  const keys = new Set(Object.values(core.sections).flatMap(section => section.rates).map(row => row.product_key));
  const detailKeys = Object.keys(details.products);
  const contract = Object.freeze({ ...publishedV1SourceContract({ repo: manifest.repo,
    rollingTag: OBSERVED_POPULATION_CANDIDATE_TAG, manifestUrl: selection.index.revision_heads[manifest.run_date].manifest_url,
    datesIndexUrl: OBSERVED_POPULATION_INDEX_URL, datedTagPrefix: 'app-payload-observed-v1-', schema: 1 }),
    payloadChannel: OBSERVED_POPULATION_CAPABILITY });
  return { contract, snapshot: { source, appVersion, core, manifest,
    datesIndex: { dates: selection.index.dates, latestRunDate: selection.index.latest_date },
    assets: { core: { state: 'ready', runDate: core.run_date, itemCount: keys.size },
      details: { state: 'ready', runDate: details.run_date, itemCount: detailKeys.length } },
    details: { runDate: details.run_date, productCount: detailKeys.length,
      matchedProductCount: detailKeys.filter(key => keys.has(key)).length, orphanProductCount: detailKeys.filter(key => !keys.has(key)).length },
    quarantine: { ...integrity.quarantines, bankHistoryPairs: integrity.quarantines.bankHistoryPairs.size },
  } };
}
