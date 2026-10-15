import { SECTION_KEYS, type RateRow } from '../types';
import { validateHistoricalBankRateCatalogue, type HistoricalBankRateCatalogue } from './historicalBankRateCatalogueWire';
import { isBroadlyAvailable, isConditionalDepositRate, isNonStandard } from './rateClassification';
import { featureEvidenceMatches, featureEvidenceScope } from './productFactsCore';
import { PROFILE_FEATURE_OPTIONS } from './profile';
import { isExplicitTermDepositProduct } from './sectionIntegrity';
import { READY_SEMANTIC_REVISION, validateHistoricalBankRateReady, type HistoricalBankRateReady, type ReadyHistoryCohort } from './historicalBankRateReadyWire';

/** Producer/build-time only. Every semantic decision uses the shipping app's
 * classifier, never a second implementation in the publishing language. */
export function compileHistoricalBankRateReady(input: unknown, compilerSha: string): HistoricalBankRateReady {
  if (!validateHistoricalBankRateCatalogue(input)) throw new Error('Invalid original historical catalogue');
  const catalogue: HistoricalBankRateCatalogue = input;
  const ready: HistoricalBankRateReady = { schema_version: 1, semantic_revision: READY_SEMANTIC_REVISION,
    compiler_sha256: compilerSha, run_dates: [...catalogue.run_dates], sources: catalogue.sources,
    unavailable_dates: catalogue.unavailable_dates, quarantined_tier_count: 0,
    sections: { Mortgage: [], Savings: [], TD: [] }, products: { Mortgage: [], Savings: [], TD: [] } };
  for (const section of SECTION_KEYS) {
    const groups = new Map<string, { cohort: ReadyHistoryCohort; events: Map<number, Map<number, number>> }>();
    const broadCache = new Map<string, boolean>(), featureCache = new Map<string, number>();
    const products = new Map<string, Map<number, number>>();
    for (const tier of catalogue.sections[section]) {
      const row = tier.row as RateRow;
      if (section === 'Savings' && isExplicitTermDepositProduct(row)) { ready.quarantined_tier_count++; continue; }
      const dims = section === 'Mortgage' ? [row.loan_purpose ?? row.security_purpose ?? null, row.rate_type ?? null,
        row.ribbon_repayment_type ?? row.repayment_type ?? null, row.lvr_tier ?? null] :
        section === 'Savings' ? [row.ribbon_deposit_kind ?? null] : [row.interest_payment ?? null];
      for (const [start, count, rates, id] of tier.spans) {
        const evidence = catalogue.evidence[id]; let broad = false, mask = 0;
        if (evidence.status === 'known') {
          const broadKey = JSON.stringify([id, row.provider, row.product_name, isNonStandard(row), isConditionalDepositRate(row)]);
          if (!broadCache.has(broadKey)) broadCache.set(broadKey, isBroadlyAvailable(row, evidence.detail));
          broad = broadCache.get(broadKey)!;
          const scope = featureEvidenceScope(row.product_key, row, section), featureKey = JSON.stringify([id, scope]);
          if (!featureCache.has(featureKey)) {
            let bits = 0;
            PROFILE_FEATURE_OPTIONS[section].forEach((feature, bit) => { if (featureEvidenceMatches(evidence.detail, feature, true, scope)) bits |= 1 << bit; });
            featureCache.set(featureKey, bits);
          }
          mask = featureCache.get(featureKey)!;
        }
        const identity = JSON.stringify([row.provider, dims, evidence.status === 'known', broad, mask]);
        let group = groups.get(identity);
        if (!group) {
          group = { cohort: [row.provider, dims, evidence.status === 'known', broad, mask, []], events: new Map() };
          groups.set(identity, group);
        }
        for (const [date, sign] of [[start, 1], [start + count, -1]]) {
          const changes = group.events.get(date) ?? new Map<number, number>();
          for (const rate of rates) changes.set(rate, (changes.get(rate) ?? 0) + sign);
          group.events.set(date, changes);
        }
        const best = section === 'Mortgage' ? rates[0] : rates.at(-1)!;
        const observed = products.get(row.product_key) ?? new Map<number, number>();
        for (let date = start; date < start + count; date++) {
          const prior = observed.get(date);
          observed.set(date, prior === undefined ? best : section === 'Mortgage' ? Math.min(prior, best) : Math.max(prior, best));
        }
        products.set(row.product_key, observed);
      }
    }
    for (const { cohort, events } of groups.values()) {
      cohort[5] = [...events].sort(([a], [b]) => a - b).flatMap(([date, changes]) => {
        const nonzero = [...changes].filter(([, delta]) => delta !== 0).sort(([a], [b]) => a - b);
        return nonzero.length ? [[date, nonzero] as [number, [number, number][]]] : [];
      });
      if (cohort[5].length) ready.sections[section].push(cohort);
    }
    for (const [key, observed] of products) {
      const spans: [number, number, number][] = [];
      for (const [date, best] of [...observed].sort(([a], [b]) => a - b)) {
        const prior = spans.at(-1);
        if (prior && prior[0] + prior[1] === date && prior[2] === best) prior[1]++;
        else spans.push([date, 1, best]);
      }
      ready.products[section].push([key, spans]);
    }
  }
  if (!validateHistoricalBankRateReady(ready, compilerSha)) throw new Error('Compiled history failed count/coverage validation');
  return ready;
}
