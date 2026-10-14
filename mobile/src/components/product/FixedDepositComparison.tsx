import { tdReopenItem, privateTdExport } from '../../data/receiptReplay/tdExport';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppText, Button, Chip, Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import { DepositSource } from './DepositSource';
import { emptyDepositInputs } from './DepositInputFields';
import { DepositCohorts } from './DepositCohorts';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { useStore } from '../../data/store';
import type { RateRow } from '../../types';
import { EVALUATOR_VERSION } from '../../lib/productTermsEngine/types';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { loadExecutableSelections, type ApprovedSelection, type ContractContext } from '../../data/executableContracts/transport';
import { compareDeposits, type DepositComparisonResult } from '../../data/executableContracts/depositComparison';
import type { DepositInputs } from '../../data/executableContracts/instantiate';
import { uiCount, uiDecimal, uiIdentifier, uiInputIdentifier, uiInputNumber, uiJoin, uiLabel, uiProductName, uiProviderName, type UiLabel } from '../../lib/uiCopy';
import { EngineReceiptFacts } from './EngineReceiptFacts';

const rowId = (row: RateRow) => `${row.rate_index}#${row.product_key}`;
function ComparisonForm({ rows, candidates, context }: { rows: RateRow[]; candidates: ApprovedSelection[][]; context: ContractContext }) {
  const [selectedIds, setSelectedIds] = useState<(string | null)[]>(() => candidates.map(list => list.length === 1 ? list[0].template.id : null));
  const selections = candidates.map((list, i) => list.find(item => item.template.id === selectedIds[i]) ?? null);
  const customer = useCustomerProfile();
  const [inputs, setInputs] = useState<DepositInputs[]>(() => rows.map(emptyDepositInputs));
  const [referenceId, setReferenceId] = useState(rowId(rows[0]));
  const [result, setResult] = useState<{ identity: string; data: DepositComparisonResult } | null>(null);
  const [error, setError] = useState(''), [details, setDetails] = useState(false), [copyStatus, setCopyStatus] = useState<UiLabel>('');
  const identity = canonical([inputs, referenceId, customer.profile?.revision ?? null, selectedIds]);
  const current = result?.identity === identity ? result.data : null;
  if (!customer.profile) return <AppText variant="small">{uiLabel(customer.error ? 'Unavailable' : 'Loading')}</AppText>;
  const shared = (field: 'principal' | 'fundedDate', value: string) => setInputs(old => old.map(input => ({ ...input, [field]: value, confirmed: false, confirmedAt: null })));
  function calculate() {
    setError(''); setCopyStatus('');
    try { setResult({ identity, data: compareDeposits(context, rows.map((row, i) => ({ id: rowId(row), row, selection: selections[i], inputs: inputs[i] })), referenceId, customer.profile!) }); }
    catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Comparison unavailable.'); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">{uiJoin('Basis', ' · ', 'Confirmed', ' · ', 'Common amount', ' · ', 'Common funding date', ' · ', 'Tax', ' · ', 'Excluded', ' · ', 'Local storage')}</AppText>
    <LedgerField label="Comparison amount (AUD)" value={uiInputNumber(inputs[0].principal)} keyboardType="decimal-pad" onChangeText={value => shared('principal', value)} />
    <LedgerField label={uiJoin('Comparison funding date', ' · ', 'YYYY-MM-DD')} value={uiInputIdentifier(inputs[0].fundedDate)} onChangeText={value => shared('fundedDate', value)} />
    {rows.map((row, i) => <View key={rowId(row)} style={{ gap: 8 }}>
      <AppText weight="700">{uiJoin(uiProviderName(row), ': ', uiProductName(row))}</AppText>
      <Chip label={uiJoin('Reference', ': ', uiProductName(row), ' · ', 'Rate index', ': ', uiCount(row.rate_index))} selected={referenceId === rowId(row)} onPress={() => setReferenceId(rowId(row))} />
      {candidates[i].length ? <DepositCohorts candidates={candidates[i]} context={context} selectedId={selectedIds[i]} onSelect={id => setSelectedIds(old => old.map((value, j) => j === i ? id : value))} row={row} inputs={inputs[i]} onChange={value => setInputs(old => old.map((item, j) => j === i ? value : item))} customer={customer} shared /> : <AppText variant="small">{uiJoin('Calculation', ' · ', 'Unavailable', ' · ', 'No ranks')}</AppText>}
    </View>)}
    <Button title={uiJoin('Compare', ' ', 'Maturity payout')} disabled={customer.busy} onPress={calculate} />
    {error ? <AppText variant="small">{uiLabel('Unavailable')}</AppText> : null}
    {current ? <View style={{ gap: 10 }}>
      <AppText variant="small">{uiJoin('Ranking', ': ', current.rankAvailable ? 'Available' : 'Unavailable', ' · ', 'Tax', ' · ', 'Excluded')}</AppText>
      {current.results.map((r, i) => <View key={r.id} style={{ gap: 4 }}>
        <AppText weight="700">{uiJoin(uiProviderName(rows[i]), ': ', uiProductName(rows[i]))}</AppText>
        {r.data?.receipt.claimAvailable ? <AppText variant="small">{uiJoin('Interest at maturity', ': ', uiDecimal(r.data.receipt.totals!.interestPosted), ' · ', 'Maturity payout', ': ', uiDecimal(r.data.receipt.totals!.externalOutflows))}</AppText> : <AppText variant="small">{uiJoin('Calculation', ' · ', 'Unavailable')}</AppText>}
        {current.rankAvailable ? <AppText variant="small">{uiJoin('Rank', ': ', uiCount(r.rank), ' · ', 'Advantage', ': ', uiDecimal(r.advantage))}</AppText> : null}
      </View>)}
      <Disclosure title={uiJoin('Comparison', ' · ', 'Details')} open={details} onToggle={() => setDetails(!details)}>
        <AppText variant="tiny">{uiJoin('Receipt', ' · ', uiIdentifier(current.inputSha256))}</AppText>
        {current.results.map((r, i) => <View key={r.id} style={{ gap: 4 }}>
          <AppText weight="700">{uiProductName(rows[i])}</AppText>
          {r.data ? <EngineReceiptFacts receipt={r.data.receipt}/> : <AppText variant="small">{uiLabel('Unavailable')}</AppText>}
          {selections[i]?.template.evidence.map(source => <DepositSource key={source.id} source={source} />)}
        </View>)}
        <AppText variant="small">{uiJoin('Receipt', ' · ', 'Private', ' · ', 'Entered facts', ' · ', 'Criteria')}</AppText>
        <Button title={uiJoin('Copy', ' ', 'Receipt')} variant="secondary" onPress={() => { try { const items=rows.map((row,i)=>{const selection=selections[i];if(!selection)throw Error();return tdReopenItem(selection,context,row,inputs[i],customer.profile!,rowId(row));});void Clipboard.setStringAsync(JSON.stringify(privateTdExport(current,items,true),null,2)).then(()=>setCopyStatus('Copied'),()=>setCopyStatus('Copy failed')); }catch {setCopyStatus('Source changed');} }} />
        {copyStatus ? <AppText variant="small">{uiLabel(copyStatus)}</AppText> : null}
      </Disclosure>
    </View> : null}
  </View>;
}

export function FixedDepositComparison({ rows }: { rows: RateRow[] }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity);
  const [open, setOpen] = useState(false);
  const identity = hashText(canonical([manifest, rows]));
  const [loaded, setLoaded] = useState<{ identity: string; core: typeof core; integrity: typeof coreIntegrity; selections: ApprovedSelection[][] } | null>(null);
  const selected = loaded?.identity === identity && loaded.core === core && loaded.integrity === coreIntegrity ? loaded : null;
  useEffect(() => {
    if (!open || rows.length < 2 || rows.length > 4) return; let active = true;
    void Promise.all(rows.map(row => loadExecutableSelections({ manifest, core, coreIntegrity }, row).then(list => { const current = list.filter(item => item.template.evaluatorVersion === EVALUATOR_VERSION); return current; }, () => []))).then(selections => {
      if (active) setLoaded({ identity, core, integrity: coreIntegrity, selections });
    });
    return () => { active = false; };
  }, [open, identity, manifest, core, coreIntegrity, rows]);
  return <Disclosure title={uiJoin('Compare', ' · ', 'Term deposits')} open={open} onToggle={() => setOpen(!open)}>
    <AppText variant="small">{uiJoin('Basis', ' · ', 'Maturity payout', ' · ', 'No approval')}</AppText>
    {selected ? <ComparisonForm key={identity} rows={rows} candidates={selected.selections} context={{ manifest, core, coreIntegrity }} /> : <AppText variant="small">{uiLabel('Loading')}</AppText>}
  </Disclosure>;
}
