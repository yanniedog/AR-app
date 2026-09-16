import React from 'react';
import mockReact from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { EligibilityAssessment } from '../src/components/product/EligibilityAssessment';
import { eligibilityTransportHarness } from '../test-support/eligibilityHarness';
import { profile as mockProfile } from '../test-support/executableDepositHarness';
import { eligibilityAnswerId } from '../src/data/eligibilityContracts/facts';
import { eligibilityIdentity, eligibilityScopeId } from '../src/data/eligibilityContracts/validation';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import { downloadInflate } from '../src/data/payload';
import type { RateRow } from '../src/types';
import * as Clipboard from 'expo-clipboard';
let mockState: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: mockProfile, busy: false }) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/product/DepositCriteria', () => ({ ReviewedCriteria: 'ReviewedCriteria' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Disclosure: ({ children, open, ...props }: any) => mockReact.createElement('Disclosure', props, open ? children : null) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => undefined) }));

test.each(['product', 'rate_variant'] as const)('technical Mortgage %s flow requires choice, binds local scenario, exports and invalidates edition', async kind => {
  (Clipboard.setStringAsync as jest.Mock).mockClear(); (downloadInflate as jest.Mock).mockClear();
  const h = await eligibilityTransportHarness();
  expect(h.target.detail.displayIdentity.productCategory).toBe('RESIDENTIAL_MORTGAGES');
  const row: RateRow = { provider: 'Engineering protocol only', product_key: h.target.productKey, product_name: 'Technical mortgage', rate: '0.0365', rate_index: 1, repayment_type: 'PRINCIPAL_AND_INTEREST', loan_purpose: 'OWNER_OCCUPIED' };
  if (kind === 'rate_variant') {
    h.context.core.sections.Mortgage.rates.push(row);
    h.subject.scope.coverage = 'rate_variants'; h.subject.scope.rateIndexes = [1];
    h.subject.source.rateRows = [{ coreRowIndex: 0, rateIndex: 1, rowSha256: hashText(canonical(row)) }];
    h.subject.scopeId = eligibilityScopeId(h.subject.scope); h.subject.id = eligibilityIdentity(h.subject, 'id');
    h.asset.subjects[0].approval.subjectId = h.subject.id; h.asset.identitySha256 = eligibilityIdentity(h.asset, 'identitySha256');
  } else expect(h.subject.source.rateRows).toEqual([]);
  const props = { productKey: h.target.productKey, ...(kind === 'rate_variant' ? { row, section: 'Mortgage' as const } : {}) };
  mockState = { ...h.context, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<EligibilityAssessment {...props} />); });
  expect(tree.root.findAllByProps({ title: 'Assess selected scope' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ title: 'Check recorded eligibility criteria' }).props.onToggle());
  act(() => tree.root.findByProps({ label: 'Assessment date' }).props.onChangeText('2028-01-02'));
  act(() => tree.root.findByProps({ title: 'Assess selected scope' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Choose the reviewed scope');
  act(() => tree.root.findByProps({ title: 'Review scope protocol-cohort' }).props.onToggle());
  act(() => tree.root.findByProps({ label: 'Selected amount' }).props.onChangeText('1000'));
  act(() => tree.root.findByProps({ label: 'Choose protocol-cohort / protocol-tier / No package' }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Assess selected scope' }).props.onPress());
  await act(async () => tree.root.findByProps({ title: 'Copy eligibility receipt' }).props.onPress());
  const copied = JSON.parse((Clipboard.setStringAsync as jest.Mock).mock.calls[0][0]);
  expect(copied.eligibility.status).toBe('meets'); expect(copied.evaluationInputs.scenario.values.scenario_amount.value).toBe('1000');
  expect(copied.evaluationKind).toBe('eligibility_only'); expect(copied).not.toHaveProperty('totals');
  expect(copied.evaluationInputs.target.kind).toBe(kind);
  if (kind === 'rate_variant') expect(copied.evaluationInputs.target).toMatchObject({ section: 'Mortgage', coreRowIndex: 0, rateIndex: 1, rowSha256: hashText(canonical(row)) });
  expect((downloadInflate as jest.Mock).mock.calls).toHaveLength(2);
  expect((downloadInflate as jest.Mock).mock.calls.every(([url]) => /executable_v2_(index|shard_000)-/.test(url))).toBe(true);
  act(() => tree.root.findByProps({ label: 'Selected amount' }).props.onChangeText('0'));
  expect(tree.root.findAllByProps({ title: 'Copy eligibility receipt' })).toHaveLength(0);
  mockState = { ...mockState, manifest: { ...mockState.manifest } }; delete mockState.manifest.executable_v2;
  await act(async () => tree.update(<EligibilityAssessment {...props} />));
  expect(JSON.stringify(tree.toJSON())).toContain('unavailable for this product');
  act(() => tree.unmount());
});

test('failed refresh retry rejection remains handled and bounded', async () => {
  const h = await eligibilityTransportHarness(); delete (h.context.manifest as any).executable_v2;
  mockState = { ...h.context, ensureDetails: jest.fn(async () => { throw new Error('offline'); }) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<EligibilityAssessment productKey={h.target.productKey} />); });
  await act(async () => tree.root.findByProps({ title: 'Check recorded eligibility criteria' }).props.onToggle());
  await act(async () => tree.root.findByProps({ title: 'Retry criteria' }).props.onPress());
  expect(mockState.ensureDetails).toHaveBeenCalledTimes(1); expect(JSON.stringify(tree.toJSON())).toContain('unavailable');
});


test('overlapping scopes remain independently entered and require explicit choice', async () => {
  const h = await eligibilityTransportHarness();
  const second = structuredClone(h.asset.subjects[0]); second.subject.scope.cohortKey = 'second-cohort';
  second.subject.scopeId = eligibilityScopeId(second.subject.scope); second.subject.id = eligibilityIdentity(second.subject, 'id'); second.approval.subjectId = second.subject.id;
  h.asset.subjects.push(second); h.asset.identitySha256 = eligibilityIdentity(h.asset, 'identitySha256');
  mockState = { ...h.context, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<EligibilityAssessment productKey={h.target.productKey} />); });
  await act(async () => tree.root.findByProps({ title: 'Check recorded eligibility criteria' }).props.onToggle());
  act(() => tree.root.findByProps({ label: 'Assessment date' }).props.onChangeText('2028-01-02'));
  for (const cohort of ['protocol-cohort', 'second-cohort']) {
    act(() => tree.root.findByProps({ title: `Review scope ${cohort}` }).props.onToggle());
    act(() => tree.root.findByProps({ label: 'Selected amount' }).props.onChangeText('1000'));
  }
  expect(JSON.stringify(tree.toJSON())).toContain('More than one scope meets');
  expect(tree.root.findAllByType('Chip').every((node: any) => node.props.selected === false)).toBe(true);
  act(() => tree.root.findByProps({ title: 'Assess selected scope' }).props.onPress());
  expect(tree.root.findAllByProps({ title: 'Copy eligibility receipt' })).toHaveLength(0);
});


test.each(['unavailable', 'not_applicable'] as const)('saved scenario %s cannot hide the actual amount control', async state => {
  const h = await eligibilityTransportHarness(), id = eligibilityAnswerId(h.subject, 'amount');
  mockProfile.answers[id] = { state, provenance: { source: 'user_input', recordedAt: null, productKey: h.target.productKey, effectiveFrom: null, effectiveToExclusive: null } };
  mockState = { ...h.context, ensureDetails: jest.fn(async () => undefined) };
  let tree: any;
  try {
    await act(async () => { tree = TestRenderer.create(<EligibilityAssessment productKey={h.target.productKey} />); });
    await act(async () => tree.root.findByProps({ title: 'Check recorded eligibility criteria' }).props.onToggle());
    act(() => tree.root.findByProps({ label: 'Assessment date' }).props.onChangeText('2028-01-02'));
    act(() => tree.root.findByProps({ title: 'Review scope protocol-cohort' }).props.onToggle());
    expect(tree.root.findAllByProps({ label: 'Selected amount' })).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).toContain('needs information');
  } finally { delete mockProfile.answers[id]; if (tree) act(() => tree.unmount()); }
});
