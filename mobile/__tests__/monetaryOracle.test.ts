import vectors from './fixtures/monetary-v3-independent-oracles.json';
import { savingsHarness } from '../test-support/savingsMonetaryHarness';
import { profile } from '../test-support/executableDepositHarness';
import { calculateSavingsPeriod } from '../src/data/monetaryContracts/adapter';
import { monetaryIdentity } from '../src/data/monetaryContracts/authority';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import type { SavingsPeriodInputs } from '../src/data/monetaryContracts/facts';
import type { SavingsPolicy } from '../src/data/monetaryContracts/types';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
const refusalMessages: Record<string, RegExp> = {
  'confirmation:openingFundsCleared': /confirmed cleared/, 'confirmation:openingAccrualZero': /Confirm the complete local account period/,
  'confirmation:noMovements': /Confirm the complete local account period/, 'confirmation:noWithholding': /Confirm the complete local account period/,
  completed_period: /outside source-reviewed historical coverage|exceeds source-owned completed coverage/, rate_confirmation: /Confirmed account rates differ/,
  posting_inventory_incomplete: /Required posting dates omitted or changed/, posting_interval_inventory: /Savings posting event missing or extra/,
  posting_source_coverage: /Source posting inventory incomplete/, interval_gap_overlap: /Savings intervals overlap or leave gap/,
  global_interest_policy_changed: /Changing savings interest policy is unsupported/,
};
// Independent Python Decimal/date expectations retained unchanged. Structured graph below
// is engineering scaffolding only, never an approved or displayed bank product.
test.each(vectors.vectors)('independent adapter oracle $id', async vector => {
  const h = await savingsHarness(s => {
    s.policy = structuredClone(vector.policy) as unknown as SavingsPolicy;
    const from = s.policy.postingInventory.from, end = s.policy.postingInventory.toExclusive;
    s.scope.from = from; s.scope.toExclusive = end;
    s.scopeId = hashText(canonical(['monetary-scope-v3', s.capability, s.scope]));
    const a = s.authorityGraph.authorities[0]; a.from = from; a.toExclusive = end; a.scope = { ...s.scope };
    a.fieldCoverage.forEach(f => { f.from = from; f.toExclusive = end; f.postingEventDates = s.policy.postingInventory.dueDates.filter(d => d >= from && d < end); });
    a.id = monetaryIdentity(a, 'id'); s.policy.intervals.forEach(p => { p.authorityId = a.id; });
    s.authorityGraph.completedPeriod.completedThroughExclusive = vector.completedThroughExclusive;
    s.authorityGraph.completedPeriod.asOf = `${vector.completedThroughExclusive}T23:59:59Z`;
    s.authorityGraph.identitySha256 = monetaryIdentity(s.authorityGraph, 'identitySha256');
  });
  const raw = vector.privateInput; let rateIndex = 0;
  const inputs = { ...raw, confirmedAnnualRates: h.subject.policy.intervals.flatMap(i => i.tiers.map(t => ({ intervalId: i.id, tierId: t.id, annualRate: raw.confirmedAnnualRates[rateIndex++] }))) };
  const run = async () => { const [selection] = await h.load(); return calculateSavingsPeriod(selection, h.context, h.target, inputs as unknown as SavingsPeriodInputs, profile); };
  if (vector.phase === 'refusal') { const expected = refusalMessages[(vector.outcome as any).reason]; expect(expected).toBeDefined(); await expect(run()).rejects.toThrow(expected); return; }
  const result = await run(); expect(result.receipt.issues).toEqual([]);
  expect(result.receipt.totals).toMatchObject((vector.outcome as any).totals);
  expect(result.receipt.ledger.map(({ date, type, amount, balance }) => ({ date, type, amount, balance }))).toEqual((vector.outcome as any).ledger);
  for (const day of (vector.outcome as any).daily) {
    const row = result.receipt.ledger.find(r => r.date === day.date && r.type === 'interest_accrual')!;
    expect(row.balance).toBe(day.basis); expect(row.amount).toBe(day.accrual);
    expect(row.savingsContributions?.map(c => c.intervalId)).toEqual([day.intervalId]);
    expect(row.savingsContributions?.flatMap(c => c.tiers.map(t => ({ tierId: t.id, basis: t.basis, annualRate: t.annualRate, accrual: t.accrual })))).toEqual(day.contributions);
  }
  // Per-day cumulative unposted/rounding registers are not exposed by ledger rows.
  // Their terminal values are checked above; no claim of intermediate-register parity.
});
