import { tdReopenItem, privateTdExport } from '../../data/receiptReplay/tdExport';
import React, { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { View } from 'react-native';
import { AppText, Button, Disclosure } from '../ui';
import { DepositSource } from './DepositSource';
import { emptyDepositInputs } from './DepositInputFields';
import { DepositCohorts } from './DepositCohorts';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { useStore } from '../../data/store';
import type { RateRow } from '../../types';
import { EVALUATOR_VERSION } from '../../lib/productTermsEngine/types';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { loadExecutableSelections, type ApprovedSelection, type ContractContext } from '../../data/executableContracts/transport';
import { calculateDeposit, type DepositInputs } from '../../data/executableContracts/instantiate';

function DepositForm({ candidates, context, row }: { candidates: ApprovedSelection[]; context: ContractContext; row: RateRow }) {
  const [selectedId, setSelectedId] = useState<string | null>(() => candidates.length === 1 ? candidates[0].template.id : null);
  const selection = candidates.find(candidate => candidate.template.id === selectedId);
  const customer = useCustomerProfile();
  const { profile, busy, error } = customer;
  const [inputs, setInputs] = useState<DepositInputs>(emptyDepositInputs);
  const [result, setResult] = useState<{ identity: string; data?: ReturnType<typeof calculateDeposit>; error?: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [trace, setTrace] = useState(false);
  const identity = JSON.stringify([inputs, profile?.revision, selectedId]);
  const current = result?.identity === identity ? result : null;
  if (!profile) return <AppText variant="small">{error ?? 'Opening encrypted local inputs...'}</AppText>;
  function calculate() {
    if (!selection) { setResult({ identity, error: 'Choose the applicable reviewed customer group.' }); return; }
    try { setResult({ identity, data: calculateDeposit(selection, context, row, inputs, profile!) }); }
    catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Calculation unavailable.' }); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">Reviewed source terms apply only within their stated dates. This is not confirmation of a current bank offer.</AppText>
    <AppText variant="small">Return before tax. Amounts and dates stay on this device. Eligibility answers are stored encrypted locally.</AppText>
    <DepositCohorts candidates={candidates} selectedId={selectedId} onSelect={setSelectedId} row={row} inputs={inputs} onChange={setInputs} customer={customer} />
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
        {selection?.template.evidence.map(source => <DepositSource key={source.id} source={source} />)}
        <AppText variant="small">The receipt includes your entered amounts, dates and relevant eligibility answers.</AppText>
        <Button title="Copy calculation receipt" variant="secondary" onPress={() => { try { if (!selection) throw Error(); const exported=privateTdExport(current.data,[tdReopenItem(selection,context,row,inputs,profile)]); void Clipboard.setStringAsync(JSON.stringify(exported,null,2)).then(()=>setCopyStatus('Receipt copied.'),()=>setCopyStatus('Receipt could not be copied.')); } catch { setCopyStatus('Source changed. Calculate again.'); } }} />
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
    void loadExecutableSelections({ manifest, core, coreIntegrity }, row).then(selections => { if (active) setLoaded({ identity, selections: selections.filter(item => item.template.evaluatorVersion === EVALUATOR_VERSION) }); }, () => { if (active) setLoaded({ identity, error: 'The calculation approval could not be verified for this publication.' }); });
    return () => { active = false; };
  }, [open, identity, manifest, core, coreIntegrity, row]);
  return <Disclosure title="Maturity return before tax" summary="Check calculation availability" open={open} onToggle={() => setOpen(!open)}>
    {!selected ? <AppText variant="small">Checking reviewed calculation terms...</AppText> : !!selected.selections?.length ?
      <DepositForm key={identity} candidates={selected.selections} context={{ manifest, core, coreIntegrity }} row={row} /> :
      <AppText variant="small">{selected.error ?? 'An approved calculation template is unavailable for this exact rate. Early exit, rollover and variable rates are not supported.'}</AppText>}
  </Disclosure>;
}
