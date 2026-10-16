import React from 'react';
import mockReact from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ReplayAccount } from '../src/components/receiptReplay/ReplayAccount';
import { mortgageHarness } from '../test-support/mortgageHarness';
import { profile } from '../test-support/executableDepositHarness';
import { calculateMortgagePeriod } from '../src/data/mortgageContracts/adapter';
import { mortgageObligationId } from '../src/data/mortgageContracts/calendar';
import { parseReceipt } from '../src/data/receiptReplay/parse';
import { recalculateReceipt, type ReplayChoice } from '../src/data/receiptReplay/recalculate';
import { replayInputControl } from '../src/data/receiptReplay/inputSchema';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/ledger/LedgerField', () => ({ LedgerField: 'LedgerField' }));
jest.mock('../src/components/settings/settingsUi', () => ({ InfoRow: 'InfoRow' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Chip: 'Chip', Disclosure: ({ children, open, ...props }: any) => mockReact.createElement('Disclosure', props, open ? children : null) }));

function field(tree: any, label: string) {
  return tree.root.findAllByType('LedgerField' as any).find((node:any) => node.props.label === label)!;
}
function edit(tree: any, label: string, value: string) {
  const input = field(tree, label);
  expect(input).toBeDefined();
  act(() => input.props.onChangeText(value));
  expect(field(tree, label).props.value).toBe(value);
}
function press(tree: any, label: string) {
  act(() => tree.root.findAllByType('Chip' as any).find((node:any) => node.props.label === label)!.props.onPress());
}

test('real mortgage replay edits retain alphabetic references and reach existing admission without changing the original receipt', async () => {
  const h = await mortgageHarness({ obligation: '30', payment: '30', external_fee: '2' }), [selection] = await h.load();
  const original = calculateMortgagePeriod(selection, h.context, h.target, h.inputs, profile);
  const bytes = JSON.stringify(original), document = parseReceipt(bytes), originalCanonical = canonical(document.original);
  let choice: ReplayChoice | null = null, tree!: any;
  const onChange = (next: ReplayChoice | null) => { choice = next; };
  await act(async () => { tree = TestRenderer.create(<ReplayAccount item={document.items[0]} context={h.context} onChange={onChange} />); });
  act(() => tree.root.findAllByType('Chip' as any).find((node:any) => node.props.label.includes(h.subject.scope.cohortKey))!.props.onPress());
  act(() => tree.root.findByProps({ title: 'Review local inputs' }).props.onToggle());
  edit(tree, 'Local offer reference', 'offer-ref-two');
  edit(tree, 'Offer version reference', 'offer-version-two');
  edit(tree, 'Opening statement reference', 'statement-two');
  edit(tree, 'Account ID', 'loan-two');
  edit(tree, 'Payments / 0 / Account ID', 'loan-two');
  const obligationId = mortgageObligationId(h.subject, 'loan-two', h.inputs.from);
  edit(tree, 'Payments / 0 / Obligation reference', obligationId);
  edit(tree, 'Payments / 0 / ID', 'payment-two');
  edit(tree, 'Fees / 0 / Fee occurrence reference', 'fee-1');
  edit(tree, 'Fees / 0 / External fee account reference', 'fees-two');
  edit(tree, 'Account / 0 / Account ID', 'fees-two');
  edit(tree, 'Account / 0 / External account role', 'fees');
  edit(tree, 'Confirmation date', '2026-09-15T01:00:00Z');
  // Optional offer keys must be editable even when the imported object is empty.
  edit(tree, 'Offer facts / Loan purpose', 'owner-occupied');
  edit(tree, 'Offer facts / Security', 'residential');
  edit(tree, 'Offer facts / Repayment', 'principal-and-interest');
  press(tree, 'Inputs reviewed');
  const result = () => recalculateReceipt(document, h.context, [choice!]);
  expect(result().adapterInputs.inputs).toMatchObject({ accountId: 'loan-two', offerId: 'offer-ref-two', sourceVersion: 'offer-version-two', snapshotId: 'statement-two', confirmedAt: '2026-09-15T01:00:00Z', confirmedOfferFacts: { purpose: 'owner-occupied', security: 'residential', repaymentType: 'principal-and-interest' } });
  expect(result().receipt.totals).toEqual(original.receipt.totals);
  expect(result().receipt.claimAvailable).toBe(true);
  expect(result().inputSha256).not.toBe(original.inputSha256);

  edit(tree, 'Payments / 0 / Obligation reference', 'not-the-current-obligation');
  expect(choice!.confirmed).toBe(false);
  press(tree, 'Inputs reviewed');
  expect(result).toThrow();
  edit(tree, 'Payments / 0 / Obligation reference', obligationId);
  press(tree, 'Payments / 0 / Payment phase · Before daily interest');
  press(tree, 'Inputs reviewed');
  expect(result).toThrow(/timing unsupported/);
  press(tree, 'Payments / 0 / Payment phase · After daily interest');
  press(tree, 'Inputs reviewed');
  expect(result().receipt.claimAvailable).toBe(true);
  edit(tree, 'Account / 0 / External account role', 'unbound-role');
  press(tree, 'Inputs reviewed');
  expect(result).toThrow(/settlement differs/);
  edit(tree, 'Account / 0 / External account role', 'fees');
  press(tree, 'Payments complete · Unknown');
  press(tree, 'Inputs reviewed');
  expect(result).toThrow(/confirmations unavailable/);
  press(tree, 'Payments complete · Complete');
  edit(tree, 'Starting date', '2024-01-02');
  press(tree, 'Inputs reviewed');
  expect(result).toThrow(/period or confirmations unavailable/);
  edit(tree, 'Starting date', h.inputs.from);
  press(tree, 'Inputs reviewed');
  expect(result().receipt.claimAvailable).toBe(true);
  expect(canonical(document.original)).toBe(originalCanonical);
  expect(JSON.stringify(original)).toBe(bytes);
  expect(document.digest).toBe(hashText(bytes));
  expect(document.items[0].inputs).toEqual(h.inputs);
  act(() => tree.unmount());
});

test('private offer edits satisfy the real reviewed eligibility rule and unknown statuses remain closed facts', async () => {
  const h = await mortgageHarness({}, subject => {
    const evidenceIds = subject.policy.inputDefinitions[0].evidenceIds;
    subject.policy.inputDefinitions.push({ field: 'purpose', label: 'Offer purpose', type: 'text', unit: null, binding: 'offer_purpose', evidenceIds });
    subject.policy.eligibility = { id: 'eligible', op: 'and', rules: [subject.policy.eligibility, { id: 'purpose', op: 'compare', field: 'purpose', comparison: 'eq', expected: { type: 'text', value: 'owner-occupied' }, evidenceIds }] };
  }), [selection] = await h.load();
  h.inputs.confirmedOfferFacts.purpose = 'owner-occupied';
  h.inputs.customerFacts[0] = { field: 'adult', state: 'unavailable', value: null };
  const original = calculateMortgagePeriod(selection, h.context, h.target, h.inputs, profile), document = parseReceipt(JSON.stringify(original));
  let choice: ReplayChoice | null = null, tree!: any;
  const onChange = (next: ReplayChoice | null) => { choice = next; };
  await act(async () => { tree = TestRenderer.create(<ReplayAccount item={document.items[0]} context={h.context} onChange={onChange} />); });
  act(() => tree.root.findAllByType('Chip' as any).find((node:any) => node.props.label.includes(h.subject.scope.cohortKey))!.props.onPress());
  act(() => tree.root.findByProps({ title: 'Review local inputs' }).props.onToggle());
  expect(field(tree, 'Customer facts / 0 / State')).toBeUndefined();
  expect(tree.root.findAllByType('InfoRow' as any).find((node:any) => node.props.label === 'Customer facts / 0 / State')!.props.value).toBe('Unavailable');
  expect(field(tree, 'Source')).toBeUndefined();
  edit(tree, 'Offer facts / Loan purpose', 'investor');
  press(tree, 'Inputs reviewed');
  const unavailable = recalculateReceipt(document, h.context, [choice!]);
  expect(unavailable.adapterInputs.facts.purpose).toEqual({ type: 'text', value: 'investor' });
  expect(unavailable.receipt.claimAvailable).toBe(false);
  expect(unavailable.adapterInputs.inputs.customerFacts[0].state).toBe('unavailable');
  edit(tree, 'Offer facts / Loan purpose', 'owner-occupied');
  press(tree, 'Inputs reviewed');
  expect(recalculateReceipt(document, h.context, [choice!]).adapterInputs.facts.purpose.value).toBe('owner-occupied');
  act(() => field(tree, 'Local offer reference').props.onChangeText('invalid reference with spaces'));
  // Editable state reaches admission; forbidden identifier characters are never
  // silently coerced into a different valid offer.
  expect(choice!.inputs.offerId).toBe('invalid reference with spaces');
  press(tree, 'Inputs reviewed');
  expect(() => recalculateReceipt(document, h.context, [choice!])).toThrow();
  act(() => tree.unmount());
});

test('input roles are exact schema paths, not a free-text tunnel for enum names or unknown provider keys', () => {
  for (const path of [['unreviewed', 'offerId'], ['payments', 'nested', 'phase'], ['customerFacts', '0', 'state', 'id'], ['description'], ['status']]) {
    expect(replayInputControl('mortgage_calculation', path)).toBe('review');
  }
  expect(replayInputControl('mortgage_calculation', ['payments', '12', 'phase'])).toBe('phase');
  expect(replayInputControl('mortgage_calculation', ['customerFacts', '0', 'state'])).toBe('factState');
  expect(replayInputControl('mortgage_calculation', ['externalAccounts', '0', 'role'])).toBe('identifier');
  expect(replayInputControl('mortgage_calculation', ['customerFacts', '0', 'value', 'value'], 'decimal')).toBe('number');
  expect(replayInputControl('savings_calculation', ['confirmedAnnualRates', '0', 'intervalId'])).toBe('identifier');
  expect(replayInputControl('savings_activity_calculation', ['confirmedBonusAnnualRates', '0', 'componentId'])).toBe('identifier');
  for (const key of ['type', 'status', 'state', 'provenance']) expect(replayInputControl('td', [key])).toBe('review');
});
