import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { EngineReceiptFacts } from '../src/components/product/EngineReceiptFacts';
import { receiptAssumptionFacts, receiptCriterionFacts, receiptIssueFacts } from '../src/lib/engineReceiptFactModel';
import { calculateLedger } from '../src/lib/productTermsEngine/ledger';
import { example } from '../src/lib/productTermsEngine/testSupport';
import { canonical } from '../src/lib/productTermsEngine/validation';
import type { CalculationReceipt } from '../src/lib/productTermsEngine/types';
import { calculatePortfolio } from '../src/lib/productTermsEngine/portfolio';
import type { PortfolioInput } from '../src/lib/productTermsEngine/portfolioTypes';
import { EvaluationBudget } from '../src/lib/productTermsEngine/evaluationBudget';
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row' }));
function missingReceipt(): CalculationReceipt {
  const { contract, scenario } = example();
  contract.eligibility = { id: 'customer-criterion', op: 'compare', field: 'qualification', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: contract.initialRateEvidenceIds };
  return calculateLedger(contract, scenario);
}
function render(receipt: CalculationReceipt) {
  let tree!: ReactTestRenderer; act(() => { tree = TestRenderer.create(<EngineReceiptFacts receipt={receipt} />); });
  const text = (tree as any).root.findAllByType('AppText').map((node: any) => String(node.props.children)).join('\n');
  act(() => tree.unmount()); return text;
}
function portfolioInput(): PortfolioInput {
  const { contract, scenario } = example();
  contract.direction = 'asset'; contract.interest.offset = 'none';
  scenario.accountId = 'cash'; scenario.openingBalance = '1000'; scenario.initialOffset = '0';
  return { schemaVersion: 1, frame: { id: 'frame', currency: 'AUD', startDate: scenario.startDate,
    endDateExclusive: scenario.endDateExclusive, timezone: 'Australia/Hobart', settlement: 'same_civil_day',
    valuation: 'holding_with_accrued_interest', openingNetWorth: '1000', scopeCoverage: 'reviewed_complete',
    externalFlows: [], externalFeeFunding: 'outside_frame_cost_adjustment', allowConditional: false, metric: 'terminal_net_worth' },
    accounts: [{ id: 'cash', timezone: 'Australia/Hobart', contract, scenario }], transfers: [], dependencyGraph: [], dependencyIds: contract.dependencyIds };
}
test('actual incomplete engine receipt identifies missing input and unverified coverage without granting or printing a monetary claim', () => {
  const receipt = missingReceipt(), original = canonical(receipt), text = render(receipt);
  expect(receipt.status).toBe('incomplete'); expect(receipt.claimAvailable).toBe(false); expect(receipt.totals).not.toBeNull();
  expect(text).toContain('Applicability: Unverified'); expect(text).toContain('Material terms: Unverified'); expect(text).toContain('Fee inventory: Unavailable');
  expect(text).toContain('customer-criterion: Needs information · Missing input: qualification');
  expect(text).toContain('Claim available: No'); expect(text).toContain('Completeness: Partial');
  expect(text).not.toContain('$'); expect(text).not.toContain(receipt.assumptions[0]);
  expect(text).toContain('Assumption 1 · Calculation: Source review required');
  expect(canonical(receipt)).toBe(original);
});
test('known condition codes retain exact fee and savings references; arbitrary errors and assumptions never render', () => {
  const receipt = { ...missingReceipt(), issues: ['fee_timing_unknown:fee.one', 'savings_qualification_unknown:interval.one:bonus.one', 'td_tax_treatment_unknown', 'Read this explanatory approval paragraph.', 'fee_timing_unknown:Read this paragraph.', 'unsupported_term:marketing explanation', 'fee_price_unknown:marketing explanation'],
    assumptions: ['A user supplied explanatory assumption.', 'loan_projected_executions_assumption'] };
  const facts = receiptIssueFacts(receipt), original = canonical(receipt), text = render(receipt);
  expect(facts[0]).toMatchObject({ topic: 'fee-timing', state: 'unknown', references: ['fee.one'] });
  expect(facts[1]).toMatchObject({ topic: 'bonus-qualification', references: ['interval.one', 'bonus.one'] });
  expect(text).toContain('Tax treatment: Unknown'); expect(text).toContain('Fee timing: Unknown · fee.one');
  expect(text).toContain('Bonus qualification: Unknown · interval.one · bonus.one');
  expect(facts[3]).toMatchObject({ state: 'source-review-required', code: null, references: [] });
  expect(facts[4]).toMatchObject({ state: 'source-review-required', code: null, references: [] });
  expect(facts[5]).toMatchObject({ state: 'source-review-required', code: null, references: [] });
  expect(facts[6]).toMatchObject({ state: 'source-review-required', code: null, references: [] });
  expect(receiptIssueFacts({ ...receipt, issues: ['fee_waiver_unknown:fee:charge:2026-10-15'] })[0].references).toEqual(['fee:charge:2026-10-15']);
  expect(receiptAssumptionFacts(receipt)[1].state).toBe('source-review-required');
  expect(text).not.toMatch(/Read this|A user supplied|approval paragraph/); expect(canonical(receipt)).toBe(original);
});
test('projected payment acknowledgement requires the actual issue index and code, retaining assumption ID and completeness', () => {
  const receipt = { ...missingReceipt(), issues: ['loan_projected_executions_assumption'], issueDetails: [{ index: 0, code: 'loan_projected_executions_assumption', kind: 'acknowledged_assumption' as const, assumptionId: 'assumption.one' }], completeness: 'conditional_complete' as const };
  expect(receiptIssueFacts(receipt)[0]).toMatchObject({ state: 'acknowledged', references: ['assumption.one'] });
  expect(render(receipt)).toContain('Projected payments: Acknowledged · assumption.one');
  expect(render(receipt)).toContain('Completeness: Conditions required'); expect(render(receipt)).toContain('Claim available: No');
  expect(receiptIssueFacts({ ...receipt, issueDetails: [{ ...receipt.issueDetails[0], index: 1 }] })[0].state).not.toBe('acknowledged');
  expect(receiptIssueFacts({ ...receipt, issueDetails: [{ ...receipt.issueDetails[0], code: 'fee_timing_unknown' }] })[0].state).not.toBe('acknowledged');
  expect(receiptIssueFacts({ ...receipt, issueDetails: [{ ...receipt.issueDetails[0], assumptionId: 'Explanatory source text.' }] })[0].state).not.toBe('acknowledged');
});
test('nested fee and bonus criteria preserve actual fields and deduplicate repeated daily traces', () => {
  const receipt = missingReceipt(), trace = { id: 'bonus-input', status: 'needs_information' as const, reason: 'missing:deposit_total', evidenceIds: [] };
  const contribution = { intervalId: 'interval.one', componentId: 'bonus.one', kind: 'bonus' as const, allocation: 'whole_balance' as const, status: 'needs_information' as const, assessmentId: 'assessment.one', qualification: { status: 'needs_information' as const, reasons: [trace.reason], trace }, tiers: [], evidenceIds: [] };
  receipt.ledger = [1, 2].map(index => ({ id: `day.${index}`, date: `2026-09-1${index}`, type: 'interest_accrual', amount: null, balance: '0', evidenceIds: [], savingsContributions: [contribution] }));
  const facts = receiptCriterionFacts(receipt);
  expect(facts.filter(fact => fact.ruleId === 'bonus-input')).toEqual([{ ruleId: 'bonus-input', state: 'needs_information', field: 'deposit_total', inputState: 'missing', references: ['interval.one', 'bonus.one'] }]);
  expect(render(receipt)).toContain('Missing input: deposit_total · interval.one · bonus.one');
});
test('unpaid obligation facts retain exact due, paid, date and perspective while computed totals remain withheld', () => {
  const receipt = missingReceipt();
  receipt.loan = { componentStatus: 'partial', outstandingDebt: null, knownComponentDebt: '100.00', opening: { principal: '100', capitalizedCharges: '0', postedInterest: '0', accruedInterest: '0', otherDebt: '0' }, closing: { principal: '100', capitalizedCharges: '0', postedInterest: '0', accruedInterest: '0', otherDebt: '0' }, principalAdvanced: '0', principalRepaid: null, interestPaid: '0', chargesPaid: '0', redrawAvailable: '0', redrawUsed: '0', obligations: [{ id: 'payment.one', dueDate: '2026-10-15', due: '25.10', paid: '0.00', status: 'unpaid' }], perspective: 'product_account_with_external_fees_separate' };
  const original = canonical(receipt), text = render(receipt);
  expect(text).toContain('payment.one: Unpaid'); expect(text).toContain('Repayment due: $25.10 · Paid: $0.00');
  expect(text).toContain('Basis: product_account_with_external_fees_separate · Known components: Partial');
  expect(text).not.toContain('Closing balance:'); expect(text).not.toContain('100.00'); expect(canonical(receipt)).toBe(original);
});

test('actual failed portfolio execution retains its closed blocker, unavailable claim and canonical account receipt', () => {
  const input = portfolioInput();
  // An invalid numerical contract fails after the producer creates the account
  // receipt; the source-clause example remains unapproved for a product claim.
  input.accounts[0].contract.initialAnnualRate = 'invalid';
  const inputBytes = canonical(input), result = calculatePortfolio(input), receipt = result.accounts.cash;
  expect(result.completeness).toBe('unsupported');
  expect(receipt).toBeDefined(); expect(receipt.status).toBe('unsupported'); expect(receipt.claimAvailable).toBe(false);
  expect(receipt.issues).toContain('portfolio_execution_incomplete');
  expect(receiptIssueFacts(receipt).find(fact => fact.code === 'portfolio_execution_incomplete'))
    .toMatchObject({ topic: 'portfolio', state: 'unavailable', references: [] });
  const original = canonical(receipt), digest = receipt.inputSha256, text = render(receipt);
  expect(text).toContain('Holdings: Unavailable'); expect(text).toContain('Issue code: portfolio_execution_incomplete');
  expect(text).toContain('Claim available: No'); expect(text).not.toContain('$');
  expect(canonical(receipt)).toBe(original); expect(receipt.inputSha256).toBe(digest); expect(digest).toMatch(/^[a-f0-9]{64}$/);
  expect(canonical(input)).toBe(inputBytes);
});

test('the producer non-Error fallback is admitted exactly while unknown portfolio errors stay opaque', () => {
  const budget = new EvaluationBudget();
  const check = jest.spyOn(budget, 'check').mockImplementationOnce(() => { throw null; });
  const result = calculatePortfolio(portfolioInput(), budget);
  check.mockRestore();
  expect(result.issues).toEqual(['portfolio_input_invalid']); expect(result.completeness).toBe('unsupported');
  const receipt = { ...missingReceipt(), issues: result.issues }, original = canonical(receipt);
  expect(receiptIssueFacts(receipt)).toEqual([{ index: 0, topic: 'portfolio', state: 'unavailable', code: 'portfolio_input_invalid', references: [] }]);
  const text = render(receipt);
  expect(text).toContain('Holdings: Unavailable'); expect(text).toContain('Issue code: portfolio_input_invalid');
  expect(text).toContain('Claim available: No'); expect(text).not.toContain('$'); expect(canonical(receipt)).toBe(original);
  const unknown = { ...receipt, issues: ['portfolio_future_unreviewed_error', 'portfolio_execution_incomplete:source prose', 'portfolio_input_invalid.', 'Explanatory private error text.'] };
  expect(receiptIssueFacts(unknown).every(fact => fact.code === null && fact.state === 'source-review-required')).toBe(true);
  expect(render(unknown)).not.toMatch(/portfolio_future|source prose|portfolio_input_invalid\.|Explanatory private/);
});
