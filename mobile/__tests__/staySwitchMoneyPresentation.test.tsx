import React from 'react';
import { TextInput } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { SwitchCostEditor } from '../src/components/scenario/SwitchCostEditor';
import { StaySwitchChart } from '../src/components/scenario/StaySwitchChart';
import { buildStaySwitchProjection, resolveSwitchCosts, type StaySwitchProjection } from '../src/data/staySwitchProjection';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import type { StaySwitchFact, SwitchFeeKind } from '../src/data/projectionFacts';
import { uiStaySwitchFact, uiStaySwitchMoney } from '../src/lib/staySwitchUiFacts';
import { uiMoney } from '../src/lib/uiCopy';
import type { ProductDetail, RateRow } from '../src/types';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Disclosure: 'Disclosure', Row: 'Row', Card: 'Card', Button: 'Button' }));
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Line: 'Line', Path: 'Path' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { textFaint: '#999', text: '#123', surfaceAlt: '#fff', border: '#ddd', textMuted: '#666', rateLoan: '#123' }, font: { body: 16 }, radius: { md: 12 } }) }));

const fees: readonly SwitchFeeKind[] = ['currentBankExitFees', 'applicationFees', 'valuationFees', 'settlementFees', 'governmentAndLegalFees', 'otherUpfrontFees'];
const labels = ['Current bank exit fees', 'Application fees', 'Valuation fees', 'Settlement fees', 'Government & legal', 'Other upfront fees', 'Cashback'];
type TestNode = { props: Record<string, any> };
type Tree = ReactTestRenderer & { root: { findAllByType(type: unknown): TestNode[]; findByType(type: unknown): TestNode; findAll(predicate: (node: TestNode) => boolean): TestNode[] }; toJSON(): unknown };
const texts = (tree: Tree) => tree.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join('\n');
const scenario = () => normalizeUserRateScenario({ projections: { mortgage: { holdVariableRate: true, horizonYears: '50' } }, mortgage: { mode: 'refi', loanBalance: '500000.50', currentRate: '6', years: '25' } });

test('six fees and cashback show AUD in visible and accessible field labels without altering entered cents', () => {
  const inputs = { ...scenario().mortgageSwitch, ...Object.fromEntries(fees.map(key => [key, '99.50'])), cashback: '0.50' };
  const before = JSON.stringify(inputs), onChange = jest.fn();
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<SwitchCostEditor inputs={inputs} currentDetail={null} targetDetail={null} editable compactFields onChange={onChange} />) as Tree; });
  try {
    act(() => tree.root.findByType('Disclosure' as never).props.onToggle());
    const fields = tree.root.findAllByType(TextInput);
    expect(fields).toHaveLength(7);
    for (const [index, label] of labels.entries()) {
      expect(texts(tree)).toContain(`${label} (AUD)`);
      expect(fields[index].props.accessibilityLabel).toBe(`${label} (AUD)`);
      expect(fields[index].props.value).toBe(index === 6 ? '0.50' : '99.50');
      expect(fields[index].props.keyboardType).toBe('decimal-pad');
    }
    expect(texts(tree)).toContain('Known costs: $596.50 · Fees unverified');
    act(() => fields[1].props.onChangeText('99.50'));
    expect(onChange).toHaveBeenCalledWith({ applicationFees: '99.50' });
    expect(JSON.stringify(inputs)).toBe(before);
  } finally { act(() => tree.unmount()); }
});

test('published cents, explicit zero and unknown/malformed fees keep distinct factual presentations without source prose', () => {
  const prose = 'Please read this source marketing paragraph before applying.';
  const input = scenario().mortgageSwitch;
  const target: ProductDetail = { fees: [{ label: 'UPFRONT', name: 'Application fee', value: '99.50', info: prose }] };
  const before = JSON.stringify({ input, target });
  const costs = resolveSwitchCosts(input, null, target);
  expect(costs.fees.find(fee => fee.key === 'applicationFees')).toEqual(expect.objectContaining({ amount: 99.5, source: 'published' }));
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<SwitchCostEditor inputs={input} currentDetail={null} targetDetail={target} editable compactFields onChange={jest.fn()} />) as Tree; });
  try {
    const fields = tree.root.findAllByType(TextInput);
    expect(fields[1].props.placeholder).toBe('99.50');
    expect(fields[0].props.placeholder).toBe('Unknown');
    expect(texts(tree)).toContain('Known costs: $99.50');
    expect(JSON.stringify(tree.toJSON())).not.toContain(prose);
    expect(texts(tree)).not.toContain('Blank means');
    expect(texts(tree)).toContain('Unavailable');
    const malformed = { ...input, applicationFees: 'not-a-number', currentBankExitFees: '0' };
    act(() => tree.update(<SwitchCostEditor inputs={malformed} currentDetail={null} targetDetail={null} editable compactFields onChange={jest.fn()} />));
    const resolved = resolveSwitchCosts(malformed, null, null);
    expect(resolved.fees.find(fee => fee.key === 'applicationFees')?.source).toBe('missing');
    expect(resolved.fees.find(fee => fee.key === 'currentBankExitFees')).toEqual(expect.objectContaining({ amount: 0, source: 'entered' }));
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('0');
    expect(tree.root.findAllByType(TextInput)[1].props.placeholder).toBe('Unknown');
    expect(JSON.stringify({ input, target })).toBe(before);
  } finally { act(() => tree.unmount()); }
});

test('every stay/switch monetary fact retains cents and provenance while unknown and withheld facts stay nonnumeric', () => {
  const examples: readonly { fact: StaySwitchFact; values: readonly string[] }[] = [
    { fact: { kind: 'switch-opening-inputs', balance: 500000.5, remainingYears: 25, offsetAmount: 99.5 }, values: ['$500,000.50', '25 years', '$99.50'] },
    { fact: { kind: 'household-allocation', monthlyAmount: 99.5, policy: 'baseline' }, values: ['$99.50 · Current'] },
    { fact: { kind: 'household-allocation', monthlyAmount: 99.5, policy: 'additional-required' }, values: ['$99.50 · Current'] },
    { fact: { kind: 'target-allocation-shortfall', monthlyAmount: 0.5 }, values: ['$0.50 per month'] },
    { fact: { kind: 'switch-funding', method: 'cash', netCostAmount: -0.5 }, values: ['Cash / offset · -$0.50'] },
    { fact: { kind: 'switch-funding', method: 'new-loan', netCostAmount: 99.5 }, values: ['New loan · $99.50'] },
    { fact: { kind: 'cashback-exceeds-fees', cashbackAmount: 100, modelledFeesAmount: 99.5, eligibility: 'unverified', paymentTiming: 'unverified' }, values: ['$100.00', '$99.50', 'Unverified', 'Unverified'] },
  ];
  for (const { fact, values } of examples) {
    const before = JSON.stringify(fact);
    expect(uiStaySwitchFact(fact).map(row => row.value)).toEqual(values);
    expect(JSON.stringify(fact)).toBe(before);
  }
  for (const fee of fees) for (const source of ['entered', 'published'] as const) {
    expect(uiStaySwitchFact({ kind: 'switch-fee', fee, state: 'known', amount: 99.5, source })[0].value).toBe(`$99.50 · ${source === 'entered' ? 'Entered' : 'Published'}`);
    expect(uiStaySwitchFact({ kind: 'switch-fee', fee, state: 'known', amount: 0, source })[0].value).toBe(`$0.00 · ${source === 'entered' ? 'Entered' : 'Published'}`);
    expect(uiStaySwitchFact({ kind: 'switch-fee', fee, state: 'unknown' })[0].value).toBe('Unknown');
  }
  const withheld = uiStaySwitchFact({ kind: 'switch-cost-claims', state: 'unavailable', feeInputs: 'incomplete', materialTerms: 'verification-required', customerApplicability: 'verification-required', calculation: 'supported-evaluator-required' });
  expect(withheld[0].value).toBe('Unavailable');
  expect(withheld.map(row => row.value).join(' ')).not.toMatch(/\$|approved|verified bank/i);
  for (const value of [null, undefined, Number.NaN, Infinity]) expect(uiStaySwitchMoney(value)).toBe('Unknown');
  expect(uiStaySwitchMoney(0)).toBe('$0.00');
  expect(uiStaySwitchMoney(-99.5)).toBe('-$99.50');
  expect(uiMoney(99.5)).toBe('$100'); // This change does not alter the general compact formatter.
});

test('real stay/switch facts distinguish current household allocation, target shortfall and refinancing timing', () => {
  const value = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '500000', currentRate: '6', years: '25' },
    projections: { mortgage: { periodicAmount: '3500', periodicFrequency: 'monthly', extraRepaymentAmount: '200', extraRepaymentFrequency: 'monthly', offsetContributionAmount: '500', offsetContributionFrequency: 'monthly' } } });
  const target: RateRow = { provider: 'Target Bank', product_key: 'target', product_name: 'Loan', rate: '0.15' };
  const model = buildStaySwitchProjection({ scenario: value, target, targetDetail: {}, now: new Date('2026-10-15T01:00:00Z') });
  expect(model.ready).toBe(true); expect(model.householdAllocation).toBe(4200);
  expect(model.targetAllocationShortfall).toBeGreaterThan(0);
  const original = JSON.stringify(model), rows = model.facts.flatMap(uiStaySwitchFact);
  expect(rows).toContainEqual({ label: 'Monthly household allocation', value: '$4,200.00 · Current' });
  expect(rows).toContainEqual({ label: 'Repayment shortfall', value: `${uiStaySwitchMoney(model.targetAllocationShortfall)} per month` });
  expect(rows).toContainEqual({ label: 'Refinancing timing', value: 'Unverified' });
  expect(rows.some(row => row.label === 'Monthly repayment' || row.value === '$4,200.00 · Required')).toBe(false);
  expect(JSON.stringify(model)).toBe(original);
});

test('real target offset facts preserve published absence separately from unavailable evidence', () => {
  const target: RateRow = { provider: 'Target Bank', product_key: 'target', product_name: 'Loan', rate: '0.05' };
  const cases: readonly [ProductDetail | undefined, string][] = [[{}, 'No · Not published'], [undefined, 'No · Unverified'], [{ features: [{ label: 'OFFSET' }] }, 'Yes · Published']];
  for (const [targetDetail, expected] of cases) {
    const model = buildStaySwitchProjection({ scenario: scenario(), target, targetDetail, now: new Date('2026-10-15T01:00:00Z') });
    const original = JSON.stringify(model), fact = model.facts.find(fact => fact.kind === 'target-offset')!;
    const rows = uiStaySwitchFact(fact);
    expect(rows[0]).toEqual({ label: 'Target offset', value: expected });
    expect(rows[1].value).toBe(model.targetHasOffset ? 'Offset' : 'Principal');
    expect(JSON.stringify(model)).toBe(original);
  }
});

function projection(): StaySwitchProjection {
  const target: RateRow = { provider: 'Target Bank', product_key: 'target', product_name: 'Loan', rate: '0.05' };
  const model = buildStaySwitchProjection({ scenario: scenario(), target, now: new Date('2026-10-15T01:00:00Z') });
  expect(model.ready).toBe(true);
  // Controlled presentation fixture: keep the actual engine model as the base.
  return { ...model, stay: { ...model.stay!, totalInterest: 99.5, knownCostSubtotal: 123.45 },
    switching: { ...model.switching!, totalInterest: 88.25, knownCostSubtotal: 111.11 } };
}

test('stay/switch chart preserves cents in visible and accessible totals, and keeps withheld differences unavailable', () => {
  const model = projection(), before = JSON.stringify(model);
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<StaySwitchChart projection={model} />) as Tree; });
  try {
    expect(texts(tree)).toContain('Stay $99.50 / Switch $88.25');
    expect(texts(tree)).toContain('Stay $123.45 / Switch $111.11');
    const graph = tree.root.findAll(node => node.props.accessibilityRole === 'image')[0];
    expect(graph.props.accessibilityLabel).toContain('Total interest $99.50');
    expect(graph.props.accessibilityLabel).toContain('Total interest $88.25');
    expect(graph.props.accessibilityLabel).toContain('Total-cost difference Unavailable');
    expect(model.totalCostSaving).toBeNull();
    expect(JSON.stringify(model)).toBe(before);
    const negative = { ...model, fees: { ...model.fees, costClaimsAvailable: true }, totalCostSaving: -99.5 };
    act(() => tree.update(<StaySwitchChart projection={negative} />));
    expect(texts(tree)).toContain('Higher $99.50');
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'image')[0].props.accessibilityLabel).toContain('Total-cost difference -$99.50');
    const zero = { ...model, fees: { ...model.fees, costClaimsAvailable: true }, totalCostSaving: 0 };
    act(() => tree.update(<StaySwitchChart projection={zero} compact />));
    expect(texts(tree)).toContain('Lower $0.00');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/Save \$|Full-cost and break-even claims|Blank means unknown/);
  } finally { act(() => tree.unmount()); }
});
