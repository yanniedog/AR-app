import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { type AnswerState, type CustomerAnswer, type CustomerProfile, type InputDefinition, userProvenance, validFact } from '../data/customerProfile';
import { customerInputRequirements, localCustomerDate, type CustomerInputContract } from '../data/customerInputRequirements';
import { useCustomerProfile } from '../hooks/useCustomerProfile';
import { uiLabel, uiCount, uiDate, uiIdentifier, uiInputIdentifier, uiJoin, uiCustomerAnswer, uiInputDefinitionLabel, useCustomerAnswerInput, type UiLabel } from '../lib/uiCopy';
import { LedgerField } from './ledger/LedgerField';
import { AppText, Button, Chip, Disclosure, Row } from './ui';
import { NegotiatedTermsEditor } from './NegotiatedTermsEditor';
import { bindCustomerQuestion, type CustomerQuestionSource } from '../lib/customerQuestionBinding';
const STATES: readonly (readonly [AnswerState, UiLabel])[] = [['known', 'Entered'], ['unknown', 'Unknown'], ['unavailable', 'Unavailable'], ['not_applicable', 'Not applicable']];
export function CustomerAnswerEditor({ definition: d, answer, productKey, disabled, onSave, questionSource }: {
  definition: InputDefinition; answer?: CustomerAnswer; productKey?: string; disabled: boolean; onSave: (answer: CustomerAnswer) => void; questionSource?: CustomerQuestionSource;
}) {
  const [state, setState] = useState<AnswerState>(answer?.state ?? 'unknown');
  const input = useCustomerAnswerInput(answer, d), value = input.value, setValue = input.onChangeText;
  const [error, setError] = useState(false); const savedSignature = JSON.stringify(answer ?? null);
  useEffect(() => { const saved = JSON.parse(savedSignature) as CustomerAnswer | null; setState(saved?.state ?? 'unknown'); }, [savedSignature]);
  function save() {
    const provenance = userProvenance(productKey ?? answer?.provenance.productKey ?? null);
    if (state !== 'known') { setError(false); onSave({ state, provenance }); return; }
    const fact = d.type === 'boolean' ? { type: d.type, value: value === 'true' } : d.type === 'decimal' ? { type: d.type, value, unit: d.unit! } : { type: d.type, value };
    if ((d.type === 'boolean' && !['true', 'false'].includes(value)) || !validFact(fact) || (d.type === 'text' && !value.trim())) { setError(true); return; }
    setError(false); onSave({ state: 'known', fact, provenance });
  }
  const question = useMemo(() => questionSource ? bindCustomerQuestion(d, questionSource) : undefined, [d, questionSource]);
  const reviewedLabel = uiInputDefinitionLabel(d, question);
  const label = reviewedLabel === 'Source review required' ? uiJoin(reviewedLabel, ' · ', uiIdentifier(d.id)) : reviewedLabel;
  return <View style={{ gap: 8 }}>
    <AppText variant="small" weight="700">{label}</AppText>
    {answer ? <AppText variant="small" color="textMuted">{uiCustomerAnswer(answer, d)}</AppText> : null}
    <Row gap={6} style={{ flexWrap: 'wrap' }}>{STATES.map(([key, text]) => <Chip key={key} label={text} selected={state === key} onPress={disabled ? undefined : () => setState(key)} />)}</Row>
    {state === 'known' ? d.type === 'boolean' ? <Row gap={6}>{([['true', 'Yes'], ['false', 'No']] as const).map(([v, text]) => <Chip key={v} label={text} selected={value === v} onPress={disabled ? undefined : () => setValue(v)} />)}</Row>
      : <LedgerField label={label} accessibilityLabel={label} value={value} onChangeText={setValue} editable={!disabled} autoCorrect={false} keyboardType={d.type === 'decimal' ? 'decimal-pad' : 'default'} /> : null}
    {answer ? <AppText variant="tiny" color="textMuted">{uiJoin(answer.provenance.source === 'legacy_user_input' ? 'Legacy input' : 'User input', ' · ', 'Recorded', ' ', uiDate(answer.provenance.recordedAt))}</AppText> : null}
    {error ? <AppText variant="small" color="danger">{uiLabel("Invalid value")}</AppText> : null}
    <Button title="Save" accessibilityLabel={uiJoin('Save', ' ', label)} variant="secondary" disabled={disabled} onPress={save} />
  </View>;
}
export function CustomerProfileContent({ productKey, contract }: { productKey?: string; contract?: CustomerInputContract | null }) {
  const { profile, busy, error, retry, update } = useCustomerProfile(); const [reviewSaved, setReviewSaved] = useState(false); const [assessmentDate, setAssessmentDate] = useState(localCustomerDate); const reviewed = contract ?? null;
  const requirements = useMemo(() => profile && productKey ? customerInputRequirements(reviewed, profile, productKey, assessmentDate) : null, [profile, productKey, reviewed, assessmentDate]);
  const saveAnswer = (d: InputDefinition, answer: CustomerAnswer) => void update((p: CustomerProfile) => ({ ...p, definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }));
  if (!profile) return <View style={{ gap: 8 }}><AppText variant="small">{uiLabel(error ? 'Unavailable' : 'Loading')}</AppText>{error ? <Button title="Retry" onPress={() => void retry()} /> : null}</View>;
  const saved = Object.values(profile.definitions).filter(d => Object.prototype.hasOwnProperty.call(profile.answers, d.id));
  return <View style={{ gap: 16 }}>
    <AppText variant="small" color="textMuted">{uiJoin('Encrypted', ' · ', 'This device', ' · ', 'No upload')}</AppText>
    {error ? <AppText variant="small" color="danger">{uiLabel("Unavailable")}</AppText> : busy ? <AppText variant="tiny">{uiLabel("Saving")}</AppText> : null}
    <AppText variant="small">{uiLabel(requirements?.status === 'needs_inputs' ? 'Inputs incomplete' : 'Eligibility unverified')}</AppText>
    {reviewed ? <LedgerField label="Assessment date" value={uiInputIdentifier(assessmentDate)} onChangeText={setAssessmentDate} /> : null}
    {requirements?.needed.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={profile.answers[d.id]} productKey={productKey} disabled={busy} onSave={a => saveAnswer(d, a)} />)}
    {requirements?.deferred.length ? <AppText variant="small">{uiJoin('Unresolved inputs', ': ', uiCount(requirements.deferred.length))}</AppText> : null}
    <Disclosure title={uiJoin('Saved inputs', ' (', uiCount(saved.length), ')')} open={reviewSaved} onToggle={() => setReviewSaved(!reviewSaved)}>
      <View style={{ gap: 20 }}>{saved.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={profile.answers[d.id]} disabled={busy} onSave={a => saveAnswer(d, a)} />)}</View>
    </Disclosure>
    <NegotiatedTermsEditor profile={profile} productKey={productKey} disabled={busy} update={update} />
  </View>;
}
export function CustomerProfilePanel({ productKey }: { productKey?: string }) {
  const [open, setOpen] = useState(false);
  return <Disclosure title="Private customer inputs" open={open} onToggle={() => setOpen(!open)}>
    {Platform.OS === 'web' ? <AppText variant="small">{uiLabel("Unavailable")}</AppText> : open ? <CustomerProfileContent productKey={productKey} /> : null}
  </Disclosure>;
}
