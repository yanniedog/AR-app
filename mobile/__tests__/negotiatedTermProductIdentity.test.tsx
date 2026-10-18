import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import sampleDetails from '../assets/sample/details.json';
import { CustomerProfileContent } from '../src/components/CustomerProfilePanel';
import { NegotiatedTermsEditor } from '../src/components/NegotiatedTermsEditor';
import { migrateCustomerProfile } from '../src/data/customerProfileMigration';
import type { CustomerProfile, NegotiatedTerm } from '../src/data/customerProfile';
import type { DetailsPayload } from '../src/types';

let mockDetails: DetailsPayload | null;
let mockProfile: CustomerProfile;
const mockUpdate = jest.fn(async (change: (value: CustomerProfile) => CustomerProfile) => { mockProfile = change(mockProfile); return true; });
jest.mock('../src/data/store', () => ({ useStore: (select: (state: { details: DetailsPayload | null }) => unknown) => select({ details: mockDetails }) }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: mockProfile, busy: false, update: mockUpdate }) }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => R.createElement('Disclosure', props, open ? children : null) };
});
const keys = Object.keys(sampleDetails.products).slice(0, 2);
function term(id: string, productKey: string): NegotiatedTerm {
  return { id, label: 'Agreed rate', value: '4.5', unit: 'percent', note: 'Subject to the signed offer.', provenance: { source: 'user_input', productKey, recordedAt: '2026-10-15T01:00:00Z', effectiveFrom: null, effectiveToExclusive: null } };
}
function texts(tree: any): string[] { return tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)); }
function render() {
  let tree: any; act(() => { tree = TestRenderer.create(<CustomerProfileContent />); });
  act(() => tree.root.findByProps({ title: 'Negotiated terms' }).props.onToggle());
  return tree;
}
beforeEach(() => { mockUpdate.mockClear(); mockDetails = sampleDetails as unknown as DetailsPayload; mockProfile = { ...migrateCustomerProfile(null), negotiatedTerms: [term('user.one', keys[0]), term('user.two', keys[1])] }; });

test('global Profile distinguishes actual pipe-key associations and retains exact selected term targets through edit and removal', async () => {
  const original = structuredClone(mockProfile), tree = render();
  try {
    expect(keys[0]).toContain('|'); expect(keys[1]).toContain('|');
    expect(texts(tree)).toContain(keys[0]); expect(texts(tree)).toContain(keys[1]);
    for (const action of ['Edit', 'Remove']) {
      const names = tree.root.findAllByProps({ title: action }).map((node: any) => node.props.accessibilityLabel);
      expect(names).toEqual([`${action} Agreed rate · user.one · ${keys[0]}`, `${action} Agreed rate · user.two · ${keys[1]}`]);
      expect(new Set(names).size).toBe(2);
    }
    act(() => tree.root.findAllByProps({ title: 'Edit' })[1].props.onPress());
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe(original.negotiatedTerms[1].note);
    act(() => tree.root.findByProps({ label: 'Value' }).props.onChangeText('4.25'));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress());
    expect(mockProfile.negotiatedTerms.find(value => value.id === 'user.two')).toMatchObject({ value: '4.25', note: original.negotiatedTerms[1].note, provenance: { productKey: keys[1] } });
    expect(mockProfile.negotiatedTerms.find(value => value.id === 'user.one')).toEqual(original.negotiatedTerms[0]);
    act(() => tree.update(<CustomerProfileContent />));
    const row = tree.root.findAllByType('AppText').find((node: any) => node.props.children === keys[0]).parent;
    await act(async () => row.findByProps({ title: 'Remove' }).props.onPress());
    expect(mockProfile.negotiatedTerms.map(value => [value.id, value.provenance.productKey])).toEqual([['user.two', keys[1]]]);
    expect(texts(tree).join('\n')).not.toContain(original.negotiatedTerms[1].note);
  } finally { act(() => tree.unmount()); }
});

test('unavailable, stale, mismatched and malformed associations stay Unknown without changing stored private data', () => {
  const malformed = 'Read this explanatory product paragraph.';
  mockProfile.negotiatedTerms.push(term('user.malformed', malformed));
  const original = JSON.stringify(mockProfile), tree = render();
  try {
    expect(texts(tree)).not.toContain(malformed); expect(texts(tree)).toContain('Unknown');
    mockDetails = null; act(() => tree.update(<CustomerProfileContent />));
    expect(texts(tree)).not.toContain(keys[0]); expect(texts(tree)).not.toContain(keys[1]);
    mockDetails = { schema_version: 1, run_date: '2026-10-15', products: { [keys[0]]: { displayIdentity: { name: 'Different source product' } } } };
    act(() => tree.update(<CustomerProfileContent />));
    expect(texts(tree)).not.toContain(keys[0]); expect(texts(tree)).not.toContain(keys[1]);
    expect(texts(tree).filter(value => value === 'Unknown')).toHaveLength(3);
    for (const node of tree.root.findAllByType('Button').filter((node: any) => ['Edit', 'Remove'].includes(node.props.title))) {
      expect(node.props.accessibilityLabel).toContain(' · Unknown');
      expect(node.props.accessibilityLabel).not.toContain(malformed);
    }
    expect(JSON.stringify(mockProfile)).toBe(original); expect(mockUpdate).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test('product-scoped term actions distinguish equal labels by their actual saved term IDs', async () => {
  mockProfile.negotiatedTerms = [term('user.one', keys[0]), term('user.two', keys[0])];
  const original = structuredClone(mockProfile);
  let tree: any; act(() => { tree = TestRenderer.create(<NegotiatedTermsEditor profile={mockProfile} productKey={keys[0]} disabled={false} update={mockUpdate} />); });
  try {
    act(() => tree.root.findByProps({ title: 'Negotiated terms' }).props.onToggle());
    for (const action of ['Edit', 'Remove']) {
      expect(tree.root.findAllByProps({ title: action }).map((node: any) => node.props.accessibilityLabel))
        .toEqual([`${action} Agreed rate · user.one`, `${action} Agreed rate · user.two`]);
    }
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Remove Agreed rate · user.two' }).props.onPress());
    expect(mockProfile.negotiatedTerms).toEqual([original.negotiatedTerms[0]]);
  } finally { act(() => tree.unmount()); }
});
