import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { EngineReceiptFacts } from '../src/components/product/EngineReceiptFacts';
import { receiptAssumptionFacts, receiptCriterionFacts, receiptIssueFacts } from '../src/lib/engineReceiptFactModel';
import { calculateLedger } from '../src/lib/productTermsEngine/ledger';
import { example } from '../src/lib/productTermsEngine/testSupport';
import { canonical } from '../src/lib/productTermsEngine/validation';
import type { CalculationReceipt } from '../src/lib/productTermsEngine/types';
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
