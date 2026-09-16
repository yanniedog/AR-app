import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { RateRow, SectionKey } from '../../types';
import { useStore } from '../../data/store';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { localCustomerDate } from '../../data/customerInputRequirements';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { evaluateEligibility } from '../../lib/productTermsEngine/eligibility';
import { loadEligibilitySelections, type EligibilityContext, type EligibilitySelection, type EligibilityTarget } from '../../data/eligibilityContracts/transport';
import { assertAssessment, evaluateEligibilitySelection, reviewedEligibilityInputs } from '../../data/eligibilityContracts/adapter';
import { eligibilityDefinition, type EligibilityScenario } from '../../data/eligibilityContracts/facts';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { LedgerField } from '../ledger/LedgerField';
import { AppText, Button, Chip, Disclosure } from '../ui';
import { ReviewedCriteria } from './DepositCriteria';
import { EligibilityScenarioFields } from './EligibilityScenarioFields';

function scopeLabel(value: string, part: 'cohort' | 'tier' | 'package') {
  if (value === 'all_source_declared') return part === 'cohort' ? 'All reviewed customers' : `All reviewed ${part}s`;
  if (value === 'none_source_declared') return `No ${part}`;
  return value;
}
function EligibilityForm({ selections, context, target }: { selections: EligibilitySelection[]; context: EligibilityContext; target: EligibilityTarget }) {
  const customer = useCustomerProfile(), [assessmentDate, setAssessmentDate] = useState(localCustomerDate), [valuesById, setValuesById] = useState<Record<string, EligibilityScenario['values']>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null), [copyStatus, setCopyStatus] = useState('');
  const [result, setResult] = useState<{ identity: string; value?: ReturnType<typeof evaluateEligibilitySelection>; error?: string } | null>(null);
  const identity = canonical([assessmentDate, valuesById, selectedId, customer.profile?.revision ?? null]), current = result?.identity === identity ? result : null;
  if (!customer.profile) return <AppText variant="small">{customer.error ?? 'Opening encrypted local inputs...'}</AppText>;
  const assessed = selections.map(selection => {
    const scenario = { assessmentDate, values: valuesById[selection.subject.id] ?? {} };
    try { const requirements = reviewedEligibilityInputs(selection, context, target, scenario, customer.profile!); return { selection, scenario, requirements, evaluation: evaluateEligibility(selection.subject.eligibility, requirements.facts) }; }
    catch (e) { return { selection, scenario, error: e instanceof Error ? e.message : 'Assessment unavailable' }; }
  });
  function assess() {
    setCopyStatus(''); const selected = selections.find(s => s.subject.id === selectedId);
    if (!selected) { setResult({ identity, error: 'Choose the reviewed scope to assess.' }); return; }
    try { setResult({ identity, value: evaluateEligibilitySelection(selected, context, target, { assessmentDate, values: valuesById[selected.subject.id] ?? {} }, customer.profile!) }); }
    catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Assessment unavailable' }); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">Recorded criteria only, not bank approval or a cost calculation. Inputs stay on this device.</AppText>
    <AppText variant="small">Source publication: {context.manifest?.run_date}</AppText>
    <LedgerField label="Assessment date" hint="YYYY-MM-DD" value={assessmentDate} onChangeText={setAssessmentDate} />
    {assessed.filter(item => item.evaluation?.status === 'meets').length > 1 && <AppText variant="small">More than one scope meets the recorded criteria. Choose explicitly; scopes are not combined.</AppText>}
    {assessed.map(({ selection, scenario, requirements, evaluation, error }) => {
      const s = selection.subject;
      const answers = [...(requirements?.needed.filter(d => d.binding === 'customer_fact') ?? []), ...(requirements?.saved ?? [])].filter((d, i, all) => all.findIndex(item => item.key === d.key) === i);
      return <View key={s.id} style={{ gap: 6 }}>
        <Chip label={`Choose ${scopeLabel(s.scope.cohortKey, 'cohort')} / ${scopeLabel(s.scope.tierKey, 'tier')} / ${scopeLabel(s.scope.packageKey, 'package')}`} selected={selectedId === s.id} onPress={() => setSelectedId(s.id)} />
        <AppText variant="small">{evaluation ? `Criteria: ${evaluation.status.replace(/_/g, ' ')}` : error}</AppText>
        <Disclosure title={`Review scope ${scopeLabel(s.scope.cohortKey, 'cohort')}`} open={expanded === s.id} onToggle={() => setExpanded(expanded === s.id ? null : s.id)}>
          <AppText variant="small">Reviewed assessment coverage: {s.scope.effectiveFrom} to {s.scope.effectiveToExclusive} (end excluded). This is not a bank policy expiry date.</AppText>
          <AppText variant="small">{s.scope.family} · {s.scope.coverage === 'product' ? 'Product-wide criteria' : `Rate variants ${s.scope.rateIndexes.join(', ')}`}</AppText>
          <EligibilityScenarioFields definitions={s.inputDefinitions} needed={requirements?.needed??[]} values={scenario.values} onChange={values=>setValuesById(old=>({...old,[s.id]:values}))}/>
          {answers.map(d => { const definition = eligibilityDefinition(s, d.key); return <CustomerAnswerEditor key={definition.id} definition={definition} answer={customer.profile!.answers[definition.id]} productKey={s.scope.productKey} disabled={customer.busy} onSave={answer => void customer.update(p => ({ ...p, definitions: { ...p.definitions, [definition.id]: definition }, answers: { ...p.answers, [definition.id]: answer } }))} />; })}
          {!!requirements?.deferred.length && <AppText variant="small">Unresolved: {requirements.deferred.map(d => d.label).join(', ')}. Saved answers can be changed when available.</AppText>}
          {evaluation && <ReviewedCriteria contract={{ eligibility: s.eligibility, inputDefinitions: s.inputDefinitions, evidence: s.evidence }} trace={evaluation.trace} />}
        </Disclosure>
      </View>;
    })}
    <Button title="Assess selected scope" disabled={customer.busy} onPress={assess} />
    {current?.error && <AppText variant="small">{current.error}</AppText>}
    {current?.value && <View style={{ gap: 8 }}>
      <AppText variant="small">Recorded criteria: {current.value.eligibility.status.replace(/_/g, ' ')}. This is not bank approval.</AppText>
      <AppText variant="small">The receipt includes this scope's entered facts and source references.</AppText>
      <Button title="Copy eligibility receipt" variant="secondary" onPress={() => {
        try { const selected = selections.find(s => s.subject.id === selectedId); if (!selected) throw new Error(); assertAssessment(selected, context, target, { assessmentDate, values: valuesById[selected.subject.id] ?? {} });
          void Clipboard.setStringAsync(JSON.stringify(current.value, null, 2)).then(() => setCopyStatus('Receipt copied.'), () => setCopyStatus('Receipt could not be copied.'));
        } catch { setCopyStatus('This assessment is no longer current. Assess the selected scope again.'); }
      }} />
    </View>}
    {copyStatus && current && <AppText variant="small">{copyStatus}</AppText>}
  </View>;
}
export function EligibilityAssessment({ productKey, row, section }: { productKey: string; row?: RateRow; section?: SectionKey }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity), details = useStore(s => s.details), ensureDetails = useStore(s => s.ensureDetails);
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0);
  const identity = hashText(canonical([manifest, productKey, row ?? null, section ?? null]));
  const [loaded, setLoaded] = useState<{ identity: string; core: typeof core; details: typeof details; integrity: typeof coreIntegrity; selections?: EligibilitySelection[]; target?: EligibilityTarget; error?: string } | null>(null);
  const current = loaded?.identity === identity && loaded.core === core && loaded.details === details && loaded.integrity === coreIntegrity ? loaded : null;
  useEffect(() => {
    if (!open) return; let active = true;
    const detail = details && Object.hasOwn(details.products, productKey) ? details.products[productKey] : null;
    const save = (value: Partial<NonNullable<typeof loaded>>) => { if (active) setLoaded({ identity, core, details, integrity: coreIntegrity, ...value }); };
    if (!detail || row && !section) { save({ error: 'Verified product details are needed for this assessment.' }); return; }
    const target: EligibilityTarget = row && section ? { kind: 'rate_variant', productKey, detail, row, section } : { kind: 'product', productKey, detail };
    void loadEligibilitySelections({ manifest, core, coreIntegrity, details }, target).then(selections => save({ selections, target }), () => save({ error: 'Reviewed criteria could not be verified for this publication.' }));
    return () => { active = false; };
  }, [open, identity, manifest, core, coreIntegrity, details, productKey, row, section, retry]);
  return <Disclosure title="Check recorded eligibility criteria" summary="Reviewed scopes only" open={open} onToggle={() => setOpen(!open)}>
    {!current ? <AppText variant="small">Checking reviewed criteria...</AppText> : current.selections?.length && current.target ? <EligibilityForm key={identity} selections={current.selections} target={current.target} context={{ manifest, core, coreIntegrity, details }} /> : <>
      <AppText variant="small">{current.error ?? 'Reviewed eligibility criteria are unavailable for this product in this publication.'}</AppText>
      <Button title="Retry criteria" variant="secondary" onPress={() => void ensureDetails({ forProductView: true }).catch(() => undefined).finally(() => setRetry(value => value + 1))} />
    </>}
  </Disclosure>;
}
