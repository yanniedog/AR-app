import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Chip, Disclosure } from '../ui';
import { ReviewedCriteria } from './DepositCriteria';
import { LedgerField } from '../ledger/LedgerField';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { savingsRequirements, savingsFacts } from '../../data/monetaryContracts/facts';
import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import type { SavingsHolding } from '../../data/portfolioContracts/adapter';
import { Decimal } from '../../lib/productTermsEngine/decimal';
export interface HoldingOption extends Omit<SavingsHolding, 'inputs'> { id: string; label: string }
export interface HoldingEditorValue { optionId: string; accountId: string; openingBalance: string; rates: Record<string, string>; confirmedAt: string | null }
export const emptyHolding = (): HoldingEditorValue => ({ optionId: '', accountId: '', openingBalance: '', rates: {}, confirmedAt: null });
export function holdingInput(value: HoldingEditorValue, option: HoldingOption, startDate: string, endDateExclusive: string): SavingsHolding {
  const confirmedAnnualRates = option.selection.subject.policy.intervals.filter(i => i.from < endDateExclusive && i.toExclusive > startDate).flatMap(i => i.tiers.map(t => {
    let annualRate = '';
    try { const fraction = Decimal.parse(value.rates[`${i.id}:${t.id}`] ?? '').div(Decimal.parse('100')); if (fraction.compare(fraction.rounded(12, 'toward_zero')) === 0) annualRate = fraction.fixed(12); } catch { /* Missing or invalid remains unavailable. */ }
    return { intervalId: i.id, tierId: t.id, annualRate };
  }));
  return { selection: option.selection, target: option.target, inputs: { accountId: value.accountId, openingBalance: value.openingBalance, startDate, endDateExclusive,
    confirmedAnnualRates, confirmedAt: value.confirmedAt, openingAccrualZero: !!value.confirmedAt, openingFundsCleared: value.confirmedAt ? true : null, noMovements: !!value.confirmedAt, noWithholding: !!value.confirmedAt } };
}
export function PortfolioAccountEditor({ value, options, start, end, onChange }: { value: HoldingEditorValue; options: HoldingOption[]; start: string; end: string; onChange: (v: HoldingEditorValue) => void }) {
  const customer = useCustomerProfile(), option = options.find(o => o.id === value.optionId);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const change = (v: Partial<HoldingEditorValue>) => onChange({ ...value, ...v, confirmedAt: null });
  const holding = option ? holdingInput(value, option, start, end) : null;
  const requirements = holding && customer.profile ? savingsRequirements(holding.selection.subject, holding.inputs, customer.profile) : null;
  const trace = holding && customer.profile ? evaluateEligibility(holding.selection.subject.policy.eligibility, savingsFacts(holding.selection.subject, holding.inputs, customer.profile).facts).trace : null;
  const definitions = [...(requirements?.needed ?? []), ...(requirements?.saved ?? [])].filter((d, i, all) => all.findIndex(x => x.id === d.id) === i);
  return <View style={{ gap: 6 }}>
    {options.map(o => <Chip key={o.id} label={o.label} selected={o.id === value.optionId} onPress={() => change({ optionId: o.id, rates: {} })} />)}
    <LedgerField label="Local account reference" value={value.accountId} onChangeText={accountId => change({ accountId })} />
    <LedgerField label="Opening balance (AUD)" value={value.openingBalance} keyboardType="decimal-pad" onChangeText={openingBalance => change({ openingBalance })} />
    {holding?.inputs.confirmedAnnualRates.map(r => { const key = `${r.intervalId}:${r.tierId}`; return <LedgerField key={key} label={`Confirmed annual rate (%) · ${key}`} value={value.rates[key] ?? ''} keyboardType="decimal-pad" onChangeText={text => change({ rates: { ...value.rates, [key]: text } })} />; })}
    {definitions.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={option!.target.productKey} disabled={customer.busy} onSave={answer => void customer.update(p => ({ ...p, definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }))} />)}
    {option && trace && <Disclosure title="Holding criteria and sources" open={evidenceOpen} onToggle={() => setEvidenceOpen(!evidenceOpen)}><ReviewedCriteria contract={{ eligibility: option.selection.subject.policy.eligibility, evidence: option.selection.subject.evidence, inputDefinitions: option.selection.subject.policy.inputDefinitions }} trace={trace} /><AppText variant="small">Reviewed coverage: {option.selection.subject.scope.from} to {option.selection.subject.scope.toExclusive} (end excluded). Original sources verified by producer; account facts reported by you.</AppText></Disclosure>}
    {!!requirements?.deferred.length && <AppText variant="small">Unresolved: {requirements.deferred.map(d => d.label).join(', ')}.</AppText>}
    <AppText variant="small">Confirm your amount and rates, zero opening unposted interest, all opening funds cleared, and no deposits, withdrawals or withholding in this period.</AppText>
    <Chip label="I confirm this account period" selected={!!value.confirmedAt} onPress={() => onChange({ ...value, confirmedAt: value.confirmedAt ? null : new Date().toISOString() })} />
  </View>;
}
