import React, { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { View } from 'react-native';
import { AppText, Button, Chip, Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { useStore } from '../../data/store';
import type { RateRow } from '../../types';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { loadExecutableSelections, type ApprovedSelection, type ContractContext } from '../../data/executableContracts/transport';
import { calculateDeposit, depositInputRequirements, type DepositInputs } from '../../data/executableContracts/instantiate';

function DepositForm({ selection, context, row }: { selection: ApprovedSelection; context: ContractContext; row: RateRow }) {
  const { profile, busy, error, update } = useCustomerProfile();
  const [inputs, setInputs] = useState<DepositInputs>({ principal: '', fundedDate: '', maturityDate: '', confirmed: false, confirmedAt: null, noWithholdingConfirmed: false });
  const [result, setResult] = useState<{ identity: string; data?: ReturnType<typeof calculateDeposit>; error?: string } | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [trace, setTrace] = useState(false);
  const identity = JSON.stringify([inputs, profile?.revision]);
  const current = result?.identity === identity ? result : null;
  if (!profile) return <AppText variant="small">{error ?? 'Opening encrypted local inputs...'}</AppText>;
  const requirements = depositInputRequirements(selection, inputs, profile);
  function calculate() {
    try { setResult({ identity, data: calculateDeposit(selection, context, row, inputs, profile!) }); }
    catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Calculation unavailable.' }); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">Approval as of publication {selection.edition}. This is not confirmation of a current bank offer.</AppText>
    <AppText variant="small">Return before tax. Amounts and dates stay on this device. Eligibility answers are stored encrypted locally.</AppText>
    <LedgerField label="Deposit amount (AUD)" value={inputs.principal} keyboardType="decimal-pad" onChangeText={principal => setInputs({ ...inputs, principal, confirmed: false })} />
    <LedgerField label="Bank-confirmed funding date" hint="YYYY-MM-DD" value={inputs.fundedDate} onChangeText={fundedDate => setInputs({ ...inputs, fundedDate, confirmed: false })} />
    <LedgerField label="Bank-confirmed maturity date" hint="YYYY-MM-DD" value={inputs.maturityDate} onChangeText={maturityDate => setInputs({ ...inputs, maturityDate, confirmed: false })} />
    <Chip label="Bank agreed this amount and these dates" selected={inputs.confirmed} onPress={() => setInputs({ ...inputs, confirmed: !inputs.confirmed, confirmedAt: !inputs.confirmed ? new Date().toISOString() : null })} />
    <Chip label="No withholding applies to this payout" selected={inputs.noWithholdingConfirmed} onPress={() => setInputs({ ...inputs, noWithholdingConfirmed: !inputs.noWithholdingConfirmed })} />
    {requirements.needed.map(d => <CustomerAnswerEditor key={d.id} definition={d} productKey={row.product_key} answer={profile.answers[d.id]} disabled={busy} onSave={answer => void update(p => ({ ...p, definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }))} />)}
    {!!requirements.deferred.length && <AppText variant="small">Unresolved answers: {requirements.deferred.map(d => d.label).join(', ')}. Change them in saved answers when available.</AppText>}
    <Disclosure title="Saved eligibility answers" open={savedOpen} onToggle={() => setSavedOpen(!savedOpen)}>
      {requirements.saved.map(d => <CustomerAnswerEditor key={d.id} definition={d} productKey={row.product_key} answer={profile.answers[d.id]} disabled={busy} onSave={answer => void update(p => ({ ...p, answers: { ...p.answers, [d.id]: answer } }))} />)}
    </Disclosure>
    {error ? <AppText variant="small">{error}</AppText> : null}
    <Button title="Calculate maturity return" disabled={busy} onPress={calculate} />
    {current?.error ? <AppText variant="small">{current.error}</AppText> : null}
    {current?.data ? <View style={{ gap: 8 }}>
      <AppText variant="small">{current.data.basis}</AppText>
      <AppText variant="small">{current.data.receipt.claimAvailable ? `Interest before tax: $${current.data.receipt.totals?.interestPosted}. Maturity payout: $${current.data.receipt.totals?.externalOutflows}.` : 'Result unavailable: eligibility or material inputs remain unresolved.'}</AppText>
      <AppText variant="small">This separate maturity result is not a full-horizon product ranking.</AppText>
      <Disclosure title="Calculation details" open={trace} onToggle={() => setTrace(!trace)}>
        <AppText variant="tiny">Receipt {current.data.receipt.inputSha256}</AppText>
        <AppText variant="small">Eligibility: {current.data.receipt.eligibility?.status.replace(/_/g, ' ') ?? 'Not assessed'}</AppText>
        {current.data.receipt.eligibility?.reasons.map((reason, i) => <AppText key={`reason-${i}`} variant="small">{reason}</AppText>)}
        {current.data.receipt.issues.map((issue, i) => <AppText key={i} variant="small">{issue}</AppText>)}
        {current.data.receipt.totals ? <View style={{ gap: 4 }}>
          <AppText variant="small">Starting principal: ${current.data.receipt.totals.openingBalance}</AppText>
          <AppText variant="small">Interest paid before tax: ${current.data.receipt.totals.interestPosted}</AppText>
          <AppText variant="small">Fees: ${current.data.receipt.totals.feesCharged}</AppText>
          <AppText variant="small">Remaining deposit balance: ${current.data.receipt.totals.closingBalance}</AppText>
          <AppText variant="small">Interest rounding adjustment: ${current.data.receipt.totals.interestRoundingAdjustment}</AppText>
        </View> : null}
        {selection.template.evidence.map(source => <View key={source.id} style={{ gap: 4 }}>
          <AppText variant="small" weight="700">{source.locator}</AppText>
          <AppText variant="small">{source.quote}</AppText>
          <AppText variant="tiny">{source.sourceUrl}</AppText>
        </View>)}
        <AppText variant="small">The receipt includes your entered amounts, dates and relevant eligibility answers.</AppText>
        <Button title="Copy calculation receipt" variant="secondary" onPress={() => void Clipboard.setStringAsync(JSON.stringify(current.data, null, 2)).then(() => setCopyStatus('Receipt copied.'), () => setCopyStatus('Receipt could not be copied.'))} />
        {copyStatus ? <AppText variant="small">{copyStatus}</AppText> : null}
      </Disclosure>
    </View> : null}
  </View>;
}
export function FixedDepositCalculation({ row }: { row: RateRow }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity);
  const [open, setOpen] = useState(false);
  const edition = manifest ? hashText(canonical(manifest)) : '';
  const identity = `${edition}:${hashText(canonical(row))}`;
  const [loaded, setLoaded] = useState<{ identity: string; selections?: ApprovedSelection[]; error?: string } | null>(null);
  const selected = loaded?.identity === identity ? loaded : null;
  useEffect(() => {
    if (!open) return; let active = true; setLoaded(null);
    void loadExecutableSelections({ manifest, core, coreIntegrity }, row).then(selections => { if (active) setLoaded({ identity, selections }); }, () => { if (active) setLoaded({ identity, error: 'The calculation approval could not be verified for this publication.' }); });
    return () => { active = false; };
  }, [open, identity, manifest, core, coreIntegrity, row]);
  return <Disclosure title="Maturity return before tax" summary="Check calculation availability" open={open} onToggle={() => setOpen(!open)}>
    {!selected ? <AppText variant="small">Checking reviewed calculation terms...</AppText> : selected.selections?.length === 1 ?
      <DepositForm key={identity} selection={selected.selections[0]} context={{ manifest, core, coreIntegrity }} row={row} /> :
      <AppText variant="small">{selected.error ?? 'An unambiguous approved calculation template is unavailable for this exact rate. Early exit, rollover and variable rates are not supported.'}</AppText>}
  </Disclosure>;
}
