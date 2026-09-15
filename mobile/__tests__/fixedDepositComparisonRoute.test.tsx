import { CanonicalTermsComparison } from '../src/components/product/CanonicalTermsComparison';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import Compare from '../app/compare';
import { FixedDepositComparison } from '../src/components/product/FixedDepositComparison';
import { comparisonSetup, inputs, profile } from '../test-support/executableDepositHarness';
import { downloadInflate } from '../src/data/payload';
type Renderer = ReactTestRenderer & { root: any; toJSON: () => unknown };
let mockState: any, mockKeys = '';
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ keys: mockKeys }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: jest.requireActual('../test-support/executableDepositHarness').profile, busy: false, update: jest.fn() }) }));
jest.mock('../src/components/ExternalLinkConfirmation', () => ({ useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen' }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/product/ComparisonDisclosures', () => ({ ComparisonDisclosures: 'ComparisonDisclosures', PersonalCostComparisonDisclosure: 'UnavailableComparison', publishedItemCount: () => 'Unavailable' }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ ProductRateChangeLine: 'ProductRateChangeLine' }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Badge: 'Badge', Card: 'Card', Divider: 'Divider', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => jest.requireActual('react').createElement('Disclosure', { ...props, open }, open ? children : null) }));
beforeEach(() => { (downloadInflate as jest.Mock).mockReset(); (Clipboard.setStringAsync as jest.Mock).mockClear(); });
async function render() {
  const x = comparisonSetup(); mockState = { ...x.context, details: { products: {} }, prefs: { depositRankMetric: 'advertised', mortgageRateMetric: 'advertised' }, ensureDetails: jest.fn() };
  mockKeys = JSON.stringify(x.rows.map(row => `${row.rate_index}#${row.product_key}`));
  let tree!: Renderer;
  await act(async () => { tree = TestRenderer.create(<Compare />) as Renderer; });
  expect(tree.root.findByType(FixedDepositComparison).props.rows[0]).toBe(x.rows[0]);
  expect(tree.root.findByType(CanonicalTermsComparison).props.rows[0]).toBe(x.rows[0]);
  expect(tree.root.findByType(FixedDepositComparison).props.rows[1]).toBe(x.rows[1]);
  await act(async () => { tree.root.findByProps({ title: 'Personal cost comparison' }).props.onToggle(); });
  return { x, tree };
}
function fill(tree: Renderer) {
  act(() => tree.root.findByProps({ label: 'Comparison amount (AUD)' }).props.onChangeText(inputs.principal));
  act(() => tree.root.findByProps({ label: 'Comparison funding date' }).props.onChangeText(inputs.fundedDate));
  for (let i = 0; i < 2; i++) {
    act(() => tree.root.findAllByProps({ label: 'Bank-confirmed maturity date' })[i].props.onChangeText(inputs.maturityDate));
    act(() => tree.root.findAllByProps({ label: 'Bank-confirmed annual rate (%)' })[i].props.onChangeText(i ? '7.3' : '3.65'));
    for (const label of ['Bank agreed this amount, rate and these dates', 'No withholding applies to this payout']) act(() => tree.root.findAllByProps({ label })[i].props.onPress());
  }
}
test('actual compare route binds original rows, computes2.90 advantage and exports local confirmed rates', async () => {
  const { tree } = await render(); fill(tree);
  act(() => tree.root.findByProps({ title: 'Compare maturity returns' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('1005.80'); expect(JSON.stringify(tree.toJSON())).toContain('2.90');
  await act(async () => { tree.root.findByProps({ title: 'Comparison details' }).props.onToggle(); });
  await act(async () => { tree.root.findByProps({ title: 'Copy comparison receipt' }).props.onPress(); });
  const receipt = JSON.parse((Clipboard.setStringAsync as jest.Mock).mock.calls[0][0]);
  expect(hashText(canonical(receipt.comparisonInputs))).toBe(receipt.inputSha256);
  expect(receipt.rankAvailable).toBe(true); expect(receipt.results[1].data.receipt.localTdConfirmation.annualRate).toBe('0.073000000000');
  expect(receipt.results.map((r: any) => r.advantage)).toEqual(['0.00', '2.90']);
  expect(profile.answers).toEqual({});
  act(() => tree.root.findByProps({ label: 'Comparison amount (AUD)' }).props.onChangeText('2000'));
  expect(JSON.stringify(tree.toJSON())).not.toContain('1005.80');
  expect(tree.root.findAllByProps({ label: 'Bank agreed this amount, rate and these dates' }).every((chip: any) => !chip.props.selected)).toBe(true);
  act(() => tree.unmount());
});
test('edition change synchronously removes result; missing templates never substitute engineering offers', async () => {
  const { tree } = await render(); fill(tree); act(() => tree.root.findByProps({ title: 'Compare maturity returns' }).props.onPress());
  mockState = { ...mockState, manifest: { ...mockState.manifest, files: { core: mockState.manifest.files.core, details: mockState.manifest.files.details } } };
  await act(async () => tree.update(<Compare />));
  expect(JSON.stringify(tree.toJSON())).not.toContain('1005.80');
  expect(JSON.stringify(tree.toJSON())).toContain('unavailable for this exact rate');
  expect(tree.root.findAllByProps({ label: 'Bank-confirmed annual rate (%)' })).toHaveLength(0);
  act(() => tree.unmount());
});
