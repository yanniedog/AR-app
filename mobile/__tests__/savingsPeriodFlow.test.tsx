import React from 'react';
import mockReact from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SavingsPeriodCalculation } from '../src/components/product/SavingsPeriodCalculation';
import { savingsHarness } from '../test-support/savingsMonetaryHarness';
import { profile as mockProfile } from '../test-support/executableDepositHarness';
import * as Clipboard from 'expo-clipboard';
let mockState: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: mockProfile, busy: false }) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/product/DepositCriteria', () => ({ ReviewedCriteria: 'ReviewedCriteria' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => mockReact.createElement('Disclosure', props, open ? children : null) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => undefined) }));

test('lazy private savings form calculates, exports, and invalidates on input or edition change', async () => {
  const h = await savingsHarness(); mockState = { ...h.context, ensureDetails: jest.fn(async () => undefined) };
  let tree: any; await act(async () => { tree = TestRenderer.create(<SavingsPeriodCalculation productKey={h.target.productKey} />); });
  expect(tree.root.findAllByProps({ title: 'Calculate Savings' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ title: 'Savings · History' }).props.onToggle());
  const choose = tree.root.findAllByType('Chip').find((n: any) => n.props.label === 'technical-cohort / All / None');
  act(() => choose.props.onPress());
  for (const label of ['Period start · Included', 'Period end · Excluded']) {
    const date = tree.root.findByProps({ label });
    expect(date.props.value).toBe('');
    expect(date.props.placeholder).toBe('YYYY-MM-DD');
    expect(date.props.accessibilityLabel).toBe(`${label} · YYYY-MM-DD`);
    expect(date.props.hint).toBeUndefined();
  }
  for (const [label, value] of [['Local account reference','local-test'],['Opening balance (AUD)','1000'],['Period start · Included','2026-01-01'],['Period end · Excluded','2026-01-11']]) act(() => tree.root.findByProps({ label }).props.onChangeText(value));
  const rate = tree.root.findAllByType('LedgerField').find((n: any) => n.props.label.startsWith('Confirmed annual rate'));
  expect(rate.props.label).toBe('Confirmed annual rate (%) · Marginal tier · ≥$0'); expect(rate.props.hint).toBeUndefined(); expect(JSON.stringify(tree.toJSON())).toContain('Reviewed · 3.65%');
  act(() => rate.props.onChangeText('3.65'));
  for (const label of ['Opening accrual zero','Opening funds cleared','No movements','No withholding','Confirmed']) act(() => tree.root.findByProps({ label }).props.onPress());
  act(() => tree.root.findByProps({ title: 'Calculate Savings' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('1001.00');
  await act(async () => tree.root.findByProps({ title: 'Copy Receipt' }).props.onPress());
  const receipt = JSON.parse((Clipboard.setStringAsync as jest.Mock).mock.calls.at(-1)[0]);
  expect(receipt.adapterInputs.inputs.openingBalance).toBe('1000'); expect(receipt.receipt.claimAvailable).toBe(true);
  expect(receipt.adapterInputs.inputs.startDate).toBe('2026-01-01');
  expect(receipt.adapterInputs.inputs.endDateExclusive).toBe('2026-01-11');
  expect(tree.root.findByProps({ label: 'Period start · Included' }).props.value).toBe('2026-01-01');
  expect(tree.root.findByProps({ label: 'Period end · Excluded' }).props.value).toBe('2026-01-11');
  act(() => tree.root.findByProps({ label: 'Opening balance (AUD)' }).props.onChangeText('2000'));
  expect(tree.root.findAllByProps({ title: 'Copy Receipt' })).toHaveLength(0);
  mockState = { ...mockState, manifest: { ...mockState.manifest } }; delete mockState.manifest.executable_v3;
  await act(async () => tree.update(<SavingsPeriodCalculation productKey={h.target.productKey} />));
  expect(JSON.stringify(tree.toJSON())).toContain('Unavailable');
});

