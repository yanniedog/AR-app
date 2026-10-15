import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { NegotiatedTermsEditor } from '../src/components/NegotiatedTermsEditor';
import { migrateCustomerProfile } from '../src/data/customerProfileMigration';
import type { CustomerProfile, NegotiatedTerm } from '../src/data/customerProfile';
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return { AppText: 'AppText', Button: 'Button', Disclosure: ({ children, open, ...props }: any) => R.createElement('Disclosure', { ...props, open }, open ? children : null) };
});
type Tree = ReactTestRenderer & { root: any };
const saved: NegotiatedTerm = { id: 'user.term', label: 'Agreed rate', value: '4.5', unit: 'percent', note: 'Subject to signed offer.\nExpires at settlement.',
  provenance: { source: 'user_input', productKey: 'bank|one', recordedAt: '2026-10-15T01:00:00Z', effectiveFrom: '2026-10-15', effectiveToExclusive: '2026-12-01' } };
function render(profile: CustomerProfile, update: (change: (profile: CustomerProfile) => CustomerProfile) => Promise<boolean>, productKey?: string) {
  let tree!: Tree; act(() => { tree = TestRenderer.create(<NegotiatedTermsEditor profile={profile} disabled={false} update={update} productKey={productKey} />) as Tree; });
  act(() => tree.root.findByProps({ title: 'Negotiated terms' }).props.onToggle());
  return tree;
}
test('editing a private saved term exposes and preserves its note, identity and target without body rendering', async () => {
  let profile = { ...migrateCustomerProfile(null), negotiatedTerms: [saved, { ...saved, id: 'user.other', provenance: { ...saved.provenance, productKey: 'bank|two' } }] };
  const update = jest.fn(async (change: (value: CustomerProfile) => CustomerProfile) => { profile = change(profile); return true; });
  const tree = render(profile, update);
  try {
    act(() => tree.root.findAllByProps({ title: 'Edit' })[0].props.onPress());
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe(saved.note);
    expect(tree.root.findByProps({ label: 'Note' }).props.multiline).toBe(true);
    expect(tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)).join(' ')).not.toContain(saved.note);
    act(() => tree.root.findByProps({ label: 'Value' }).props.onChangeText('4.25'));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress());
    expect(profile.negotiatedTerms.find(term => term.id === saved.id)).toMatchObject({ id: saved.id, note: saved.note, value: '4.25', provenance: { productKey: 'bank|one', effectiveFrom: '2026-10-15', effectiveToExclusive: '2026-12-01' } });
    expect(profile.negotiatedTerms.find(term => term.id === 'user.other')).toEqual({ ...saved, id: 'user.other', provenance: { ...saved.provenance, productKey: 'bank|two' } });
  } finally { act(() => tree.unmount()); }
});
test('notes are empty for new terms unless authored, and failed writes retain the full draft for retry', async () => {
  let profile = migrateCustomerProfile(null), writes = 0;
  const update = jest.fn(async (change: (value: CustomerProfile) => CustomerProfile) => { if (++writes === 1) return false; profile = change(profile); return true; });
  const tree = render(profile, update, 'bank|one');
  try {
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe('');
    for (const [label, value] of [['Term', 'Discount'], ['Value', '0'], ['Unit', 'AUD'], ['Note', 'Quoted subject to final approval.\nNo fees confirmed.']]) act(() => tree.root.findByProps({ label }).props.onChangeText(value));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress());
    expect(profile.negotiatedTerms).toEqual([]);
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe('Quoted subject to final approval.\nNo fees confirmed.');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress());
    expect(profile.negotiatedTerms[0]).toMatchObject({ note: 'Quoted subject to final approval.\nNo fees confirmed.', value: '0' });
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe('');
  } finally { act(() => tree.unmount()); }
});
test('cancelling edits preserves saved notes and explicitly clearing a note saves only that chosen term', async () => {
  let profile = { ...migrateCustomerProfile(null), negotiatedTerms: [saved] };
  const update = jest.fn(async (change: (value: CustomerProfile) => CustomerProfile) => { profile = change(profile); return true; });
  const tree = render(profile, update, 'bank|one');
  try {
    act(() => tree.root.findByProps({ title: 'Edit' }).props.onPress());
    act(() => tree.root.findByProps({ label: 'Note' }).props.onChangeText('Draft'));
    act(() => tree.root.findByProps({ title: 'Cancel' }).props.onPress());
    expect(profile.negotiatedTerms[0].note).toBe(saved.note); expect(update).not.toHaveBeenCalled();
    act(() => tree.root.findByProps({ title: 'Edit' }).props.onPress());
    act(() => tree.root.findByProps({ label: 'Note' }).props.onChangeText(''));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress());
    expect(profile.negotiatedTerms[0]).toMatchObject({ id: saved.id, note: '' });
  } finally { act(() => tree.unmount()); }
});
test('changing product context cancels the prior edit without writing its private note', () => {
  const profile = { ...migrateCustomerProfile(null), negotiatedTerms: [saved] }, update = jest.fn();
  const tree = render(profile, update, 'bank|one');
  try {
    act(() => tree.root.findByProps({ title: 'Edit' }).props.onPress());
    act(() => tree.update(<NegotiatedTermsEditor profile={profile} disabled={false} update={update} productKey="bank|two" />));
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe(''); expect(update).not.toHaveBeenCalled();
    expect(profile.negotiatedTerms[0].note).toBe(saved.note);
  } finally { act(() => tree.unmount()); }
});
test('two rapid saves produce one write; rejection preserves the exact note and releases retry', async () => {
  const profile = { ...migrateCustomerProfile(null), negotiatedTerms: [saved] };
  let reject!: (error: Error) => void;
  const update = jest.fn(() => new Promise<boolean>((_resolve, fail) => { reject = fail; }));
  const tree = render(profile, update, 'bank|one');
  try {
    act(() => tree.root.findByProps({ title: 'Edit' }).props.onPress());
    const save = tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress;
    let pending!: Promise<void>;
    act(() => { pending = save(); void save(); });
    expect(update).toHaveBeenCalledTimes(1); expect(tree.root.findByProps({ label: 'Note' }).props.editable).toBe(false);
    await act(async () => { reject(new Error('Private raw storage error')); await pending; });
    expect(tree.root.findByProps({ label: 'Note' }).props.value).toBe(saved.note);
    expect(tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.disabled).toBe(false);
    expect(tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)).join(' ')).toContain('Unavailable');
    expect(tree.root.findAllByType('AppText').map((node: any) => String(node.props.children)).join(' ')).not.toContain('Private raw storage');
    expect(profile.negotiatedTerms[0].note).toBe(saved.note);
    update.mockResolvedValueOnce(true);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Save Negotiated terms' }).props.onPress());
    expect(update).toHaveBeenCalledTimes(2);
  } finally { act(() => tree.unmount()); }
});
