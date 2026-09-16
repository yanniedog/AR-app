import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { type CustomerProfile, type NegotiatedTerm, userProvenance, validProvenance } from '../data/customerProfile';
import { LedgerField } from './ledger/LedgerField';
import { AppText, Button, Disclosure } from './ui';

export function NegotiatedTermsEditor({ profile, productKey, disabled, update }: {
  profile: CustomerProfile; productKey?: string; disabled: boolean;
  update: (change: (p: CustomerProfile) => CustomerProfile) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ label: '', value: '', unit: '', note: '', from: '', to: '' });
  const [error, setError] = useState('');
  const pendingId = useRef<string | null>(null);
  const terms = profile.negotiatedTerms.filter(t => !productKey || t.provenance.productKey === productKey);
  function save() {
    if (!productKey) return;
    const provenance = { ...userProvenance(productKey), source: 'user_input' as const, productKey, effectiveFrom: draft.from || null, effectiveToExclusive: draft.to || null };
    if (!draft.label.trim() || !draft.value.trim() || !draft.unit.trim() || !validProvenance(provenance)) {
      setError('Enter a term, value and unit. Dates must be YYYY-MM-DD with the end after the start.'); return;
    }
    pendingId.current ??= `user.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    const term: NegotiatedTerm = { id: pendingId.current, label: draft.label.trim(), value: draft.value.trim(), unit: draft.unit.trim(), note: draft.note, provenance };
    setError('');
    void update(p => ({ ...p, negotiatedTerms: [...p.negotiatedTerms.filter(t => t.id !== term.id), term] })).then(saved => {
      if (saved) { pendingId.current = null; setDraft({ label: '', value: '', unit: '', note: '', from: '', to: '' }); }
    });
  }
  return <Disclosure title="Negotiated terms" summary={`${terms.length} user entries`} open={open} onToggle={() => setOpen(!open)}>
    <View style={{ gap: 12 }}>
      <AppText variant="small">Your entries, not published bank terms. They do not establish eligibility or complete costs. Unknown effective dates remain unknown.</AppText>
      {terms.map(t => <View key={t.id} style={{ gap: 4 }}>
        <AppText variant="small" weight="700">{t.label}: {t.value} {t.unit}</AppText>
        <AppText variant="tiny">User input · {t.provenance.recordedAt} · {t.provenance.effectiveFrom ?? 'Start unknown'} to {t.provenance.effectiveToExclusive ?? 'End unknown'} (exclusive)</AppText>
        {!productKey ? <AppText variant="tiny">Product: {t.provenance.productKey}</AppText> : null}
        {t.note ? <AppText variant="small">{t.note}</AppText> : null}
        <Button title={`Remove ${t.label}`} variant="ghost" disabled={disabled} onPress={() => void update(p => ({ ...p, negotiatedTerms: p.negotiatedTerms.filter(v => v.id !== t.id) }))} />
      </View>)}
      {productKey ? <>
        {([['label', 'Term'], ['value', 'Value'], ['unit', 'Unit'], ['from', 'Effective from (optional)'], ['to', 'Effective until, exclusive (optional)'], ['note', 'Source or agreement note (optional)']] as const).map(([key, label]) =>
          <LedgerField key={key} label={label} value={draft[key]} editable={!disabled} maxLength={key === 'value' || key === 'note' ? 2000 : key === 'unit' ? 80 : 160} onChangeText={v => setDraft(p => ({ ...p, [key]: v }))} autoCorrect={false} />)}
        {error ? <AppText variant="small">{error}</AppText> : null}
        <Button title="Save negotiated term" disabled={disabled} onPress={save} />
      </> : <AppText variant="small">Add terms from the relevant product page.</AppText>}
    </View>
  </Disclosure>;
}
