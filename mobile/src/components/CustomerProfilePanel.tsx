import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { type AnswerState, type CustomerAnswer, type CustomerProfile, type InputDefinition, userProvenance, validFact } from '../data/customerProfile';
import { customerInputRequirements, localCustomerDate, reviewedCustomerInputContract, type CustomerInputContract } from '../data/customerInputRequirements';
import { useCustomerProfile } from '../hooks/useCustomerProfile';
import { LedgerField } from './ledger/LedgerField';
import { AppText, Button, Chip, Disclosure, Row } from './ui';
import { NegotiatedTermsEditor } from './NegotiatedTermsEditor';

const STATES: [AnswerState, string][] = [['known', 'Entered'], ['unknown', 'Unknown'], ['unavailable', 'Unavailable'], ['not_applicable', 'Not applicable']];
export function CustomerAnswerEditor({ definition: d, answer, productKey, disabled, onSave }: {
  definition: InputDefinition; answer?: CustomerAnswer; productKey?: string; disabled: boolean;
  onSave: (answer: CustomerAnswer) => void;
}) {
  const [state, setState] = useState<AnswerState>(answer?.state ?? 'unknown');
  const [value, setValue] = useState(answer?.state === 'known' ? String(answer.fact.value) : '');
  const [error, setError] = useState('');
  const savedSignature = JSON.stringify(answer ?? null);
  useEffect(() => {
    const saved = JSON.parse(savedSignature) as CustomerAnswer | null;
    setState(saved?.state ?? 'unknown');
    setValue(saved?.state === 'known' ? String(saved.fact.value) : '');
  }, [savedSignature]);
  function save() {
    const provenance = userProvenance(productKey ?? answer?.provenance.productKey ?? null);
    if (state !== 'known') { setError(''); onSave({ state, provenance }); return; }
    const fact = d.type === 'boolean' ? { type: d.type, value: value === 'true' } : d.type === 'decimal'
      ? { type: d.type, value, unit: d.unit! } : { type: d.type, value };
    if ((d.type === 'boolean' && !['true', 'false'].includes(value)) || !validFact(fact) || (d.type === 'text' && !value.trim())) {
      setError('Enter a valid value or select an explicit missing state.'); return;
    }
    setError(''); onSave({ state: 'known', fact, provenance });
  }
  return <View style={{ gap: 8 }}>
    <AppText variant="small" weight="700">{d.label}{d.unit ? ` (${d.unit})` : ''}</AppText>
    <Row gap={6} style={{ flexWrap: 'wrap' }}>{STATES.map(([key, label]) => <Chip key={key} label={label} selected={state === key} onPress={disabled ? undefined : () => setState(key)} />)}</Row>
    {state === 'known' ? d.type === 'boolean'
      ? <Row gap={6}>{[['true', 'Yes'], ['false', 'No']].map(([v, label]) => <Chip key={v} label={label} selected={value === v} onPress={disabled ? undefined : () => setValue(v)} />)}</Row>
      : <LedgerField label={d.label} accessibilityLabel={`Value: ${d.label}`} value={value} onChangeText={setValue} editable={!disabled} autoCorrect={false} keyboardType={d.type === 'decimal' ? 'decimal-pad' : 'default'} hint={d.type === 'date' ? 'YYYY-MM-DD' : undefined} /> : null}
    {answer?.provenance.source === 'legacy_user_input' ? <AppText variant="tiny">Copied from an existing scenario. Original entry date unknown.</AppText> : null}
    {error ? <AppText variant="small">{error}</AppText> : null}
    <Button title={`Save ${d.label}`} variant="secondary" disabled={disabled} onPress={save} />
  </View>;
}

export function CustomerProfileContent({ productKey, contract }: { productKey?: string; contract?: CustomerInputContract | null }) {
  const { profile, busy, error, retry, update } = useCustomerProfile();
  const [reviewSaved, setReviewSaved] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState(localCustomerDate);
  const reviewed = contract === undefined ? reviewedCustomerInputContract(productKey ?? '') : contract;
  const requirements = useMemo(() => profile && productKey
    ? customerInputRequirements(reviewed, profile, productKey, assessmentDate) : null, [profile, productKey, reviewed, assessmentDate]);
  const saveAnswer = (d: InputDefinition, answer: CustomerAnswer) => void update((p: CustomerProfile) => ({ ...p,
    definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }));
  if (!profile) return <View style={{ gap: 8 }}><AppText variant="small">{error ?? 'Opening encrypted inputs…'}</AppText>{error ? <Button title="Retry inputs" onPress={() => void retry()} /> : null}</View>;
  const saved = Object.values(profile.definitions).filter(d => Object.prototype.hasOwnProperty.call(profile.answers, d.id));
  return <View style={{ gap: 16 }}>
    <AppText variant="small">Encrypted on this device. These inputs are not uploaded. Existing calculator scenarios remain separate.</AppText>
    {error ? <AppText variant="small">{error}</AppText> : busy ? <AppText variant="tiny">Saving…</AppText> : null}
    <AppText variant="small">{requirements?.reason ?? 'Open a product to answer its reviewed questions or record negotiated terms.'}</AppText>
    {reviewed ? <LedgerField label="Assessment date" value={assessmentDate} onChangeText={setAssessmentDate} hint="YYYY-MM-DD · choose the calendar day to assess" /> : null}
    {requirements?.needed.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={profile.answers[d.id]} productKey={productKey} disabled={busy} onSave={a => saveAnswer(d, a)} />)}
    {!!requirements?.deferred.length && <AppText variant="small">Unresolved: {requirements.deferred.map(d => d.label).join(', ')}. Review saved inputs to change these answers.</AppText>}
    <Disclosure title="Saved inputs" summary={`${saved.length} entries`} open={reviewSaved} onToggle={() => setReviewSaved(!reviewSaved)}>
      <View style={{ gap: 20 }}>{saved.map(d => <CustomerAnswerEditor key={d.id} definition={d} answer={profile.answers[d.id]} disabled={busy} onSave={a => saveAnswer(d, a)} />)}</View>
    </Disclosure>
    <NegotiatedTermsEditor profile={profile} productKey={productKey} disabled={busy} update={update} />
  </View>;
}
export function CustomerProfilePanel({ productKey }: { productKey?: string }) {
  const [open, setOpen] = useState(false);
  return <Disclosure title="Private customer inputs" summary="Your answers and negotiated terms" open={open} onToggle={() => setOpen(!open)}>
    {Platform.OS === 'web' ? <AppText variant="small">Customer inputs are available only in the installed app.</AppText> : open ? <CustomerProfileContent productKey={productKey} /> : null}
  </Disclosure>;
}
