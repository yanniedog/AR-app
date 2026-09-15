import React, { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import { calculateSavingsPeriod } from '../../data/monetaryContracts/adapter';
import { assertSavingsSelection, type SavingsSelection, type SavingsContext, type SavingsTarget } from '../../data/monetaryContracts/transport';
import { savingsFacts, savingsRequirements, type SavingsPeriodInputs } from '../../data/monetaryContracts/facts';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { LedgerField } from '../ledger/LedgerField';
import { AppText, Chip, Button, Disclosure } from '../ui';
import { ReviewedCriteria } from './DepositCriteria';
import { savingsRateLabel, savingsRatePercent } from './savingsRateLabels';
const scopeLabel = (text: string, kind: string) => text === 'all_source_declared' ? `All reviewed ${kind}` : text === 'none_source_declared' ? `No ${kind}` : text;
export function SavingsPeriodForm({ selections, context, target }: { selections: SavingsSelection[]; context: SavingsContext; target: SavingsTarget }) {
  const customer = useCustomerProfile(), [selectedId, setSelectedId] = useState<string | null>(null), [detailsOpen, setDetailsOpen] = useState(false), [savedOpen, setSavedOpen] = useState(false), [copyStatus, setCopyStatus] = useState('');
  const [values, setValues] = useState<Omit<SavingsPeriodInputs, 'confirmedAnnualRates'>>({ accountId: '', startDate: '', endDateExclusive: '', openingBalance: '', confirmedAt: null, openingAccrualZero: false, openingFundsCleared: null, noMovements: false, noWithholding: false });
  const [rateTexts, setRateTexts] = useState<Record<string, string>>({});
  const selection = selections.find(s => s.subject.id === selectedId), periods = selection?.subject.policy.intervals.filter(i => i.from < values.endDateExclusive && i.toExclusive > values.startDate) ?? [];
  const rates = periods.flatMap(i => i.tiers.map(t => { let annualRate = ''; try { const fraction = Decimal.parse(rateTexts[`${selectedId}:${i.id}:${t.id}`] ?? '').div(Decimal.parse('100')); const text = fraction.fixed(12); if (fraction.compare(Decimal.parse(text)) === 0) annualRate = text; } catch { /* Entered text remains unavailable until exact decimal. */ } return { intervalId: i.id, tierId: t.id, annualRate }; }));
  const inputs: SavingsPeriodInputs = { ...values, confirmedAnnualRates: rates }, identity = hashText(canonical([selectedId, inputs, customer.profile?.revision ?? null]));
  const [result, setResult] = useState<{ identity: string; value?: ReturnType<typeof calculateSavingsPeriod>; error?: string } | null>(null), current = result?.identity === identity ? result : null;
  function change(update: Partial<typeof values>) { setValues(old => ({ ...old, ...update, confirmedAt: null })); setCopyStatus(''); }
  if (!customer.profile) return <AppText variant="small">{customer.error ?? 'Opening encrypted local inputs...'}</AppText>;
  const criteria = selections.map(s => ({ selection: s, result: evaluateEligibility(s.subject.policy.eligibility, savingsFacts(s.subject, inputs, customer.profile!).facts) }));
  const requirements = selection ? savingsRequirements(selection.subject, inputs, customer.profile) : null;
  function calculate() {
    try { if (!selection) throw new Error('Choose a reviewed savings scope.'); setResult({ identity, value: calculateSavingsPeriod(selection, context, target, inputs, customer.profile!) }); }
    catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Savings calculation unavailable' }); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">Historical holding result before tax. Account details stay on this device.</AppText>
    <AppText variant="small">Source publication: {context.manifest?.run_date}. Original historical source files are verified by the producer; this app verifies the approved structured record and publication.</AppText>
    {criteria.map(({ selection: s, result: r }) => <View key={s.subject.id} style={{ gap: 4 }}><Chip label={`Choose ${scopeLabel(s.subject.scope.cohortKey, 'customers')} / ${scopeLabel(s.subject.scope.tierKey, 'tier')} / ${scopeLabel(s.subject.scope.packageKey, 'package')}`} selected={selectedId === s.subject.id} onPress={() => { setSelectedId(s.subject.id); change({}); }} /><AppText variant="small">Recorded criteria: {r.status.replace(/_/g, ' ')}. Not bank approval.</AppText></View>)}
    {criteria.filter(c => c.result.status === 'meets').length > 1 && <AppText variant="small">Several scopes meet the recorded criteria. Choose one; their policies are not combined.</AppText>}
    <LedgerField label="Local account reference" value={values.accountId} onChangeText={accountId => change({ accountId })} hint="A short reference starting with a letter" />
    <LedgerField label="Opening balance (AUD)" value={values.openingBalance} keyboardType="decimal-pad" onChangeText={openingBalance => change({ openingBalance })} />
    <LedgerField label="Period start" hint="YYYY-MM-DD, included" value={values.startDate} onChangeText={startDate => change({ startDate })} />
    <LedgerField label="Period end" hint="YYYY-MM-DD, excluded" value={values.endDateExclusive} onChangeText={endDateExclusive => change({ endDateExclusive })} />
    {selection && <>
      <AppText variant="small">Reviewed period: {selection.subject.scope.from} to {selection.subject.scope.toExclusive} (end excluded). Data complete through: {selection.subject.authorityGraph.completedPeriod.completedThroughExclusive} (excluded). These are coverage bounds, not bank policy expiry dates.</AppText>
      {periods.flatMap(i => i.tiers.map((t, index) => { const key = `${selectedId}:${i.id}:${t.id}`; return <LedgerField key={key} label={`Confirmed annual rate (%) · ${savingsRateLabel(i, index)}`} hint={`${i.from} until ${i.toExclusive} (exclusive); reviewed ${savingsRatePercent(t.annualRate)}%`} value={rateTexts[key] ?? ''} keyboardType="decimal-pad" onChangeText={text => { setRateTexts(old => ({ ...old, [key]: text })); change({}); }} />; }))}
      <Chip label="Opening unposted interest was zero" selected={values.openingAccrualZero} onPress={() => change({ openingAccrualZero: !values.openingAccrualZero })} />
      {periods.some(i => i.interest.depositSettlementBasis === 'cleared_only') && <Chip label="All opening funds were cleared" selected={values.openingFundsCleared === true} onPress={() => change({ openingFundsCleared: values.openingFundsCleared !== true })} />}
      <Chip label="No deposits or withdrawals during this period" selected={values.noMovements} onPress={() => change({ noMovements: !values.noMovements })} />
      <Chip label="No withholding during this period" selected={values.noWithholding} onPress={() => change({ noWithholding: !values.noWithholding })} />
      {requirements?.needed.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer => void customer.update(p => ({ ...p, definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }))} />)}
      {!!requirements?.deferred.length && <AppText variant="small">Unresolved: {requirements.deferred.map(d => d.label).join(', ')}.</AppText>}
      <Disclosure title="Saved criteria answers" open={savedOpen} onToggle={() => setSavedOpen(!savedOpen)}>{requirements?.saved.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer => void customer.update(p => ({ ...p, answers: { ...p.answers, [d.id]: answer } }))} />)}</Disclosure>
      <Chip label="I confirm these account details and rates" selected={!!values.confirmedAt} onPress={() => setValues(old => ({ ...old, confirmedAt: old.confirmedAt ? null : new Date().toISOString() }))} />
      <Disclosure title="Criteria and source evidence" open={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)}><ReviewedCriteria contract={{ eligibility: selection.subject.policy.eligibility, inputDefinitions: selection.subject.policy.inputDefinitions, evidence: selection.subject.evidence }} trace={criteria.find(c => c.selection === selection)!.result.trace} /></Disclosure>
    </>}
    <Button title="Calculate savings period" disabled={customer.busy} onPress={calculate} />
    {current?.error && <AppText variant="small">{current.error}</AppText>}
    {current?.value && <View style={{ gap: 6 }}>
      <AppText variant="small">{current.value.receipt.claimAvailable ? 'Complete for this confirmed historical holding period, before tax.' : `Unavailable: ${current.value.receipt.issues.join('; ')}`}</AppText>
      {current.value.receipt.claimAvailable && current.value.receipt.totals && <>
        <AppText>Closing posted balance: ${current.value.receipt.totals.closingBalance}</AppText><AppText>Interest posted: ${current.value.receipt.totals.interestPosted}</AppText><AppText>Interest unposted: ${current.value.receipt.totals.interestUnposted}</AppText><AppText variant="small">Rounding adjustment: ${current.value.receipt.totals.interestRoundingAdjustment}. No account closure or future return is calculated.</AppText>
      </>}
      <Button title="Copy savings receipt" variant="secondary" onPress={() => { try { if (!selection) throw new Error(); assertSavingsSelection(selection, context, target); void Clipboard.setStringAsync(JSON.stringify(current.value, null, 2)).then(() => setCopyStatus('Receipt copied.'), () => setCopyStatus('Receipt could not be copied.')); } catch { setCopyStatus('Source selection changed. Calculate again.'); } }} />
      <AppText variant="small">The receipt includes this account period, entered facts, source identities and daily trace.</AppText>
    </View>}
    {!!copyStatus && current && <AppText variant="small">{copyStatus}</AppText>}
  </View>;
}
