import { savingsHarness, savingsInputs } from '../test-support/savingsMonetaryHarness';
import { profile } from '../test-support/executableDepositHarness';
import { compareSavingsHoldings, type HoldingsDraft } from '../src/data/portfolioContracts/adapter';
import { savingsAnswerId } from '../src/data/monetaryContracts/facts';
import { monetaryIdentity } from '../src/data/monetaryContracts/authority';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
async function fixture(criterion = false, packageKey?: string) {
  const h = await savingsHarness(s => {
    if (packageKey) {
      s.scope.packageKey = packageKey;
      s.scopeId = hashText(canonical(['monetary-scope-v3', s.capability, s.scope]));
      for (const a of s.authorityGraph.authorities) {
        const old = a.id; a.scope.packageKey = packageKey; a.id = monetaryIdentity(a, 'id');
        for (const p of s.policy.intervals) if (p.authorityId === old) p.authorityId = a.id;
      }
      s.authorityGraph.identitySha256 = monetaryIdentity(s.authorityGraph, 'identitySha256');
    }
    if (!criterion) return;
    const refs = s.evidence.map(e => e.id);
    s.policy.inputDefinitions.push({ key: 'technical_fact', label: 'Technical criterion', type: 'boolean', unit: null, binding: 'customer_fact', evidenceIds: refs });
    s.policy.eligibility = { id: 'technical-rule', op: 'compare', field: 'technical_fact', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: refs };
  }), [selection] = await h.load();
  const holding = (id: string, amount: string) => ({ selection, target: h.target, inputs: { ...savingsInputs, accountId: id, openingBalance: amount } });
  const draft: HoldingsDraft = { startDate: savingsInputs.startDate, endDateExclusive: savingsInputs.endDateExclusive, timezone: selection.subject.authorityGraph.completedPeriod.timezone,
    metric: 'terminal_net_worth', referenceId: 'one', independentHoldingsConfirmed: true,
    alternatives: [{ id: 'one', accounts: [holding('a', '1000')] }, { id: 'two', accounts: [holding('b', '400'), holding('c', '600')] }] };
  return { h, draft };
}
test('technical approved-handle holdings conserve equal wealth across distinct accounts', async () => {
  const { h, draft } = await fixture(), result = compareSavingsHoldings(h.context, profile, draft);
  // Independent anchor: 1000 * .0365 / 365 * 10 = 1; split 400/600 accrues .4/.6.
  expect(result.receipt.available).toBe(true);
  expect(result.receipt.results.map(r => r.receipt.closingNetWorth)).toEqual(['1001.000000000000', '1001.000000000000']);
  expect(result.receipt.results.map(r => r.rank)).toEqual([1, 1]);
  expect(Object.keys(result.receipt.results[1].receipt.accounts)).toEqual(['b', 'c']);
});
test('opaque package key grants no relationship authority; admitted policy determines independence', async () => {
  const { h, draft } = await fixture(false, 'technical-opaque-scope');
  expect(compareSavingsHoldings(h.context, profile, draft).receipt.available).toBe(true);
  (draft.alternatives[0].accounts[0].selection.subject.policy as any).linkedAccounts = 'required';
  expect(() => compareSavingsHoldings(h.context, profile, draft)).toThrow('Linked movements or fee obligations');
});
test.each(['wealth', 'unknown', 'failed'])('technical %s mismatch leaves every alternative unranked', async fault => {
  const { h, draft } = await fixture(fault !== 'wealth');
  if (fault === 'wealth') draft.alternatives[1].accounts[0].inputs.openingBalance = '401';
  else {
    const unknown = { ...profile, answers: fault === 'unknown' ? {} : { [savingsAnswerId(h.subject, 'technical_fact')]: { state: 'known' as const, fact: { type: 'boolean' as const, value: false }, provenance: { source: 'user_input' as const, recordedAt: null, productKey: h.target.productKey, effectiveFrom: null, effectiveToExclusive: null } } } };
    const result = compareSavingsHoldings(h.context, unknown, draft);
    expect(result.receipt.available).toBe(false); expect(result.receipt.results.every(r => r.rank === null && r.advantage === null)).toBe(true); return;
  }
  const result = compareSavingsHoldings(h.context, profile, draft);
  expect(result.receipt.available).toBe(false); expect(result.receipt.issues).toContain('comparison_frame_mismatch');
});
test.each(['date','duplicate','movement','stale','limit'])('refuses technical %s assembly without altering family contracts', async fault => {
  const { h, draft } = await fixture(), a = draft.alternatives[1].accounts;
  if (fault === 'date') a[0].inputs.endDateExclusive = '2026-01-10';
  if (fault === 'duplicate') a[1].inputs.accountId = a[0].inputs.accountId;
  if (fault === 'movement') a[0].inputs.noMovements = false;
  if (fault === 'stale') delete (h.context.manifest as any).executable_v3;
  if (fault === 'limit') a.push(a[0], a[0], a[0]);
  expect(() => compareSavingsHoldings(h.context, profile, draft)).toThrow();
});
