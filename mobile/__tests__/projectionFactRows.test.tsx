import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProjectionFactRows } from '../src/components/calculation/ProjectionFactRows';
import { projectionFacts, type ProjectionFact, type ProjectionFactSnapshot } from '../src/data/projectionFacts';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row' }));

function text(value: unknown): string {
  return Array.isArray(value) ? value.map(text).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
type FactRenderer = ReactTestRenderer & {
  root: { findAllByType(type: React.ElementType): readonly { props: { children: unknown } }[] };
};
function render(facts: readonly ProjectionFact[]): string {
  let tree!: FactRenderer;
  act(() => { tree = TestRenderer.create(<ProjectionFactRows facts={facts}/>) as FactRenderer; });
  const result = tree.root.findAllByType('AppText' as React.ElementType).map(node => text(node.props.children)).join(' ');
  act(() => tree.unmount());
  return result;
}
type MortgageSnapshot = Extract<ProjectionFactSnapshot, { section: 'Mortgage' }>;
function mortgage(overrides: Partial<MortgageSnapshot> = {}): MortgageSnapshot {
  return { section: 'Mortgage', months: 300, remainingYears: 25, rateRange: [0.05, 0.06, 0.07], history: null,
    fixed: false, repayment: { monthlyAmount: 2500, source: 'entered', enteredFrequency: 'weekly' },
    extraRepayment: { monthlyAmount: 100, enteredFrequency: 'monthly' },
    offset: { openingAmount: 10000, openingSource: 'entered', growthMonthlyAmount: 300, boostMonthlyAmount: 50, enteredFrequency: 'fortnightly' },
    outcomes: [{ id: 'rate-base', negativeAmortisation: false, closingBalance: 0 }], ...overrides };
}
test('historical mismatch keeps the simulated and entered amounts, difference and forward offset source', () => {
  const value = render(projectionFacts(mortgage({ history: { anchorDay: '2020-01-01', anchorBalance: 450000,
    anchorRateFraction: 0.04, simulatedEndBalance: 300321, currentEnteredBalance: 300000, balanceDifference: 321,
    balanceMismatchReported: true, offset: { simulatedEndAmount: 12345, currentEnteredAmount: 12000, difference: 345, mismatchReported: true } } })));
  for (const expected of ['1 Jan 2020', '$300,321', '$300,000', '$321', '$12,345', '$12,000', '$345', 'Forward offset', 'Simulated history']) expect(value).toContain(expected);
});
test('growing and residual loans remain linked to their actual scenario', () => {
  const value = render(projectionFacts(mortgage({ outcomes: [{ id: 'rate-higher', negativeAmortisation: true, closingBalance: 500 }, { id: 'offset-none', negativeAmortisation: false, closingBalance: 250 }] })));
  for (const expected of ['Loan growth · Interest exceeds repayment', 'Higher rate', 'No offset', '$500', '$250', 'Balance at term end']) expect(value).toContain(expected);
});
test('known zero ongoing rate and entered unmet bonus remain distinct from unknown eligibility', () => {
  const value = render(projectionFacts({ section: 'Savings', months: 60, horizonYears: 5, rateRange: [0, 0, 0.01], history: null,
    contribution: { monthlyAmount: 0, enteredFrequency: 'weekly' }, withdrawal: { monthlyAmount: 0, enteredFrequency: 'monthly' },
    bonus: { conditionsMet: false, months: 6, conditionalRateFraction: 0.05, ongoingRateFraction: 0 } }));
  for (const expected of ['Conditional / ongoing rate', '5.00%', '0.00%', 'Entered · Does not meet', 'Starting rate', 'Ongoing rate', 'Provider timing / bonus eligibility', 'Unverified']) expect(value).toContain(expected);
});
test('paid-out deposit interest, unknown renewal and unverified provider timing remain explicit', () => {
  const value = render(projectionFacts({ section: 'TD', months: 18, rateRange: [0.03, 0.04, 0.05], history: null,
    termMonths: 6, rollovers: 2, reinvestInterest: false, currentRateFraction: 0.04 }));
  for (const expected of ['Paid out · Balance · Excluded', 'Renewal rate', 'Unknown', 'Provider day count / payment timing', 'Unverified', '6 months', '4.00%']) expect(value).toContain(expected);
});
test('an unknown dynamic fact cannot render upstream prose', () => {
  expect(() => ProjectionFactRows({ facts: [{ kind: 'provider-paragraph', text: 'untrusted explanation' }] as unknown as ProjectionFact[] })).toThrow('Unhandled projection fact');
});
