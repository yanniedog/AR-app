import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { type CustomerProfile, type NegotiatedTerm, userProvenance, validProvenance } from '../data/customerProfile';
import { uiLabel, uiDate, uiIdentifier, uiJoin, uiNegotiatedTermField, useNegotiatedTermDraft } from '../lib/uiCopy';
import { LedgerField } from './ledger/LedgerField';
import { AppText, Button, Disclosure } from './ui';
export function NegotiatedTermsEditor({ profile, productKey, disabled, update }: {
  profile: CustomerProfile; productKey?: string; disabled: boolean; update: (change: (p: CustomerProfile) => CustomerProfile) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false); const termDraft = useNegotiatedTermDraft(), draft = termDraft.values; const [error, setError] = useState<'invalid' | 'unavailable' | null>(null); const pendingId = useRef<string | null>(null);
  const [editing, setEditing] = useState<NegotiatedTerm | null>(null);
  const pending = useRef(false), mounted = useRef(true), generation = useRef(0);
  const [saving, setSaving] = useState(false); const busy = disabled || saving;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const resetDraft = termDraft.reset;
  useEffect(() => { generation.current++; setEditing(null); pendingId.current = null; setError(null); resetDraft(); }, [productKey, resetDraft]);
  const terms = profile.negotiatedTerms.filter(t => !productKey || t.provenance.productKey === productKey);
  function cancel() { setEditing(null); pendingId.current = null; setError(null); termDraft.reset(); }
  function edit(term: NegotiatedTerm) {
    if (busy || pending.current) return;
    if (!termDraft.load(term)) { setError('invalid'); return; }
    pendingId.current = term.id; setEditing(term); setError(null);
  }
  async function save() {
    const target = editing?.provenance.productKey ?? productKey;
    if (busy || pending.current || !target) return;
    const provenance = { ...userProvenance(target), source: 'user_input' as const, productKey: target, effectiveFrom: draft.from || null, effectiveToExclusive: draft.to || null };
    if (!draft.label.trim() || !draft.value.trim() || !draft.unit.trim() || draft.note.length > 2000 || !validProvenance(provenance)) { setError('invalid'); return; }
    pendingId.current ??= `user.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    const term: NegotiatedTerm = { id: pendingId.current, label: draft.label.trim(), value: draft.value.trim(), unit: draft.unit.trim(), note: draft.note, provenance };
    const started = generation.current;
    pending.current = true; setSaving(true); setError(null);
    try {
      const saved = await update(p => ({ ...p, negotiatedTerms: [...p.negotiatedTerms.filter(t => t.id !== term.id), term] }));
      if (mounted.current && generation.current === started) { if (saved) cancel(); else setError('unavailable'); }
    } catch { if (mounted.current && generation.current === started) setError('unavailable'); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  }
  return <Disclosure title="Negotiated terms" open={open} onToggle={() => setOpen(!open)}><View style={{ gap: 12 }}>
    <AppText variant="small" color="textMuted">{uiJoin('User input', ' · ', 'Eligibility unverified', ' · ', 'Fees unverified')}</AppText>
    {terms.map(t => <View key={t.id} style={{ gap: 4 }}>
      <AppText variant="small" weight="600">{uiNegotiatedTermField(t, 'label')}</AppText>
      <AppText variant="small">{uiJoin(uiNegotiatedTermField(t, 'value'), ' ', uiNegotiatedTermField(t, 'unit'))}</AppText>
      <AppText variant="tiny">{uiJoin('Recorded', ' ', uiDate(t.provenance.recordedAt), ' · ', 'Effective from', ' ', uiDate(t.provenance.effectiveFrom), ' · ', 'Effective to', ' ', uiDate(t.provenance.effectiveToExclusive))}</AppText>
      {!productKey ? <AppText variant="tiny">{uiIdentifier(t.provenance.productKey)}</AppText> : null}
      <Button title="Edit" variant="secondary" disabled={busy} onPress={() => edit(t)} />
      <Button title="Remove" variant="ghost" disabled={busy} onPress={() => void update(p => ({ ...p, negotiatedTerms: p.negotiatedTerms.filter(v => v.id !== t.id) }))} />
    </View>)}
    {productKey || editing ? <>
      {([['label', 'Term'], ['value', 'Value'], ['unit', 'Unit'], ['from', 'Effective from'], ['to', 'Effective to']] as const).map(([key, label]) => <LedgerField key={key} label={label} value={draft[key]} editable={!busy} maxLength={key === 'value' ? 2000 : key === 'unit' ? 80 : 160} onChangeText={v => termDraft.change(key, v)} autoCorrect={false} />)}
      <LedgerField label="Note" accessibilityLabel="Note" value={draft.note} editable={!busy} maxLength={2000} multiline onChangeText={v => termDraft.change('note', v)} />
      {editing ? <Button title="Cancel" variant="ghost" disabled={busy} onPress={cancel} /> : null}
      {error ? <AppText variant="small" color="danger">{uiLabel(error === 'invalid' ? 'Invalid value' : 'Unavailable')}</AppText> : null}<Button title="Save" accessibilityLabel={uiJoin('Save', ' ', 'Negotiated terms')} disabled={busy} onPress={save} />
    </> : null}
  </View></Disclosure>;
}
