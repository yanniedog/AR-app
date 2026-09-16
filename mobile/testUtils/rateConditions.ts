import raw from '../__tests__/fixtures/rateConditions/macquarie-digital-2026-09-15.json';
import projected from '../__tests__/fixtures/rateConditions/macquarie-digital-2026-09-15.rate-conditions.json';
import type { CorePayload, DetailsPayload, RateConditions, RateRow } from '../src/types';
import { revisionManifest } from './payloadRevision';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';

/** Real captured CDR rows, enclosed in test-only publication metadata. No adapter approval. */
export function rateConditionFixture() {
  const productKey = 'macquarie:TD001MBLTDA002';
  const rows: RateRow[] = raw.data.depositRates.map((rate, i) => ({ provider: 'Macquarie', product_id: raw.data.productId,
    product_key: productKey, product_name: raw.data.name, rate: rate.rate, rate_index: i + 1, term: rate.additionalValue, rate_type: rate.depositRateType }));
  const ribbon = { counts: { rates: 0, products: 0, providers: 0 }, range: { min: null, max: null, mean: null, median: null }, providers: [] };
  const coreInput: CorePayload = { schema_version: 1, run_date: '2026-09-15', brands: {}, rba: [], sections: { TD: { rates: rows, ribbon }, Savings: { rates: [], ribbon }, Mortgage: { rates: [], ribbon } } };
  const manifest = { ...revisionManifest(1), run_date: coreInput.run_date };
  const { core, integrity: coreIntegrity } = normalizeCoreWithIntegrity(coreInput, { coreSha256: manifest.files.core.sha256 });
  const details: DetailsPayload = { schema_version: 1, run_date: core.run_date, products: { [productKey]: { rateConditions: JSON.parse(JSON.stringify(projected)) as RateConditions } } };
  bindVerifiedDetails(details, manifest.files.details.sha256);
  return { core, details, manifest, coreIntegrity, rows: core.sections.TD.rates, productKey };
}
