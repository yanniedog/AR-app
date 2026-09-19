import { productHasAllFeatures } from '../src/data/features';
import { featureEvidenceScope, normalizedProductFacts, productMatchesFactCriterion,
  publishedFactFilterOptions } from '../src/data/productFacts';
import { filterRows, EMPTY_FILTERS } from '../src/data/selectors';
import type { NormalizedProductFact, ProductDetail, RateRow } from '../src/types';

const row: RateRow = { product_key: 'p', provider: 'Bank', product_name: 'Loan', rate: '0.05', rate_type: 'VARIABLE' };
const positive: NormalizedProductFact = { id: 'positive', kind: 'feature', canonicalKey: 'feature.offset',
  sourceType: 'OFFSET', unit: 'boolean', value: true };
const exists = { canonicalKey: 'feature.offset', operator: 'exists' as const };
const equal = { ...exists, operator: 'eq' as const, value: true, unit: 'boolean' as const };

describe('required feature facts share fail-closed semantics', () => {
  test.each([
    ['missing', []], ['unknown', [{ ...positive, value: undefined }]],
    ['negative', [{ ...positive, value: false }]], ['untyped', [{ ...positive, unit: undefined }]],
    ['condition', [{ ...positive, condition: 'Package customers only' }]],
    ['incompatible', [{ ...positive, appliesTo: ['FIXED'] }]],
    ['conflict', [positive, { ...positive, id: 'negative', value: false }]],
    ['mixed unknown', [positive, { ...positive, id: 'unknown', value: undefined }]],
  ] as [string, NormalizedProductFact[]][])('%s cannot match restored exists or positive criteria', (_, facts) => {
    const detail: ProductDetail = { facts };
    const before = JSON.stringify(detail);
    expect(productHasAllFeatures('p', ['OFFSET'], { p: detail }, row, 'Mortgage')).toBe(false);
    for (const criterion of [exists, equal, { sourceType: 'OFFSET', operator: 'exists' as const }]) {
      expect(productMatchesFactCriterion(detail, criterion, featureEvidenceScope('p', row, 'Mortgage'))).toBe(false);
      expect(filterRows([row], { ...EMPTY_FILTERS, factCriteria: [criterion] }, { p: detail }, null, 'Mortgage')).toEqual([]);
    }
    expect(JSON.stringify(detail)).toBe(before);
    expect(normalizedProductFacts(detail)).toHaveLength(facts.length);
  });

  test('applicable positives match and evidence changes immediately revoke the result', () => {
    const detail: ProductDetail = { facts: [{ ...positive, appliesTo: ['VARIABLE'] }] };
    const filters = { ...EMPTY_FILTERS, factCriteria: [exists] };
    expect(filterRows([row], filters, { p: detail }, null, 'Mortgage')).toEqual([row]);
    expect(filterRows([row], filters, null, null, 'Mortgage')).toEqual([]);
    detail.facts![0].value = undefined;
    expect(filterRows([row], filters, { p: detail }, null, 'Mortgage')).toEqual([]);
  });

  test('unknown feature chips are omitted but explicit absence remains selectable', () => {
    const detail: ProductDetail = { facts: [{ ...positive, value: undefined }] };
    expect(publishedFactFilterOptions([row], { p: detail })).toEqual([]);
    detail.facts![0].value = false;
    const options = publishedFactFilterOptions([row], { p: detail });
    expect(options).toHaveLength(1);
    expect(options[0].criterion.value).toBe(false);
    expect(productMatchesFactCriterion(detail, options[0].criterion)).toBe(true);
  });
});
