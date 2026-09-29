import fixture from './fixtures/product-coverage-20260929.json';
import type { CorePayload, DetailsPayload, ProductDetail, RateRow, SectionKey } from '../src/types';
import { assessAccess } from '../src/data/access';
import { isBroadlyAvailable, visibleAccountRows } from '../src/data/format';
import { buildSuitabilityIndex, clearSuitabilityIndex, installSuitabilityIndex } from '../src/data/suitabilityIndex';
import { EMPTY_FILTERS, filterRows, groupByProvider } from '../src/data/selectors';
import { EMPTY_PROFILE } from '../src/data/profile';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';

jest.mock('../src/data/cache', () => ({ cache: {} }));

const examples = fixture.examples as { section: SectionKey; row: RateRow; detail: ProductDetail }[];
const products = Object.fromEntries(examples.map(({ row, detail }) => [row.product_key, detail]));
const core = {
  run_date: '2026-09-29',
  sections: Object.fromEntries(['Mortgage', 'Savings', 'TD'].map(section => [section, {
    rates: examples.filter(e => e.section === section).map(e => e.row),
  }])),
} as CorePayload;

afterEach(() => {
  clearSuitabilityIndex();
  installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null));
});

describe('published product coverage regressions', () => {
  it.each(examples)('keeps $row.provider / $row.product_name available', ({ row, detail }) => {
    expect(assessAccess(row.product_name, detail, row.provider).restricted).toBe(false);
    expect(isBroadlyAvailable(row, detail)).toBe(true);
  });

  it('preserves restored products in cold and indexed lists, search and bank grouping', async () => {
    const check = () => {
      for (const section of ['Mortgage', 'Savings', 'TD'] as const) {
        const rows = core.sections[section].rates;
        expect(visibleAccountRows(rows, false, products)).toEqual(rows);
        expect(filterRows(rows, EMPTY_FILTERS, products, null, section)).toEqual(rows);
      }
      const bankRows = groupByProvider(core.sections, 'base', false, products).flatMap(group => group.rows);
      expect(new Set(bankRows.map(r => r.product_key))).toEqual(new Set(examples.map(e => e.row.product_key)));
    };
    check();
    installSuitabilityIndex(await buildSuitabilityIndex(core, { products } as DetailsPayload));
    check();
  });

  it('still applies mandatory profile requirements to restored rows', () => {
    const selection = selectMandatoryEligibility(core, { ...EMPTY_PROFILE, rateTypes: ['VARIABLE'] }, products);
    installMandatoryEligibility(selection);
    const mortgage = core.sections.Mortgage.rates;
    expect(mortgage.some(r => r.rate_type === 'FIXED')).toBe(true);
    expect(visibleAccountRows(mortgage, true, products)).toEqual(mortgage.filter(r => r.rate_type === 'VARIABLE'));
  });
});

describe('restriction boundaries after coverage repair', () => {
  it.each([
    ['Staff term deposit', { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'STAFF' }] }],
    ['Saver', { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'STAFF', info: 'Apply through staff assisted channels.' }] }],
    ['Business saver', { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'BUSINESS' }] }],
    ['Saver', { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'BUSINESS', info: 'Only available to businesses' }] }],
    ['Saver', { eligibility: [{ label: 'BUSINESS' }] }],
    ['Saver', { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'BUSINESS' }, { label: 'OTHER', info: 'Available only through approved platforms or accredited partners' }] }],
    ['Saver', { eligibility: [{ label: 'NATURAL_PERSON' }, { label: 'BUSINESS' }, { label: 'OTHER', info: 'Available to National Seniors Australia members' }] }],
    ['Saver', { eligibility: [{ label: 'OTHER', info: 'Must be a member of the Credit Union' }] }],
    ['Saver', { eligibility: [{ label: 'OTHER', info: 'To join, have an association with Riverside Corporate or work in a STEM industry.' }] }],
    ['Youth term deposit', { description: 'Term deposits from $5000. Youth deposits from $1000 (under 20 years).' }],
    ['Term deposit', { description: 'Youth deposits from $1000 (under 20 years).' }],
  ] as [string, ProductDetail][])('keeps actual restrictions for %s', (name, detail) => {
    expect(assessAccess(name, detail, 'Some Credit Union').restricted).toBe(true);
  });

  it('does not confuse broker-introduced business with business-only applicants', () => {
    expect(assessAccess('Home Loan', { eligibility: [
      { label: 'NATURAL_PERSON' }, { label: 'OTHER', info: 'Only available for business introduced through Broker' },
    ] }).restricted).toBe(false);
  });

  it('preserves unspecified LVR, non-standard and conditional savings exclusions', () => {
    const loan = examples.find(e => e.section === 'Mortgage')!.row;
    const saver = examples.find(e => e.section === 'Savings')!.row;
    expect(isBroadlyAvailable({ ...loan, lvr_tier: 'lvr_unspecified' })).toBe(false);
    expect(isBroadlyAvailable({ ...saver, account_class: 'non_standard' })).toBe(false);
    expect(isBroadlyAvailable({ ...saver, ribbon_deposit_kind: 'bonus' })).toBe(false);
  });
});
