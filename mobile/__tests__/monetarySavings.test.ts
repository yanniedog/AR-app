import { savingsHarness, savingsInputs, savingsSubject } from '../test-support/savingsMonetaryHarness';
import { profile } from '../test-support/executableDepositHarness';
import { validateSavingsSubject } from '../src/data/monetaryContracts/validation';
import { calculateSavingsPeriod } from '../src/data/monetaryContracts/adapter';
import { monetaryIdentity, assertFieldCoverage } from '../src/data/monetaryContracts/authority';
import { savingsRateLabel, savingsRatePercent } from '../src/components/product/savingsRateLabels';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
test('rate confirmation labels preserve zero and source-declared balance portions', () => {
  const period = savingsSubject().policy.intervals[0];
  period.tiers = [{ ...period.tiers[0], upperInclusive: '1000' }, { ...period.tiers[0], id: 'next', upperInclusive: null }];
  expect(savingsRatePercent('0')).toBe('0'); expect(savingsRatePercent('0.0365')).toBe('3.65');
  expect(savingsRateLabel(period, 0)).toBe('Marginal tier: AUD 0 to AUD 1000');
  period.allocation = 'whole_balance'; expect(savingsRateLabel(period, 1)).toBe('Whole balance: over AUD 1000');
});
test('validates structured authority and actual source-bound savings adapter independently expected1.00', async () => {
  expect(validateSavingsSubject(savingsSubject()).capability).toBe('savings_calculation');
  const h = await savingsHarness(), [selection] = await h.load();
  const r = calculateSavingsPeriod(selection, h.context, h.target, savingsInputs, profile);
  expect(r.receipt.issues).toEqual([]); expect(r.receipt.claimAvailable).toBe(true); expect(r.receipt.totals?.closingBalance).toBe('1001.00');
});
test('adjacent source coverage composes without concealing a missing day or posting', () => {
  const a = savingsSubject().authorityGraph.authorities[0], f = a.fieldCoverage.find(f => f.field === 'balanceBasis')!;
  a.fieldCoverage = [{ ...f, toExclusive: '2026-01-06', postingEventDates: [] }, { ...f, from: '2026-01-06' }];
  expect(() => assertFieldCoverage(a, f.field, '2026-01-01', '2026-01-11', f.postingEventDates, f.evidenceIds)).not.toThrow();
  a.fieldCoverage[0].evidenceIds = ['source-A']; a.fieldCoverage[1].evidenceIds = ['source-B'];
  expect(() => assertFieldCoverage(a, f.field, '2026-01-01', '2026-01-11', f.postingEventDates, ['source-A', 'source-B'])).not.toThrow();
  a.fieldCoverage.forEach(entry => { entry.evidenceIds = f.evidenceIds; });
  a.fieldCoverage[1].from = '2026-01-07';
  expect(() => assertFieldCoverage(a, f.field, '2026-01-01', '2026-01-11', [], f.evidenceIds)).toThrow('Source coverage missing');
  a.fieldCoverage[1].from = '2026-01-06'; a.fieldCoverage[1].postingEventDates = [];
  expect(() => assertFieldCoverage(a, f.field, '2026-01-01', '2026-01-11', f.postingEventDates, f.evidenceIds)).toThrow('Source coverage missing');
});
test('source supersession need cover only the actual overlapping interval', () => {
  const s = savingsSubject(), selected = s.authorityGraph.authorities[0], other = structuredClone(selected);
  other.toExclusive = '2026-01-06'; other.scope.toExclusive = other.toExclusive;
  other.fieldCoverage = other.fieldCoverage.map(f => ({ ...f, toExclusive: other.toExclusive, postingEventDates: [] }));
  other.id = monetaryIdentity(other, 'id'); s.authorityGraph.authorities.push(other);
  s.authorityGraph.supersessions = [{ selectedAuthorityId: selected.id, supersededAuthorityId: other.id, from: other.from, toExclusive: other.toExclusive, evidenceIds: selected.evidenceIds }];
  s.authorityGraph.identitySha256 = monetaryIdentity(s.authorityGraph, 'identitySha256'); s.id = monetaryIdentity(s, 'id');
  expect(() => validateSavingsSubject(s)).not.toThrow();
  s.authorityGraph.supersessions[0].toExclusive = '2026-01-11';
  s.authorityGraph.identitySha256 = monetaryIdentity(s.authorityGraph, 'identitySha256'); s.id = monetaryIdentity(s, 'id');
  expect(() => validateSavingsSubject(s)).toThrow('Supersession exceeds authority overlap');
});
test.each([null, false])('cleared-only account refuses unconfirmed opening funds %s', async state => {
  const h = await savingsHarness(), [selection] = await h.load();
  expect(() => calculateSavingsPeriod(selection, h.context, h.target, { ...savingsInputs, openingFundsCleared: state }, profile)).toThrow('confirmed cleared');
});
test.each([
  { confirmedAnnualRates: [{ intervalId: 'period-1', tierId: 'tier-1', annualRate: '0.03' }] },
  { endDateExclusive: '2026-01-12' }, { noMovements: false }, { openingAccrualZero: false }, { noWithholding: false },
])('refuses unsupported private account state %j', async changed => {
  const h = await savingsHarness(), [selection] = await h.load();
  expect(() => calculateSavingsPeriod(selection, h.context, h.target, { ...savingsInputs, ...changed }, profile)).toThrow();
});
test.each(['posting omission','unknown residue','tier inversion'])('refuses %s', kind => {
  const s = savingsSubject();
  if (kind === 'posting omission') s.policy.postingInventory.dueDates = [];
  if (kind === 'unknown residue') s.policy.intervals[0].interest.postingResidue = 'unknown' as any;
  if (kind === 'tier inversion') s.policy.intervals[0].tiers[0].upperInclusive = '0';
  s.id = monetaryIdentity(s, 'id'); expect(() => validateSavingsSubject(s)).toThrow();
});
