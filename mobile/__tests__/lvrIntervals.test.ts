import capture from './fixtures/nab_lvr_app_contract_2026-10-14.json';
import { hasUnspecifiedMortgageLvr } from '../src/data/accountClass';
import { lvrRangeContains, matchesLvrTier, parseLvrRange } from '../src/data/lvrRange';
import { EMPTY_PROFILE, lvrTierForValue, profileFilterRows, scenarioProfileFilterRows } from '../src/data/profile';
import { EMPTY_FILTERS, filterRows } from '../src/data/selectors';
import { lvrTierLabel } from '../src/data/lvrTier';
import { segLabel } from '../src/data/taxonomy';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { compileHistoricalBankRateReady } from '../src/data/historicalBankRateReadyCompiler';
import { historicalReadySnapshots } from '../src/data/historicalBankRateReady';
import { RATE_OBSERVATION_FIELDS, rateTierSignature } from '../src/data/bankRateOverview';
import compiler from '../contracts/history-ready/compiler-manifest.json';
import type { CorePayload, RateRow } from '../src/types';

// Exact compact producer rows from public NAB CDR, version 7, captured 2026-10-14.
const rows = capture.rates as RateRow[];
const high = rows.filter(row => row.lvr_tier === 'lvr_>=80.01-95%');

test.each([80, 80.009, 95.001, 100])('public interval rejects LVR %s outside its genuine bounds', value => {
  expect(lvrRangeContains(parseLvrRange(high[0].lvr_tier)!, value)).toBe(false);
  expect(lvrTierForValue(value, [high[0].lvr_tier!])).toBeNull();
});

test.each([80.01, 85, 85.01, 90, 90.01, 95])('inclusive public interval accepts boundary LVR %s', value => {
  expect(lvrRangeContains(parseLvrRange(high[0].lvr_tier)!, value)).toBe(true);
  expect(lvrTierForValue(value, [high[0].lvr_tier!])).toBe(high[0].lvr_tier);
});

test.each(['lvr_80-85%', 'lvr_85-90%', 'lvr_90-95%'])('saved %s profile, Search and mandatory eligibility retain NAB', tier => {
  const profile = { ...EMPTY_PROFILE, lvrTiers: [tier], rateTypes: ['VARIABLE'], loanPurposes: ['OWNER_OCCUPIED'], repaymentTypes: ['principal_and_interest'] };
  const unknown = { ...high[0], lvr_tier: 'lvr_unspecified' };
  const input = [...rows, unknown];
  expect(profileFilterRows(input, profile, 'Mortgage')).toEqual(high);
  expect(filterRows(input, { ...EMPTY_FILTERS, lvrTiers: [tier] }, null, null, 'Mortgage')).toEqual(high);
  const core = { sections: { Mortgage: { rates: input }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
  const mandatory = selectMandatoryEligibility(core, profile, null);
  expect(high.every(row => mandatory.rows.has(row))).toBe(true);
  expect(mandatory.rows.has(unknown)).toBe(false);
});

test('partial coverage, unknown LVR and explicit caps never become full higher bands', () => {
  expect(matchesLvrTier('lvr_>=80.01-92%', ['lvr_90-95%'])).toBe(false);
  expect(matchesLvrTier('lvr_>=80.01-92%', ['lvr_85-90%'])).toBe(true);
  expect(matchesLvrTier(high[0].lvr_tier, ['lvr_>95%'])).toBe(false);
  expect(matchesLvrTier('lvr_80-85%', ['lvr_85-90%'])).toBe(false);
  expect(matchesLvrTier('lvr_unspecified', ['lvr_85-90%'])).toBe(false);
  expect(matchesLvrTier(undefined, ['lvr_85-90%'])).toBe(false);
  expect(matchesLvrTier('lvr_>=80.01%', ['lvr_90-95%'])).toBe(true);
  expect(hasUnspecifiedMortgageLvr(high[0])).toBe(false);
  expect(hasUnspecifiedMortgageLvr({ ...high[0], lvr_tier: 'lvr_unspecified' })).toBe(true);
});

test('computed scenarios compare every interval containing the exact LVR', () => {
  const conventional = { ...high[0], lvr_tier: 'lvr_90-95%' };
  const capped = { ...high[0], lvr_tier: 'lvr_>=80.01-92%' };
  const unknown = { ...high[0], lvr_tier: 'lvr_unspecified' };
  const input = [high[0], conventional, capped, unknown];
  const profile = { ...EMPTY_PROFILE, lvrTiers: ['lvr_70-80%'] };
  expect(scenarioProfileFilterRows(input, profile, 'Mortgage', 93)).toEqual([high[0], conventional]);
  expect(profile.lvrTiers).toEqual(['lvr_70-80%']);
  expect(scenarioProfileFilterRows(input, profile, 'Mortgage', null)).toEqual([]);
  expect(scenarioProfileFilterRows(input, { ...EMPTY_PROFILE, lvrTiers: ['lvr_90-95%'] }, 'Mortgage', null))
    .toEqual([high[0], conventional]);
  expect(scenarioProfileFilterRows(input, EMPTY_PROFILE, 'Mortgage', null)).toEqual(input);
});

test('numeric labels choose the smallest matching span even when upper caps differ', () => {
  const bounded = high[0].lvr_tier!;
  for (const tiers of [[bounded, 'lvr_90-95%'], ['lvr_90-95%', bounded]]) {
    expect(lvrTierForValue(93, tiers)).toBe('lvr_90-95%');
  }
  for (const tiers of [['lvr_>=80.01-92%', 'lvr_90-95%'], ['lvr_90-95%', 'lvr_>=80.01-92%']]) {
    expect(lvrTierForValue(91, tiers)).toBe('lvr_90-95%');
  }
});

test.each([EMPTY_PROFILE, { ...EMPTY_PROFILE, lvrTiers: ['lvr_90-95%'] }])(
  'out-of-range computed LVR cannot fall back to the saved profile', profile => {
    expect(scenarioProfileFilterRows(rows, profile, 'Mortgage', 98)).toEqual([]);
    expect(scenarioProfileFilterRows(rows, profile, 'Mortgage', 95.001)).toEqual([]);
    expect(scenarioProfileFilterRows(rows, profile, 'Mortgage', 95)).toEqual(high);
    expect(scenarioProfileFilterRows(rows, profile, 'Savings', 98)).toEqual(rows);
  },
);

test.each(['lvr_>=95-90%', 'lvr_>=NaN%', 'lvr_=0%', 'lvr_200-300%', 'lvr_unspecified'])('invalid interval %s remains unavailable', tier => {
  expect(parseLvrRange(tier)).toBeNull();
  expect(hasUnspecifiedMortgageLvr({ ...high[0], lvr_tier: tier })).toBe(true);
});

test('inclusive, exclusive and legacy endpoints retain their individual meanings', () => {
  expect(lvrRangeContains(parseLvrRange('lvr_>=95-95%')!, 95)).toBe(true);
  expect(lvrRangeContains(parseLvrRange('lvr_>80-95%')!, 80)).toBe(false);
  expect(lvrRangeContains(parseLvrRange('lvr_80-85%')!, 80)).toBe(false);
  expect(lvrRangeContains(parseLvrRange('lvr_80-85%')!, 85)).toBe(true);
  expect(lvrTierLabel(high[0].lvr_tier!)).toBe('LVR ≥80.01–95%');
  expect(segLabel('LVR_GE80p01_95')).toBe('≥80.01–95% LVR');
});

test.each([
  ['LVR_LE60', 60, true], ['LVR_LT60', 60, false], ['LVR_70_80', 75, true],
  ['LVR_GE80p01_95', 80.01, true], ['LVR_GT80p01_95', 80.01, false],
  ['≥80.01%', 80.01, true], ['<80%', 80, false],
] as const)('legacy interval %s preserves its endpoint and standard classification', (tier, value, expected) => {
  expect(lvrRangeContains(parseLvrRange(tier)!, value)).toBe(expected);
  expect(hasUnspecifiedMortgageLvr({ ...high[0], lvr_tier: tier })).toBe(false);
});

test('legacy profile coverage respects explicit caps and upper exclusivity', () => {
  expect(matchesLvrTier('LVR_LE60', ['lvr_=60%'])).toBe(true);
  expect(matchesLvrTier('LVR_70_80', ['lvr_70-80%'])).toBe(true);
  expect(matchesLvrTier('LVR_LT80', ['lvr_70-80%'])).toBe(false);
  expect(lvrTierForValue(79.99, ['LVR_LT80'])).toBe('LVR_LT80');
  expect(lvrTierForValue(80, ['LVR_LT80'])).toBeNull();
  expect(hasUnspecifiedMortgageLvr({ ...high[0], lvr_tier: undefined,
    taxonomy_path: 'HOME_LOAN.OO.PI.VARIABLE.LVR_GE80p01_95' })).toBe(false);
});

test.each(['lvr_80-85%', 'lvr_85-90%', 'lvr_90-95%'])('prepared history keeps the same %s profile semantics as current rows', tier => {
  const day = capture.observed_on;
  const groups = new Map<string, { row: Record<string, unknown>; spans: [number, number, number[], number][] }>();
  for (const row of rows) {
    const key = rateTierSignature(row);
    const group: NonNullable<ReturnType<typeof groups.get>> = groups.get(key) ?? { row: Object.fromEntries(Object.entries(row).filter(([field]) => !RATE_OBSERVATION_FIELDS.has(field))),
      spans: [[0, 1, [], 0]] };
    group.spans[0][2].push(Number(row.rate) * 100);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.spans[0][2].sort((a, b) => a - b);
  const catalogue = { schema_version: 2, run_dates: [day], sources: {
    [day]: { kind: 'retained_legacy_export', banks_sha256: capture.response_sha256, bytes: 352347 },
  }, unavailable_dates: {}, evidence: [{ status: 'unknown' }], sections: {
    Mortgage: [...groups.values()], Savings: [], TD: [],
  } };
  const ready = compileHistoricalBankRateReady(catalogue, compiler.sha256);
  const work = historicalReadySnapshots(ready, { interests: ['Mortgage'], includeNonStandard: true,
    profileFilters: { ...EMPTY_PROFILE, lvrTiers: [tier] } });
  let step = work.next();
  while (!step.done) step = work.next();
  expect(step.value[day].Mortgage?.NAB.count).toBe(high.length);
});
