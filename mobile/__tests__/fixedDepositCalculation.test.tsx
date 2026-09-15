import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { setup, inputs, profile } from '../test-support/executableDepositHarness';
import { downloadInflate } from '../src/data/payload';
import { FixedDepositCalculation } from '../src/components/product/FixedDepositCalculation';
let mockState: any;
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: jest.requireActual('../test-support/executableDepositHarness').profile, busy: false, update: jest.fn() }) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Disclosure: ({ children, open, ...props }: any) => jest.requireActual('react').createElement('Disclosure', { ...props, open }, open ? children : null) }));
beforeEach(() => (downloadInflate as jest.Mock).mockReset());
test('actual verified transport opens local form, calculates maturity, and removes result on adopted approval removal', async () => {
  const x = setup();
  // Seed identical verified network responses for the component, not an unbranded ready stub.
  await x.load();
  const calls = (downloadInflate as jest.Mock).mock.results.map(r => r.value);
  for (const call of calls) (downloadInflate as jest.Mock).mockResolvedValueOnce(await call);
  mockState = { manifest: x.context.manifest, core: x.context.core, coreIntegrity: x.context.coreIntegrity };
  let tree!: ReactTestRenderer & { root: any; toJSON: () => unknown };
  await act(async () => { tree = TestRenderer.create(<FixedDepositCalculation row={x.row} />) as typeof tree; });
  await act(async () => { tree.root.findByType('Disclosure' as any).props.onToggle(); });
  for (const [label, value] of [['Deposit amount (AUD)', inputs.principal], ['Bank-confirmed annual rate (%)', '3.65'], ['Bank-confirmed funding date', inputs.fundedDate], ['Bank-confirmed maturity date', inputs.maturityDate]]) act(() => tree.root.findByProps({ label }).props.onChangeText(value));
  for (const label of ['Bank agreed this amount, rate and these dates', 'No withholding applies to this payout']) act(() => tree.root.findByProps({ label }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Calculate maturity return' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Maturity payout: $1002.90');
  expect(JSON.stringify(tree.toJSON())).toContain('Return before tax');
  expect(profile.answers).toEqual({});
  mockState = { ...mockState, manifest: { ...mockState.manifest, files: { core: mockState.manifest.files.core, details: mockState.manifest.files.details } } };
  await act(async () => { tree.update(<FixedDepositCalculation row={x.row} />); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('1002.90');
  expect(JSON.stringify(tree.toJSON())).toContain('unavailable for this exact rate');
  act(() => tree.unmount());
});

test('multiple actual reviewed cohorts remain visible; overlap needs explicit choice and failed criterion cannot produce a return', async () => {
  const x = setup(), { identity } = jest.requireActual('../src/data/executableContracts/validation');
  for (const [cohort, minimum] of [['other', '0'], ['excluded', '5000']]) {
    const template = structuredClone(x.t); template.cohortKey = cohort;
    if (template.eligibility.op === 'compare' && template.eligibility.expected.type === 'decimal') template.eligibility.expected.value = minimum;
    template.id = identity(template, 'id');
    x.asset.templates.push({ template, approval: { ...x.asset.templates[0].approval, templateId: template.id } });
  }
  const unknown = structuredClone(x.t); unknown.cohortKey = 'unresolved';
  unknown.inputDefinitions.push({ key: 'customer_gate', label: 'Recorded customer criterion', type: 'boolean', unit: null, binding: 'customer_fact', clauseIds: unknown.eligibility.evidenceIds ?? [] });
  unknown.eligibility = { id: 'missing-gate', op: 'compare', field: 'customer_gate', comparison: 'eq', expected: { type: 'boolean', value: true }, evidenceIds: unknown.eligibility.evidenceIds };
  unknown.id = identity(unknown, 'id'); x.asset.templates.push({ template: unknown, approval: { ...x.asset.templates[0].approval, templateId: unknown.id } });
  x.asset.identitySha256 = identity(x.asset, 'identitySha256');
  await x.load();
  const calls = (downloadInflate as jest.Mock).mock.results.map(r => r.value);
  for (const call of calls) (downloadInflate as jest.Mock).mockResolvedValueOnce(await call);
  mockState = { ...x.context };
  let tree!: ReactTestRenderer & { root: any; toJSON: () => unknown };
  await act(async () => { tree = TestRenderer.create(<FixedDepositCalculation row={x.row} />) as typeof tree; });
  await act(async () => tree.root.findByProps({ title: 'Maturity return before tax' }).props.onToggle());
  expect(JSON.stringify(tree.toJSON())).toContain('needs information');
  act(() => tree.root.findByProps({ title: `Review ${x.t.cohortKey}` }).props.onToggle());
  for (const [label, value] of [['Deposit amount (AUD)', inputs.principal], ['Bank-confirmed annual rate (%)', '3.65'], ['Bank-confirmed funding date', inputs.fundedDate], ['Bank-confirmed maturity date', inputs.maturityDate]]) act(() => tree.root.findByProps({ label }).props.onChangeText(value));
  for (const label of ['Bank agreed this amount, rate and these dates', 'No withholding applies to this payout']) act(() => tree.root.findByProps({ label }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('More than one group meets');
  act(() => tree.root.findByProps({ title: 'Calculate maturity return' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Choose the applicable reviewed customer group');
  const choose = (cohort: string) => act(() => tree.root.findByProps({ label: `Choose ${cohort} / ${x.t.tierKey} / ${x.t.packageKey}` }).props.onPress());
  choose(x.t.cohortKey); act(() => tree.root.findByProps({ title: 'Calculate maturity return' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Maturity payout: $1002.90');
  choose('excluded'); expect(JSON.stringify(tree.toJSON())).not.toContain('Maturity payout: $1002.90');
  act(() => tree.root.findByProps({ title: 'Review excluded' }).props.onToggle());
  expect(tree.root.findAllByType('AppText').map((node: any) => node.children.join('')).join('\n')).toContain('is at least 5000 AUD: does not meet');
  act(() => tree.root.findByProps({ title: 'Calculate maturity return' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).not.toContain('Maturity payout: $1002.90');
  expect(JSON.stringify(tree.toJSON())).toContain('Result unavailable');
  choose('unresolved'); act(() => tree.root.findByProps({ title: 'Calculate maturity return' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).not.toContain('Maturity payout: $1002.90');
  act(() => tree.root.findByProps({ title: 'Review unresolved' }).props.onToggle());
  expect(tree.root.findAllByType('CustomerAnswerEditor')).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('Recorded customer criterion');
  act(() => tree.unmount());
});

test('criteria disclosure preserves AND/OR/NOT structure and failed comparison evidence', async () => {
  const { DepositCriteria } = jest.requireActual('../src/components/product/DepositCriteria');
  const { evaluateEligibility } = jest.requireActual('../src/lib/productTermsEngine/eligibility');
  const x = setup(t => {
    const first = { ...t.eligibility, id: 'amount-pass' };
    const second = { ...t.eligibility, id: 'amount-fail', expected: { type: 'decimal' as const, value: '5000', unit: 'AUD' } };
    t.eligibility = { id: 'all', op: 'and', rules: [{ id: 'either', op: 'or', rules: [first, second] }, { id: 'negated', op: 'not', rule: { ...first, id: 'amount-negated' } }] };
  });
  const selection = await x.load(), result = evaluateEligibility(x.t.eligibility, { protocol_amount: { type: 'decimal', value: '1000', unit: 'AUD' } });
  let tree: any; act(() => { tree = TestRenderer.create(<DepositCriteria selection={selection} trace={result.trace} />); });
  const text = tree.root.findAllByType('AppText').map((node: any) => node.children.join('')).join('\n');
  expect(text).toContain('All following criteria: does not meet'); expect(text).toContain('At least one following criterion: meets');
  expect(text).toContain('The following criterion must not be met: does not meet'); expect(text).toContain('is at least 5000 AUD: does not meet');
  act(() => tree.root.findByProps({ title: 'Criteria source evidence' }).props.onToggle());
  expect(tree.root.findAllByType('Button').length).toBeGreaterThan(0);
  act(() => tree.unmount());
});
