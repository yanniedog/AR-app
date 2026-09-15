import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import { migrateCustomerProfile } from '../src/data/customerProfileMigration';
import type { CustomerProfile } from '../src/data/customerProfile';
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: jest.fn() }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row',
    Disclosure: ({ children, open, ...props }: any) => R.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
// eslint-disable-next-line import/first
import { useCustomerProfile } from '../src/hooks/useCustomerProfile';
// eslint-disable-next-line import/first
import { CustomerAnswerEditor, CustomerProfileContent, CustomerProfilePanel } from '../src/components/CustomerProfilePanel';
type Tree = ReactTestRenderer & { root: any; toJSON: () => unknown };
let tree: Tree;
afterEach(() => { if (tree) act(() => tree.unmount()); });
test('answer UI saves explicit false and zero separately from unavailable', () => {
  const onSave = jest.fn();
  act(() => { tree = TestRenderer.create(<CustomerAnswerEditor definition={{ id: 'flag', label: 'Flag', type: 'boolean' }} disabled={false} onSave={onSave} />) as Tree; });
  act(() => tree.root.findByProps({ label: 'Entered' }).props.onPress());
  act(() => tree.root.findByProps({ label: 'No' }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Save Flag' }).props.onPress());
  expect(onSave.mock.calls[0][0]).toMatchObject({ state: 'known', fact: { value: false }, provenance: { source: 'user_input' } });
  act(() => tree.root.findByProps({ label: 'Unavailable' }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Save Flag' }).props.onPress());
  expect(onSave.mock.calls[1][0].state).toBe('unavailable');
  act(() => tree.update(<CustomerAnswerEditor key="amount" definition={{ id: 'amount', label: 'Amount', type: 'decimal', unit: 'AUD' }} disabled={false} onSave={onSave} />));
  act(() => tree.root.findByProps({ label: 'Entered' }).props.onPress());
  act(() => tree.root.findByProps({ accessibilityLabel: 'Value: Amount' }).props.onChangeText('0'));
  act(() => tree.root.findByProps({ title: 'Save Amount' }).props.onPress());
  expect(onSave.mock.calls[2][0]).toMatchObject({ state: 'known', fact: { value: '0', unit: 'AUD' } });
});
test('real missing contract shows pending and negotiated terms save separately with product provenance', () => {
  const profile = migrateCustomerProfile(null);
  const update = jest.fn(async (change: (p: CustomerProfile) => CustomerProfile) => { Object.assign(profile, change(profile)); return true; });
  jest.mocked(useCustomerProfile).mockReturnValue({ profile, busy: false, error: null, retry: jest.fn(), update });
  act(() => { tree = TestRenderer.create(<CustomerProfileContent productKey="bank|product" />) as Tree; });
  expect(JSON.stringify(tree.toJSON())).toContain('Eligibility remains unassessed');
  expect(tree.root.findAllByType('LedgerField')).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Negotiated terms' }).props.onToggle());
  for (const [label, value] of [['Term', 'Negotiated rate'], ['Value', '0'], ['Unit', 'percent']]) {
    act(() => tree.root.findByProps({ label }).props.onChangeText(value));
  }
  act(() => tree.root.findByProps({ title: 'Save negotiated term' }).props.onPress());
  expect(profile.answers).toEqual({});
  expect(profile.negotiatedTerms[0]).toMatchObject({ value: '0', unit: 'percent', provenance: { source: 'user_input', productKey: 'bank|product', effectiveFrom: null } });
});
test('web panel never mounts encrypted customer hook', () => {
  const os = Platform.OS; Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  jest.mocked(useCustomerProfile).mockClear();
  act(() => { tree = TestRenderer.create(<CustomerProfilePanel />) as Tree; });
  act(() => tree.root.findByProps({ title: 'Private customer inputs' }).props.onToggle());
  expect(useCustomerProfile).not.toHaveBeenCalled();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
});

test('saving one field preserves another editor draft across profile revisions', () => {
  let profile = migrateCustomerProfile({ version: 3, savings: { balance: '10', currentRate: '3' } });
  const update = jest.fn(async (change: (p: CustomerProfile) => CustomerProfile) => {
    profile = JSON.parse(JSON.stringify({ ...change(profile), revision: profile.revision + 1 })) as CustomerProfile;
    return true;
  });
  jest.mocked(useCustomerProfile).mockImplementation(() => ({ profile, busy: false, error: null, retry: jest.fn(), update }));
  act(() => { tree = TestRenderer.create(<CustomerProfileContent />) as Tree; });
  act(() => tree.root.findByProps({ title: 'Saved inputs' }).props.onToggle());
  act(() => tree.root.findByProps({ accessibilityLabel: 'Value: Savings rate' }).props.onChangeText('4.25'));
  act(() => tree.root.findByProps({ title: 'Save Savings balance' }).props.onPress());
  act(() => tree.update(<CustomerProfileContent />));
  expect(tree.root.findByProps({ accessibilityLabel: 'Value: Savings rate' }).props.value).toBe('4.25');
});

test('negotiated draft survives failure and clears only after a confirmed successful save', async () => {
  const profile = migrateCustomerProfile(null);
  let attempts = 0;
  const update = jest.fn(async (change: (p: CustomerProfile) => CustomerProfile) => {
    Object.assign(profile, change(profile));
    return ++attempts > 1; // First write committed but its acknowledgement was lost.
  });
  jest.mocked(useCustomerProfile).mockReturnValue({ profile, busy: false, error: null, retry: jest.fn(), update });
  act(() => { tree = TestRenderer.create(<CustomerProfileContent productKey="bank|product" />) as Tree; });
  act(() => tree.root.findByProps({ title: 'Negotiated terms' }).props.onToggle());
  for (const [label, value] of [['Term', 'Discount'], ['Value', '0'], ['Unit', 'AUD']]) act(() => tree.root.findByProps({ label }).props.onChangeText(value));
  await act(async () => { tree.root.findByProps({ title: 'Save negotiated term' }).props.onPress(); });
  expect(tree.root.findByProps({ label: 'Value' }).props.value).toBe('0');
  await act(async () => { tree.root.findByProps({ title: 'Save negotiated term' }).props.onPress(); });
  expect(tree.root.findByProps({ label: 'Value' }).props.value).toBe('');
  expect(profile.negotiatedTerms).toHaveLength(1);
});

test('a supported explicit contract renders its labelled input and no inferred questions', () => {
  const profile = migrateCustomerProfile(null);
  jest.mocked(useCustomerProfile).mockReturnValue({ profile, busy: false, error: null, retry: jest.fn(), update: jest.fn() });
  const contract = { schemaVersion: 1 as const, productKey: 'bank|product', revisionSha256: 'a'.repeat(64), effectiveFrom: '2020-01-01', effectiveToExclusive: '2099-01-01',
    inputs: [{ id: 'age', label: 'Age in years', type: 'decimal' as const, unit: 'years' }],
    rule: { id: 'age-rule', op: 'compare' as const, field: 'age', comparison: 'gte' as const, expected: { type: 'decimal' as const, value: '18', unit: 'years' } } };
  act(() => { tree = TestRenderer.create(<CustomerProfileContent productKey="bank|product" contract={contract} />) as Tree; });
  expect(tree.root.findByProps({ title: 'Save Age in years' })).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).not.toContain('approved');
});
