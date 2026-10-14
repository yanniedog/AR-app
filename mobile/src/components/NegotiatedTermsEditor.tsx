import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { type CustomerProfile, type NegotiatedTerm, userProvenance, validProvenance } from '../data/customerProfile';
import { uiLabel, uiDate, uiIdentifier, uiJoin, uiNegotiatedTermField, useNegotiatedTermDraft } from '../lib/uiCopy';
import { LedgerField } from './ledger/LedgerField';
import { AppText, Button, Disclosure } from './ui';
export function NegotiatedTermsEditor({ profile, productKey, disabled, update }: {
  profile: CustomerProfile; productKey?: string; disabled: boolean; update: (change: (p: CustomerProfile) => CustomerProfile) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false); const termDraft = useNegotiatedTermDraft(), draft = termDraft.values; const [error, setError] = useState(false); const pendingId = useRef<string | null>(null);
  const terms = profile.negotiatedTerms.filter(t => !productKey || t.provenance.productKey === productKey);
  function save() {
    if (!productKey) return;
    const provenance = { ...userProvenance(productKey), source: 'user_input' as const, productKey, effectiveFrom: draft.from || null, effectiveToExclusive: draft.to || null };
    if (!draft.label.trim() || !draft.value.trim() || !draft.unit.trim() || !validProvenance(provenance)) { setError(true); return; }
    pendingId.current ??= `user.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    const term: NegotiatedTerm = { id: pendingId.current, label: draft.label.trim(), value: draft.value.trim(), unit: draft.unit.trim(), note: '', provenance };
    setError(false); void update(p => ({ ...p, negotiatedTerms: [...p.negotiatedTerms.filter(t => t.id !== term.id), term] })).then(saved => { if (saved) { pendingId.current = null; termDraft.reset(); } });
  }
  return <Disclosure title="Negotiated terms" open={open} onToggle={() => setOpen(!open)}><View style={{ gap: 12 }}>
    <AppText variant="small" color="textMuted">{uiJoin('User input', ' · ', 'Eligibility unverified', ' · ', 'Fees unverified')}</AppText>
    {terms.map(t => <View key={t.id} style={{ gap: 4 }}>
      <AppText variant="small" weight="600">{uiNegotiatedTermField(t, 'label')}</AppText>
      <AppText variant="small">{uiJoin(uiNegotiatedTermField(t, 'value'), ' ', uiNegotiatedTermField(t, 'unit'))}</AppText>
      <AppText variant="tiny">{uiJoin('Recorded', ' ', uiDate(t.provenance.recordedAt), ' · ', 'Effective from', ' ', uiDate(t.provenance.effectiveFrom), ' · ', 'Effective to', ' ', uiDate(t.provenance.effectiveToExclusive))}</AppText>
      {!productKey ? <AppText variant="tiny">{uiIdentifier(t.provenance.productKey)}</AppText> : null}
      <Button title="Remove" variant="ghost" disabled={disabled} onPress={() => void update(p => ({ ...p, negotiatedTerms: p.negotiatedTerms.filter(v => v.id !== t.id) }))} />
    </View>)}
    {productKey ? <>
      {([['label', 'Term'], ['value', 'Value'], ['unit', 'Unit'], ['from', 'Effective from'], ['to', 'Effective to']] as const).map(([key, label]) => <LedgerField key={key} label={label} value={draft[key]} editable={!disabled} maxLength={key === 'value' ? 2000 : key === 'unit' ? 80 : 160} onChangeText={v => termDraft.change(key, v)} autoCorrect={false} />)}
      {error ? <AppText variant="small" color="danger">{uiLabel("Invalid value")}</AppText> : null}<Button title="Save" accessibilityLabel={uiJoin('Save', ' ', 'Negotiated terms')} disabled={disabled} onPress={save} />
    </> : null}
  </View></Disclosure>;
}
