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
import { uiJoin, uiLabel, type UiLabel } from '../../lib/uiCopy';
import { EngineReceiptFacts } from './EngineReceiptFacts';

function DepositForm({ candidates, context, row }: { candidates: ApprovedSelection[]; context: ContractContext; row: RateRow }) {
  const [selectedId, setSelectedId] = useState<string | null>(() => candidates.length === 1 ? candidates[0].template.id : null);
  const selection = candidates.find(candidate => candidate.template.id === selectedId);
  const customer = useCustomerProfile();
  const { profile, busy, error } = customer;
  const [inputs, setInputs] = useState<DepositInputs>(emptyDepositInputs);
  const [result, setResult] = useState<{ identity: string; data?: ReturnType<typeof calculateDeposit>; error?: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<UiLabel>('');
  const [trace, setTrace] = useState(false);
  const identity = JSON.stringify([inputs, profile?.revision, selectedId]);
  const current = result?.identity === identity ? result : null;
  if (!profile) return <AppText variant="small">{uiLabel(error ? 'Unavailable' : 'Loading')}</AppText>;
  function calculate() {
    if (!selection) { setResult({ identity, error: 'Choose the applicable reviewed customer group.' }); return; }
    try { setResult({ identity, data: calculateDeposit(selection, context, row, inputs, profile!) }); }
    catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Calculation unavailable.' }); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">{uiJoin('Tax', ': ', 'Excluded', ' · ', 'Bank offer', ': ', 'Unverified')}</AppText>
    <AppText variant="small">{uiJoin('Inputs', ': ', 'Local only', ' · ', 'Encrypted')}</AppText>
    <DepositCohorts candidates={candidates} context={context} selectedId={selectedId} onSelect={setSelectedId} row={row} inputs={inputs} onChange={setInputs} customer={customer} />
    <Button title="Calculate" disabled={busy} onPress={calculate} />
    {current?.error ? <AppText variant="small">{uiLabel("Unavailable")}</AppText> : null}
    {current?.data ? <View style={{ gap: 8 }}>
      <AppText variant="small">{uiJoin('Basis', ': ', 'Maturity return', ' · ', 'Ranking', ': ', 'Not assessed')}</AppText>
      <EngineReceiptFacts receipt={current.data.receipt} />
      <Disclosure title="Calculation" open={trace} onToggle={() => setTrace(!trace)}>
        {selection?.template.evidence.map(source => <DepositSource key={source.id} source={source} />)}
        <AppText variant="small">{uiJoin('Receipt', ': ', 'Private', ' · ', 'Entered facts', ' · ', 'Source')}</AppText>
        <Button title="Copy receipt" variant="secondary" onPress={() => { try { if (!selection) throw Error(); const exported=privateTdExport(current.data,[tdReopenItem(selection,context,row,inputs,profile)]); void Clipboard.setStringAsync(JSON.stringify(exported,null,2)).then(()=>setCopyStatus('Copied'),()=>setCopyStatus('Copy failed')); } catch { setCopyStatus('Source changed'); } }} />
        {copyStatus ? <AppText variant="small">{uiLabel(copyStatus)}</AppText> : null}
      </Disclosure>
    </View> : null}
  </View>;
}
export function FixedDepositCalculation({ row }: { row: RateRow }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity);
  const [open, setOpen] = useState(false);
  const edition = open && manifest ? hashText(canonical(manifest)) : '';
  const identity = open ? `${edition}:${hashText(canonical(row))}` : '';
  const [loaded, setLoaded] = useState<{ identity: string; selections?: ApprovedSelection[]; error?: string } | null>(null);
  const selected = loaded?.identity === identity ? loaded : null;
  useEffect(() => {
    if (!open) return; let active = true; setLoaded(null);
    void loadExecutableSelections({ manifest, core, coreIntegrity }, row).then(selections => { if (active) setLoaded({ identity, selections: selections.filter(item => item.template.evaluatorVersion === EVALUATOR_VERSION) }); }, () => { if (active) setLoaded({ identity, error: 'The calculation approval could not be verified for this publication.' }); });
    return () => { active = false; };
  }, [open, identity, manifest, core, coreIntegrity, row]);
  return <Disclosure title="Maturity return" open={open} onToggle={() => setOpen(!open)}>
    {!selected ? <AppText variant="small">{uiLabel("Checking")}</AppText> : !!selected.selections?.length ?
      <DepositForm key={identity} candidates={selected.selections} context={{ manifest, core, coreIntegrity }} row={row} /> :
      <AppText variant="small">{uiLabel(selected.error ? 'Source unverified' : 'Unavailable')}</AppText>}
  </Disclosure>;
}
