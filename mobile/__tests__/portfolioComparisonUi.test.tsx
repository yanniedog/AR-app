import React from 'react';
import { uiProductName } from '../src/lib/uiCopy';
import mockReact from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { HoldingsResultDetails, HoldingsForm, PortfolioComparison } from '../src/components/product/PortfolioComparison';
import { downloadInflate } from '../src/data/payload';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { savingsHarness, savingsInputs } from '../test-support/savingsMonetaryHarness';
import { compareSavingsHoldings, type HoldingsDraft } from '../src/data/portfolioContracts/adapter';
import { profile as mockProfile } from '../test-support/executableDepositHarness';
import { calculateLedger } from '../src/lib/productTermsEngine/ledger';
import { example } from '../src/lib/productTermsEngine/testSupport';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
let mockState: any;
jest.mock('../src/data/store', () => ({ useStore: (selector: any) => selector(mockState) }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: mockProfile, busy: false }) }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/product/DepositCriteria', () => ({ ReviewedCriteria: 'ReviewedCriteria' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row', Disclosure: ({ children, open, ...props }: any) => mockReact.createElement('Disclosure', props, open ? children : null) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => undefined) }));
test('technical private form explicitly calculates, exports, invalidates edits and rechecks edition on export', async () => {
  const h = await savingsHarness(), [selection] = await h.load();
  const options = [{ id: 'scope', label: uiProductName({ product_name: 'Technical savings scope' }), selection, target: h.target }];
  let tree: any; act(() => { tree = TestRenderer.create(<HoldingsForm context={h.context} options={options} />); });
  const text = (label: string, value: string) => act(() => tree.root.findByProps({ label }).props.onChangeText(value));
  text('Common start · Included', '2026-01-01'); text('Common end · Excluded', '2026-01-11');
  for (let n = 0; n < 2; n++) {
    act(() => tree.root.findAllByProps({ label: 'Technical savings scope' })[n].props.onPress());
    act(() => tree.root.findAllByProps({ label: 'Local account reference' })[n].props.onChangeText(`account-${n}`));
    act(() => tree.root.findAllByProps({ label: 'Opening balance (AUD)' })[n].props.onChangeText('1000'));
    act(() => tree.root.findAllByProps({ label: 'Confirmed annual rate (%) · period-1:tier-1' })[n].props.onChangeText('3.65'));
    act(() => tree.root.findAllByProps({ label: 'Confirm details' })[n].props.onPress());
  }
  act(() => tree.root.findByProps({ label: 'No linked effects' }).props.onPress());
  expect(tree.root.findAllByProps({ title: 'Copy Receipt' })).toHaveLength(0);
  act(() => tree.root.findByProps({ title: 'Calculate Holding set' }).props.onPress());
  await act(async () => tree.root.findByProps({ title: 'Copy Receipt' }).props.onPress());
  expect(JSON.parse((Clipboard.setStringAsync as jest.Mock).mock.calls[0][0]).receipt.available).toBe(true);
  delete (h.context.manifest as any).executable_v3;
  act(() => tree.root.findByProps({ title: 'Copy Receipt' }).props.onPress());
  expect(tree.root.findAllByProps({ title: 'Copy Receipt' })).toHaveLength(0);
  text('Common end · Excluded', '2026-01-10');
  expect(tree.root.findAllByProps({ label: 'Confirm details' }).every((n: any) => !n.props.selected)).toBe(true);
  act(() => tree.unmount());
});

test('technical comparison disclosure loads only reviewed savings and removes a replaced edition', async () => {
  const h = await savingsHarness();
  const row = { provider: 'Technical', product_key: h.target.productKey, product_name: 'Technical holding', rate: '0.0365', rate_index: 1 };
  h.context.core.sections.Savings.rates.push(row);
  const normalized = normalizeCoreWithIntegrity(h.context.core, { coreSha256: h.context.manifest.files.core.sha256 });
  h.context.core = normalized.core; h.context.coreIntegrity = normalized.integrity;
  const rows = [{ row: h.context.core.sections.Savings.rates.find(r => r.product_key === h.target.productKey)!, section: 'Savings' as const }];
  mockState = { ...h.context, ensureDetails: jest.fn(async () => undefined) };
  (downloadInflate as jest.Mock).mockClear();
  let tree: any; act(() => { tree = TestRenderer.create(<PortfolioComparison rows={rows} />); });
  expect(downloadInflate).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ title: 'Compare · Savings · History' }).props.onToggle());
  expect(tree.root.findAllByProps({ title: 'Calculate Holding set' })).toHaveLength(1);
  expect(downloadInflate).toHaveBeenCalledTimes(2);
  mockState = { ...mockState, manifest: { ...mockState.manifest } }; delete mockState.manifest.executable_v3;
  await act(async () => tree.update(<PortfolioComparison rows={rows} />));
  expect(tree.root.findAllByProps({ title: 'Calculate Holding set' })).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Unavailable');
  act(() => tree.unmount());
});

// Technical receipt presentation controls; no claim of bank-approved products.
test.each([
 ['unavailable', null, 'Break-even · Unavailable'],
 ['no crossing', {firstPositive:null,sustainedFrom:null,through:'2026-01-10',transient:false,tiedDates:['2026-01-01']}, 'First positive advantage: Not reached'],
 ['temporary lead', {firstPositive:'2026-01-02',sustainedFrom:null,through:'2026-01-10',transient:true,tiedDates:[]}, 'Temporary lead: Yes'],
 ['sustained lead', {firstPositive:'2026-01-02',sustainedFrom:'2026-01-04',through:'2026-01-10',transient:true,tiedDates:[]}, 'Sustained positive advantage: 4 Jan 2026 · Through: 10 Jan 2026'],
])('shows receipt %s without manufacturing a crossing', (_name, breakEven, expected) => {
 const {contract,scenario}=example();
 const baseline=calculateLedger(contract,scenario);
 // Keep the evaluator's required schema (including its real ledger), then
 // deliberately control unknown/withheld presentation facts in this fixture.
 const result:any={id:'set-2',advantage:breakEven?'1.00':null,breakEven,receipt:{accounts:{savings:{...baseline,claimAvailable:false,status:'incomplete',completeness:'incomplete',eligibility:null,issues:['technical-unavailable'],assumptions:[],inputSha256:'a'.repeat(64),totals:{...baseline.totals,openingBalance:'1000.00',interestAccrued:'1.000000000000',feesCharged:null}}}}};
 let tree:any;act(()=>{tree=TestRenderer.create(<HoldingsResultDetails result={result} referenceId="set-1"/>);});
 expect(JSON.stringify(tree.toJSON())).not.toContain('Interest accrued');
 act(()=>tree.root.findByProps({title:'set-2 · Results'}).props.onToggle());
 const rendered=JSON.stringify(tree.toJSON());expect(rendered).toContain(expected);expect(rendered).toContain('Unknown');expect(rendered).toContain('Known components');expect(rendered).toContain('Claim available: No');expect(rendered).toContain('Status: Partial');expect(rendered).toContain('Unavailable');expect(rendered).toContain('a'.repeat(64));expect(rendered).not.toContain('Opening balance');expect(rendered).not.toContain('Interest accrued');expect(rendered).not.toContain('1000.00');expect(rendered).not.toContain('1.000000000000');
 if((breakEven as any)?.tiedDates.length)expect(rendered).toContain('First equality: 1 Jan 2026');
 act(()=>tree.unmount());
});

test('an actual complete evaluated receipt shows exact totals and its calculation hash', async () => {
  const h = await savingsHarness(), [selection] = await h.load();
  const account = (accountId: string) => ({ selection, target: h.target, inputs: { ...savingsInputs, accountId } });
  const draft: HoldingsDraft = {
    startDate: savingsInputs.startDate, endDateExclusive: savingsInputs.endDateExclusive,
    timezone: selection.subject.authorityGraph.completedPeriod.timezone, metric: 'terminal_net_worth',
    referenceId: 'set-1', independentHoldingsConfirmed: true,
    alternatives: [{ id: 'set-1', accounts: [account('reference-account')] }, { id: 'set-2', accounts: [account('savings')] }],
  };
  const result = compareSavingsHoldings(h.context, mockProfile, draft).receipt.results[1];
  const receipt = result.receipt.accounts.savings;
  expect(receipt.claimAvailable).toBe(true);
  expect(receipt.totals?.openingBalance).toBe('1000.00');
  expect(receipt.totals?.interestAccrued).toBe('1.000000000000');
  let tree: any;
  act(() => { tree = TestRenderer.create(<HoldingsResultDetails result={result} referenceId="set-1" />); });
  try {
    expect(JSON.stringify(tree.toJSON())).not.toContain('Opening balance');
    act(() => tree.root.findByProps({ title: 'set-2 · Results' }).props.onToggle());
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('Claim available: Yes');
    expect(rendered).toContain('Opening balance'); expect(rendered).toContain('$1000.00');
    expect(rendered).toContain('Interest accrued'); expect(rendered).toContain('$1.000000000000');
    expect(rendered).toContain(receipt.inputSha256);
    expect(rendered).not.toContain('Known components');
  } finally { act(() => tree.unmount()); }
});
