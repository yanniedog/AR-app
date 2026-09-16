import type { CorePayload, NormalizedProductFact, ProductDetail, RateRow } from '../src/types';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility, mandatoryEligibleRows, mandatoryProductAllowed, isMandatoryEligibilityReady } from '../src/data/eligibilityGate';
import { EMPTY_FILTERS, filterRows, findEligibleByKey, sortRows } from '../src/data/selectors';
import { statsFor, childrenOf } from '../src/data/taxonomy';
import { resolveCompareSelections } from '../src/data/compareSelection';
import { productHasAllFeatures } from '../src/data/features';

const row = (key: string, rateType = 'VARIABLE'): RateRow => ({ product_key: key, product_name: key, provider: key, rate: '0.05', rate_type: rateType, rate_index: rateType === 'FIXED' ? 1 : 0, taxonomy_path: `HOME_LOAN.OO.PI.${rateType}` });
const fact = (key = 'OFFSET', value: unknown = true, appliesTo?: string[]): NormalizedProductFact => ({ id: key, kind: 'feature', canonicalKey: key, unit: 'boolean', value, appliesTo } as NormalizedProductFact);
const mortgages = [row('positive'), row('negative'), row('unknown'), row('missing'), row('scoped'), row('scoped', 'FIXED')];
const savings = row('savings');
const core = { sections: { Mortgage: { rates: mortgages }, Savings: { rates: [savings] }, TD: { rates: [] } } } as unknown as CorePayload;
const details: Record<string, ProductDetail> = {
  positive: { facts: [fact(), fact('REDRAW')] }, negative: { facts: [fact('OFFSET', false)] },
  unknown: { facts: [fact('OFFSET', 'unknown')] }, missing: { features: [{ label: 'OFFSET' }] },
  scoped: { facts: [fact('OFFSET', true, ['VARIABLE'])] },
};
const required = { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] };
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('positive applicable evidence only; missing, false, unknown and incompatible variants fail', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core, required, details));
  expect(mandatoryEligibleRows(mortgages)).toEqual([mortgages[0], mortgages[4]]);
  expect(mandatoryEligibleRows([savings])).toEqual([savings]);
  expect(mandatoryProductAllowed('missing')).toBe(false);
  expect(productHasAllFeatures('positive', ['OFFSET', 'REDRAW'], details)).toBe(true);
  expect(productHasAllFeatures('scoped', ['OFFSET', 'REDRAW'], details, mortgages[4], 'Mortgage')).toBe(false);
  expect(productHasAllFeatures('conflict', ['OFFSET'], { conflict: { facts: [fact(), fact('OFFSET', false)] } })).toBe(false);
});

test('delayed details stay closed and immediately rebuild after profile or evidence replacement', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core, required, null));
  expect(isMandatoryEligibilityReady()).toBe(false);
  expect(mandatoryEligibleRows(mortgages)).toEqual([]);
  installMandatoryEligibility(selectMandatoryEligibility(core, required, details));
  expect(isMandatoryEligibilityReady()).toBe(true);
  expect(mandatoryEligibleRows(mortgages)).toHaveLength(2);
  installMandatoryEligibility(selectMandatoryEligibility(core, { ...required, accountFeatures: ['OFFSET', 'REDRAW'] }, details));
  expect(mandatoryEligibleRows(mortgages)).toEqual([mortgages[0]]);
  installMandatoryEligibility(selectMandatoryEligibility(core, required, { ...details, positive: { facts: [fact('OFFSET', false)] } }));
  expect(mandatoryEligibleRows(mortgages)).toEqual([mortgages[4]]);
  installMandatoryEligibility(selectMandatoryEligibility(core, EMPTY_PROFILE, null));
  expect(mandatoryEligibleRows(mortgages)).toEqual(mortgages);
});

test('restored broad filters cannot relax profile before sorting, counts, hierarchy or direct selections', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core, required, details));
  const visible = filterRows(mortgages, { ...EMPTY_FILTERS, includeNonStandard: true }, details, undefined, 'Mortgage');
  expect(visible).toEqual([mortgages[0], mortgages[4]]);
  expect(sortRows(mortgages, 'rate', 'Mortgage')).toHaveLength(2);
  expect(statsFor(mortgages, true).products).toBe(2);
  expect(childrenOf(mortgages, 'Mortgage', [], true)[0].stats.count).toBe(2);
  expect(findEligibleByKey(core.sections, 'negative')).toBeNull();
  expect(resolveCompareSelections(core, ['1#scoped'])).toEqual([]);
  expect(resolveCompareSelections(core, ['0#scoped'])).toHaveLength(1);
  expect(core.sections.Mortgage.rates).toHaveLength(6);
});

test('previous payload rows and cached copies cannot bypass adopted evidence', () => {
  installMandatoryEligibility(selectMandatoryEligibility(core, required, details));
  expect(mandatoryEligibleRows([{ ...mortgages[0] }])).toEqual([]);
  const nextRows = mortgages.map(value => ({ ...value }));
  const next = { ...core, sections: { ...core.sections, Mortgage: { ...core.sections.Mortgage, rates: nextRows } } };
  installMandatoryEligibility(selectMandatoryEligibility(next, required, details));
  expect(mandatoryEligibleRows(mortgages)).toEqual([]);
  expect(mandatoryEligibleRows(nextRows)).toHaveLength(2);
});
