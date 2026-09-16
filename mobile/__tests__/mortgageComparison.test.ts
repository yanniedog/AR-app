import { mortgageComparisonHarness } from '../test-support/mortgageComparisonHarness';
import { compareMortgagePeriods } from '../src/data/portfolioContracts/mortgageAdapter';
import { profile } from '../test-support/executableDepositHarness';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));

test('actual admitted payment and external fee compare against independent decimal hand anchors', async () => {
  const h = await mortgageComparisonHarness(), r = compareMortgagePeriods(h.context, profile, h.draft);
  // Independent one-day ACT/365 arithmetic: 1000*.0365/365=.10 and
  // 1000*.073/365=.20. After-accrual payment 30 pays .10/.20 interest,
  // leaving principal 970.10/970.20. Outside fees 2/3 reduce frame wealth
  // once, yielding -972.10/-973.20 and costs 2.10/3.20, not 30 repayments.
  expect(r.receipt.available).toBe(true);
  expect(r.receipt.results.map(x => [x.receipt.closingNetWorth, x.receipt.netInterestFeeCost, x.advantage, x.rank])).toEqual([
    ['-972.100000000000', '2.100000000000', '0.000000000000', 1],
    ['-973.200000000000', '3.200000000000', '-1.100000000000', 2],
  ]);
  expect(r.receipt.results[0].receipt.externalContributionNet).toBe('30.00');
  expect(r.comparisonInputs.comparisonInput.alternatives[0].input.frame.externalFlows).toEqual([{ id: 'pay1', date: '2024-01-01', delta: '30.00' }]);
  expect(r.inputSha256).toBe(hashText(canonical(r.comparisonInputs)));
  expect(r.comparisonInputs.children).toHaveLength(2);
});

test.each(['opening', 'payments', 'period', 'timezone', 'confirmation', 'fee', 'rate', 'stale'] as const)('refuses incomparable or unconfirmed %s', async kind => {
  const h = await mortgageComparisonHarness(), d = h.draft, second = d.alternatives[1].inputs;
  if (kind === 'opening') { second.openingOutstanding = '1001'; second.openingComponents.principal = '1001'; }
  if (kind === 'payments') second.payments[0].amount = '29';
  if (kind === 'period') d.endDateExclusive = '2024-01-03';
  if (kind === 'timezone') d.timezone = d.timezone === 'Australia/Hobart' ? 'Australia/Sydney' : 'Australia/Hobart';
  if (kind === 'confirmation') d.independentLoansConfirmed = false;
  if (kind === 'fee') second.feeSettlements = [];
  if (kind === 'rate') second.confirmedAnnualRate = '0.04';
  if (kind === 'stale') h.context.manifest = { ...h.context.manifest };
  if (kind === 'opening') {
    const r = compareMortgagePeriods(h.context, profile, d).receipt;
    expect(r.available).toBe(false); expect(r.issues).toContain('comparison_frame_mismatch');
  } else expect(() => compareMortgagePeriods(h.context, profile, d)).toThrow();
});

test.each(['unpaid', 'partial', 'unknown', 'false'] as const)('never ranks %s child results', async state => {
  const h = await mortgageComparisonHarness();
  for (const a of h.draft.alternatives) {
    if (state === 'unpaid') a.inputs.payments = [];
    if (state === 'partial') a.inputs.payments[0].amount = '29';
    if (state === 'unknown') a.inputs.customerFacts = [];
    if (state === 'false') a.inputs.customerFacts[0].value = { type: 'boolean', value: false };
  }
  const r = compareMortgagePeriods(h.context, profile, h.draft).receipt;
  expect(r.available).toBe(false); expect(r.results).toHaveLength(2);
  expect(r.results.every(x => x.rank === null && x.advantage === null && x.breakEven === null)).toBe(true);
});

test('opening accrued debt keeps its full admitted precision in both comparison frames', async () => {
  const h = await mortgageComparisonHarness();
  for (const a of h.draft.alternatives) {
    a.inputs.openingComponents.accruedInterest = '0.000000000001';
    a.inputs.openingOutstanding = '1000.000000000001';
  }
  const r = compareMortgagePeriods(h.context, profile, h.draft);
  expect(r.comparisonInputs.comparisonInput.alternatives.map(a => a.input.frame.openingNetWorth)).toEqual(['-1000.000000000001', '-1000.000000000001']);
  expect(r.receipt.available).toBe(true);
});
