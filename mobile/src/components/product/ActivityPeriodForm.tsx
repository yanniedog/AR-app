import React, { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import { calculateSavingsActivityPeriod } from '../../data/activityContracts/adapter';
import { assertActivitySelection, type ActivitySelection, type ActivityContext, type ActivityTarget } from '../../data/activityContracts/transport';
import { savingsFacts, savingsRequirements, type SavingsPeriodInputs } from '../../data/monetaryContracts/facts';
import { ActivityEvents } from './ActivityEvents';
import type { ActivityInputs } from '../../data/activityContracts/types';
import type { SavingsActivityEvent } from '../../lib/productTermsEngine/savingsActivityTypes';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { LedgerField } from '../ledger/LedgerField';
import { AppText, Chip, Button, Disclosure } from '../ui';
import { ReviewedCriteria } from './DepositCriteria';
import { savingsRatePercent } from './savingsRateLabels';
import { EngineReceiptFacts, uiEngineStatus } from './EngineReceiptFacts';
import { uiEngineScope, uiSavingsTier } from './engineComparisonUi';
import { uiCount, uiDate, uiDecimal, uiJoin, uiLabel, uiInputIdentifier, uiInputNumber, type UiLabel } from '../../lib/uiCopy';
export function ActivityPeriodForm({ selections, context, target }: { selections: ActivitySelection[]; context: ActivityContext; target: ActivityTarget }) {
  const customer = useCustomerProfile(), [selectedId, setSelectedId] = useState<string | null>(null), [detailsOpen, setDetailsOpen] = useState(false), [savedOpen, setSavedOpen] = useState(false), [copyStatus, setCopyStatus] = useState<UiLabel>('');
  const [values, setValues] = useState<Omit<SavingsPeriodInputs, 'confirmedAnnualRates'>>({ accountId: '', startDate: '', endDateExclusive: '', openingBalance: '', confirmedAt: null, openingAccrualZero: false, openingFundsCleared: null, noMovements: false, noWithholding: false });
  const [events,setEvents]=useState<SavingsActivityEvent[]>([]),[coverage,setCoverage]=useState(false);
  const [rateTexts, setRateTexts] = useState<Record<string, string>>({});
  const selection = selections.find(s => s.subject.id === selectedId), periods = selection?.subject.policy.intervals.filter(i => i.from < values.endDateExclusive && i.toExclusive > values.startDate) ?? [];
  const rates = periods.flatMap(i => i.tiers.map(t => { let annualRate = ''; try { const fraction = Decimal.parse(rateTexts[`${selectedId}:${i.id}:${t.id}`] ?? '').div(Decimal.parse('100')); const text = fraction.fixed(12); if (fraction.compare(Decimal.parse(text)) === 0) annualRate = text; } catch { /* Entered text remains unavailable until exact decimal. */ } return { intervalId: i.id, tierId: t.id, annualRate }; }));
  const bonus=selection?.subject.policy.bonus;
  const bonusRates=bonus?.tiers.map(t=>{let annualRate='';try{const value=Decimal.parse(rateTexts[`${selectedId}:bonus:${t.id}`]??'').div(Decimal.parse('100'));const fixed=value.fixed(12);if(value.compare(Decimal.parse(fixed))===0)annualRate=fixed;}catch{}return{componentId:bonus.componentId,tierId:t.id,annualRate};})??[];
  const inputs: ActivityInputs = { ...values, confirmedAnnualRates: rates,confirmedBonusAnnualRates:bonusRates,activity:{events:events.map(e=>({...e,accountId:values.accountId})),coverage:bonus?[{accountId:values.accountId,from:bonus.assessment.from,toExclusive:bonus.assessment.toExclusive,status:coverage?'complete':'unknown'}]:[]} }, identity = hashText(canonical([selectedId, inputs, customer.profile?.revision ?? null]));
  const [result, setResult] = useState<{ identity: string; value?: ReturnType<typeof calculateSavingsActivityPeriod>; error?: string } | null>(null), current = result?.identity === identity ? result : null;
  function change(update: Partial<typeof values>) { setValues(old => ({ ...old, ...update, confirmedAt: null })); setCopyStatus(''); }
  if (!customer.profile) return <AppText variant="small">{uiLabel(customer.error ? 'Unavailable' : 'Loading')}</AppText>;
  const criteria = selections.map(s => ({ selection: s, result: evaluateEligibility(s.subject.policy.eligibility, savingsFacts(s.subject, inputs, customer.profile!).facts) }));
  const requirements = selection ? savingsRequirements(selection.subject, inputs, customer.profile) : null;
  function calculate() {
    try { if (!selection) throw new Error('Choose a reviewed savings scope.'); setResult({ identity, value: calculateSavingsActivityPeriod(selection, context, target, inputs, customer.profile!) }); }
    catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Savings calculation unavailable' }); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">{uiJoin('Basis', ': ', 'History', ' · ', 'Tax', ': ', 'Excluded', ' · ', 'Local storage')}</AppText>
    <AppText variant="small">{uiJoin('Published', ': ', uiDate(context.manifest?.run_date))}</AppText>
    {criteria.map(({ selection: s, result: r }) => <View key={s.subject.id} style={{ gap: 4 }}><Chip label={uiJoin(uiEngineScope(s.subject.scope.cohortKey), ' / ', uiEngineScope(s.subject.scope.tierKey), ' / ', uiEngineScope(s.subject.scope.packageKey))} selected={selectedId === s.subject.id} onPress={() => { setSelectedId(s.subject.id);setEvents([]);setCoverage(false);setRateTexts({}); change({startDate:s.subject.scope.from,endDateExclusive:s.subject.scope.toExclusive}); }} /><AppText variant="small">{uiJoin('Recorded criteria', ': ', uiEngineStatus(r.status), ' · ', 'Bank approval', ': ', 'Not assessed')}</AppText></View>)}
    {criteria.filter(c => c.result.status === 'meets').length > 1 && <AppText variant="small">{uiJoin('Scopes', ': ', uiCount(criteria.filter(c => c.result.status === 'meets').length))}</AppText>}
    <LedgerField label="Local account reference" value={uiInputIdentifier(values.accountId)} onChangeText={accountId => change({ accountId })} />
    <LedgerField label="Opening balance (AUD)" value={uiInputNumber(values.openingBalance)} keyboardType="decimal-pad" onChangeText={openingBalance => change({ openingBalance })} />
    <LedgerField label={uiJoin('Period start', ' · ', 'Included')} placeholder="YYYY-MM-DD" value={uiInputIdentifier(values.startDate)} onChangeText={startDate => change({ startDate })} />
    <LedgerField label={uiJoin('Period end', ' · ', 'Excluded')} placeholder="YYYY-MM-DD" value={uiInputIdentifier(values.endDateExclusive)} onChangeText={endDateExclusive => change({ endDateExclusive })} />
    {selection && <>
      <AppText variant="small">{uiJoin('Coverage', ': ', uiDate(selection.subject.scope.from), ' – ', uiDate(selection.subject.scope.toExclusive), ' · ', 'End excluded', ' · ', 'Complete through', ': ', uiDate(selection.subject.authorityGraph.completedPeriod.completedThroughExclusive))}</AppText>
      {periods.flatMap(i => i.tiers.map((t, index) => { const key = `${selectedId}:${i.id}:${t.id}`; return <View key={key}><LedgerField label={uiJoin('Confirmed annual rate (%)', ' · ', uiSavingsTier(i, index))} value={uiInputNumber(rateTexts[key] ?? '')} keyboardType="decimal-pad" onChangeText={text => { setRateTexts(old => ({ ...old, [key]: text })); change({}); }} /><AppText variant="small">{uiJoin('Coverage', ': ', uiDate(i.from), ' – ', uiDate(i.toExclusive), ' · ', 'End excluded', ' · ', 'Reviewed', ': ', uiDecimal(savingsRatePercent(t.annualRate), 'percent'))}</AppText></View>; }))}
      {bonus&&<>{bonus.tiers.map((t,index)=>{const key=`${selectedId}:bonus:${t.id}`;return <View key={key}><LedgerField label={uiJoin('Bonus annual rate (%)', ' · ', uiSavingsTier(bonus,index))} value={uiInputNumber(rateTexts[key]??'')} keyboardType="decimal-pad" onChangeText={text=>{setRateTexts(old=>({...old,[key]:text}));change({});}}/><AppText variant="small">{uiJoin('Reviewed', ': ', uiDecimal(savingsRatePercent(t.annualRate),'percent'))}</AppText></View>;})}
      <ActivityEvents assessment={bonus.assessment} accountId={values.accountId} events={events} complete={coverage} onChange={v=>{setEvents(v);change({});}} onCoverage={v=>{setCoverage(v);change({});}}/></>}
      <Chip label="Opening accrual zero" selected={values.openingAccrualZero} onPress={() => change({ openingAccrualZero: !values.openingAccrualZero })} />
      {periods.some(i => i.interest.depositSettlementBasis === 'cleared_only') && <Chip label="Opening funds cleared" selected={values.openingFundsCleared === true} onPress={() => change({ openingFundsCleared: values.openingFundsCleared !== true })} />}
      <Chip label="No movements" selected={values.noMovements} onPress={() => change({ noMovements: !values.noMovements })} />
      <Chip label="No withholding" selected={values.noWithholding} onPress={() => change({ noWithholding: !values.noWithholding })} />
      {requirements?.needed.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer => void customer.update(p => ({ ...p, definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }))} />)}
      {!!requirements?.deferred.length && <AppText variant="small">{uiJoin('Unresolved inputs', ': ', uiCount(requirements.deferred.length))}</AppText>}
      <Disclosure title="Saved answers" open={savedOpen} onToggle={() => setSavedOpen(!savedOpen)}>{requirements?.saved.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={customer.profile!.answers[d.id]} productKey={target.productKey} disabled={customer.busy} onSave={answer => void customer.update(p => ({ ...p, answers: { ...p.answers, [d.id]: answer } }))} />)}</Disclosure>
      <Chip label="Confirm details" selected={!!values.confirmedAt} onPress={() => setValues(old => ({ ...old, confirmedAt: old.confirmedAt ? null : new Date().toISOString() }))} />
      <Disclosure title="Criteria" open={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)}><ReviewedCriteria contract={{ eligibility: selection.subject.policy.eligibility, inputDefinitions: selection.subject.policy.inputDefinitions, evidence: selection.subject.evidence }} trace={criteria.find(c => c.selection === selection)!.result.trace} /></Disclosure>
    </>}
    <Button title="Calculate" disabled={customer.busy} onPress={calculate} />
    {current?.error && <AppText variant="small">{uiLabel("Unavailable")}</AppText>}
    {current?.value && <View style={{ gap: 6 }}>
      <EngineReceiptFacts receipt={current.value.receipt} />
      <AppText variant="small">{uiJoin('Closure', ': ', 'Excluded', ' · ', 'Future return', ': ', 'Excluded')}</AppText>
      {(()=>{const contribution=current.value.receipt.ledger.find(r=>r.savingsContributions)?.savingsContributions?.find(c=>c.kind==='bonus');return contribution&&<><AppText variant="small">{uiJoin('Bonus rate', ': ', uiEngineStatus(contribution.status))}</AppText>{contribution.activityResults?.map(m=><AppText key={m.metricId} variant="small">{uiJoin(m.field==='activity_deposit_total'?'Qualifying deposits':'Qualifying withdrawals', ': ', m.status==='known'&&m.fact?.type==='decimal'?uiDecimal(m.fact.value):'Unknown', ' · ', m.reason?'Needs review':null)}</AppText>)}</>;})()}
      <Button title="Copy receipt" variant="secondary" onPress={() => { try { if (!selection) throw new Error(); assertActivitySelection(selection, context, target); void Clipboard.setStringAsync(JSON.stringify(current.value, null, 2)).then(() => setCopyStatus('Copied'), () => setCopyStatus('Copy failed')); } catch { setCopyStatus('Source changed'); } }} />
      <AppText variant="small">{uiJoin('Receipt', ': ', 'Private', ' · ', 'Entered facts', ' · ', 'Source')}</AppText>
    </View>}
    {!!copyStatus && current && <AppText variant="small">{uiLabel(copyStatus)}</AppText>}
  </View>;
}
