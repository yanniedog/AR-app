import React from 'react';
import mockReact from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MortgageComparison } from '../src/components/product/MortgageComparison';
import { MortgagePeriodForm } from '../src/components/product/MortgagePeriodForm';
import { mortgageComparisonHarness } from '../test-support/mortgageComparisonHarness';
import { mortgageAnswerId } from '../src/data/mortgageContracts/facts';
import { profile } from '../test-support/executableDepositHarness';
import { parseReceipt } from '../src/data/receiptReplay/parse';
import * as Clipboard from 'expo-clipboard';
let mockState: any, mockProfile: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: mockProfile, busy: false }) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/product/DepositCriteria', () => ({ ReviewedCriteria: 'ReviewedCriteria' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Disclosure: ({ children, open, ...props }: any) => mockReact.createElement('Disclosure', props, open ? children : null) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => undefined) }));

test.each([false, true])('actual lazy two-row mortgage form, comparison and replayable export (partial=%s)', async partial => {
  const h = await mortgageComparisonHarness(); mockState = { ...h.context, ensureDetails: jest.fn(async () => undefined) };
  mockProfile = { ...profile, answers: Object.fromEntries(h.draft.alternatives.map(a => [mortgageAnswerId(a.selection.subject, 'adult'), { state: 'known', fact: { type: 'boolean', value: true }, provenance: { source: 'user_input', recordedAt: null, productKey: a.target.productKey, effectiveFrom: null, effectiveToExclusive: null } }])) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<MortgageComparison rows={h.rows} />); });
  expect(tree.root.findAllByProps({ title: 'Compare confirmed mortgage periods' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ title: 'Compare historical mortgage periods' }).props.onToggle());
  for (let n = 0; n < 2; n++) {
    const form = () => tree.root.findAllByType(MortgagePeriodForm)[n];
    act(() => form().findAllByType('Chip').find((x: any) => x.props.label.startsWith('Choose ')).props.onPress());
    for (const [label, value] of [['Local loan account reference', `account${n}`], ['Local offer reference', `offer${n}`], ['Offer version reference', 'version'], ['Opening statement reference', 'statement'], ['Confirmed annual rate (%)', n ? '7.3' : '3.65'], ['Opening total debt (AUD)', '1000'], ['Principal (AUD)', '1000'], ['Posted interest (AUD)', '0'], ['Unposted interest (AUD)', '0'], ['Capitalised charges (AUD)', '0'], ['Other debt (AUD)', '0'], ['Confirmed monthly amount due (AUD)', '30'], ['Original monthly due date', '2024-01-01'], ['Cleared payment on 2024-01-01 (AUD)', partial ? '29' : '30'], ['External fee account reference: fees', 'fee-account']]) {
      act(() => form().findByProps({ label }).props.onChangeText(value));
    }
    act(() => form().findAllByType('Chip').find((x: any) => x.props.label.startsWith('Fee fee-1:')).props.onPress());
    for (const label of ['No opening overdue obligations or default', 'No advances, redraw, offsets, reversals, rate changes or closure', 'All cleared payments for this period are recorded', 'I confirm these offer, statement and payment details']) act(() => form().findByProps({ label }).props.onPress());
  }
  act(() => tree.root.findByProps({ label: 'These loan-only periods have no omitted linked-account effects' }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Compare confirmed mortgage periods' }).props.onPress());
  await act(async () => tree.root.findByProps({ title: 'Copy mortgage comparison receipt' }).props.onPress());
  const text = (Clipboard.setStringAsync as jest.Mock).mock.calls.at(-1)[0], r = JSON.parse(text);
  expect(r.receipt.available).toBe(!partial); expect(parseReceipt(text).kind).toBe('historical_mortgage_comparison');
  if (partial) { expect(r.receipt.results.every((x: any) => x.rank === null)).toBe(true); expect(JSON.stringify(tree.toJSON())).toContain('Known components only'); }
  else expect(r.receipt.results[0].receipt.netInterestFeeCost).toBe('2.100000000000');
  act(() => tree.root.findAllByType(MortgagePeriodForm)[0].findByProps({ label: 'Principal (AUD)' }).props.onChangeText('2000'));
  expect(tree.root.findAllByProps({ title: 'Copy mortgage comparison receipt' })).toHaveLength(0);
  mockState = { ...mockState, manifest: { ...mockState.manifest } }; delete mockState.manifest.executable_v3;
  await act(async () => tree.update(<MortgageComparison rows={h.rows} />));
  expect(tree.root.findAllByProps({ title: 'Compare confirmed mortgage periods' })).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('unavailable for one selected row');
  act(() => tree.unmount());
});
