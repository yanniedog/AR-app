import type { CorePayload, RateRow } from '../../src/types';
import type { PublicCatalogueView } from '../../src/data/publicRateIntegration';
import type { PublicProduct, PublicProgramme, PublicReferenceRate } from '../../src/data/publicRateModel';

// Synthetic unit cases exercise app state transitions. Public-source acceptance
// is covered separately by the retained lender captures in publicRateAcceptance.
export const AS_OF = '2026-10-14T03:00:00Z';
export const product: PublicProduct = { productId: 'unit-product', productKey: 'UNIT|LOAN', providerId: 'unit-bank',
  providerName: 'Unit Bank', name: 'Unit Loan', section: 'Mortgage', aliases: [{ name: 'Former Unit Loan', effectiveTo: '2025-12-31' }],
  status: 'current', programmeIds: ['unit-programme'], referenceIds: ['unit-reference'], reasonCodes: [] };
export const row: RateRow = { product_key: product.productKey, provider: product.providerName, product_name: product.name,
  category: 'RESIDENTIAL_MORTGAGES', rate: '0.06', comparison_rate: '0.09', rate_index: 0,
  taxonomy_path: 'HOME_LOAN', loan_purpose: 'OWNER_OCCUPIED', ribbon_repayment_type: 'PRINCIPAL_AND_INTEREST',
  repayment_type: 'PRINCIPAL_AND_INTEREST', rate_type: 'VARIABLE', lvr_tier: 'lvr_60-95%' };
export function programme(overrides: Partial<PublicProgramme> = {}): PublicProgramme {
  return { schemaVersion: 1, programmeId: 'unit-programme', productId: product.productId, section: 'Mortgage', offerId: 'unit-offer',
    conditions: [], components: [{ componentId: 'payable', role: 'payable', value: '0.06', unit: 'fraction_per_annum', scopeId: 'unit-offer',
      conditions: [], evidenceIds: ['unit-evidence'], source: { rawType: 'VARIABLE', rawValue: '0.06', pointer: '/lendingRates/0' } }],
    formula: { op: 'component', componentId: 'payable' }, evidenceIds: ['unit-evidence'], reasonCodes: [],
    freshness: { state: 'current', checkedAt: AS_OF, lastSuccessAt: AS_OF, reasonCodes: [] },
    sourceBindings: [{ rateIndex: 0, pointer: '/lendingRates/0' }], ...overrides };
}
export function reference(overrides: Partial<PublicReferenceRate> = {}): PublicReferenceRate {
  return { referenceId: 'unit-reference', providerId: 'unit-bank', name: 'Unit base variable reference', scopeId: 'unit-scope',
    value: '8.89', unit: 'percentage_points', evidenceIds: ['unit-reference-evidence'],
    freshness: { state: 'current', checkedAt: AS_OF, lastSuccessAt: AS_OF, reasonCodes: [] }, ...overrides };
}
export function catalogue(programmes: PublicProgramme[] = [programme()], products: PublicProduct[] = [product], references = [reference()]): PublicCatalogueView {
  return { status: 'ready', products, references, allLoaded: true,
    getProduct: key => products.find(item => item.productKey === key),
    getProgrammes: id => programmes.filter(item => item.productId === id) };
}
export function core(rows: RateRow[] = [row]): CorePayload {
  const ribbon = { counts: { rates: 0, products: 0, providers: 0 }, range: { min: null, max: null, mean: null, median: null }, providers: [] };
  return { schema_version: 1, run_date: '2026-10-14', brands: {}, rba: [],
    sections: { Mortgage: { rates: rows, ribbon }, Savings: { rates: [], ribbon }, TD: { rates: [], ribbon } } };
}
