import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppText, Button, Chip, Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import { DepositSource } from './DepositSource';
import { DepositInputFields, emptyDepositInputs } from './DepositInputFields';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { useStore } from '../../data/store';
import type { RateRow } from '../../types';
import { EVALUATOR_VERSION } from '../../lib/productTermsEngine/types';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { loadExecutableSelections, type ApprovedSelection, type ContractContext } from '../../data/executableContracts/transport';
import { compareDeposits, type DepositComparisonResult } from '../../data/executableContracts/depositComparison';
import type { DepositInputs } from '../../data/executableContracts/instantiate';

const rowId = (row: RateRow) => `${row.rate_index}#${row.product_key}`;
function ComparisonForm({ rows, selections, context }: { rows: RateRow[]; selections: (ApprovedSelection | null)[]; context: ContractContext }) {
  const customer = useCustomerProfile();
  const [inputs, setInputs] = useState<DepositInputs[]>(() => rows.map(emptyDepositInputs));
  const [referenceId, setReferenceId] = useState(rowId(rows[0]));
  const [result, setResult] = useState<{ identity: string; data: DepositComparisonResult } | null>(null);
  const [error, setError] = useState(''), [details, setDetails] = useState(false), [copyStatus, setCopyStatus] = useState('');
  const identity = canonical([inputs, referenceId, customer.profile?.revision ?? null]);
  const current = result?.identity === identity ? result.data : null;
  if (!customer.profile) return <AppText variant="small">{customer.error ?? 'Opening encrypted local inputs...'}</AppText>;
  const shared = (field: 'principal' | 'fundedDate', value: string) => setInputs(old => old.map(input => ({ ...input, [field]: value, confirmed: false, confirmedAt: null })));
  function calculate() {
    setError(''); setCopyStatus('');
    try { setResult({ identity, data: compareDeposits(context, rows.map((row, i) => ({ id: rowId(row), row, selection: selections[i], inputs: inputs[i] })), referenceId, customer.profile!) }); }
    catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Comparison unavailable.'); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="small">Return before tax. Enter bank-confirmed offers for the same amount and funding date. Inputs stay on this device.</AppText>
    <LedgerField label="Comparison amount (AUD)" value={inputs[0].principal} keyboardType="decimal-pad" onChangeText={value => shared('principal', value)} />
    <LedgerField label="Comparison funding date" hint="YYYY-MM-DD" value={inputs[0].fundedDate} onChangeText={value => shared('fundedDate', value)} />
    {rows.map((row, i) => <View key={rowId(row)} style={{ gap: 8 }}>
      <AppText weight="700">{row.provider}: {row.product_name}</AppText>
      <Chip label={`Reference: ${row.product_name} (rate ${row.rate_index})`} selected={referenceId === rowId(row)} onPress={() => setReferenceId(rowId(row))} />
      {selections[i] ? <>
        <AppText variant="small">Approval as of publication {selections[i]!.edition}. This does not confirm a current bank offer.</AppText>
        <DepositInputFields selection={selections[i]!} row={row} inputs={inputs[i]} onChange={value => setInputs(old => old.map((item, j) => j === i ? value : item))} customer={customer} shared />
      </> : <AppText variant="small">An approved calculation template is unavailable for this exact rate. It cannot be ranked.</AppText>}
    </View>)}
    <Button title="Compare maturity returns" disabled={customer.busy} onPress={calculate} />
    {error ? <AppText variant="small">{error}</AppText> : null}
    {current ? <View style={{ gap: 10 }}>
      <AppText variant="small">{current.basis}</AppText><AppText variant="small">{current.reason}</AppText>
      {current.results.map((r, i) => <View key={r.id} style={{ gap: 4 }}>
        <AppText weight="700">{rows[i].provider}: {rows[i].product_name}</AppText>
        {r.data?.receipt.claimAvailable ? <AppText variant="small">Interest before tax: ${r.data.receipt.totals!.interestPosted}. Maturity payout: ${r.data.receipt.totals!.externalOutflows}.</AppText> : <AppText variant="small">{r.error ?? 'Result unavailable: eligibility or material inputs remain unresolved.'}</AppText>}
        {current.rankAvailable ? <AppText variant="small">Rank {r.rank}. Difference from reference: ${r.advantage}.</AppText> : null}
      </View>)}
      <Disclosure title="Comparison details" open={details} onToggle={() => setDetails(!details)}>
        <AppText variant="tiny">Receipt {current.inputSha256}</AppText>
        {current.results.map((r, i) => <View key={r.id} style={{ gap: 4 }}>
          <AppText weight="700">{rows[i].product_name}</AppText>
          <AppText variant="small">Eligibility: {r.data?.receipt.eligibility?.status.replace(/_/g, ' ') ?? 'Not assessed'}</AppText>
          {r.data?.receipt.eligibility?.reasons.map((reason, j) => <AppText key={`reason-${j}`} variant="small">{reason}</AppText>)}
          {r.data?.receipt.issues.map((issue, j) => <AppText key={`issue-${j}`} variant="small">{issue}</AppText>)}
          {r.data?.receipt.totals ? <AppText variant="small">Fees: ${r.data.receipt.totals.feesCharged}. Remaining deposit balance: ${r.data.receipt.totals.closingBalance}.</AppText> : null}
          {selections[i]?.template.evidence.map(source => <DepositSource key={source.id} source={source} />)}
        </View>)}
        <AppText variant="small">The receipt includes entered amounts, rates, dates and relevant eligibility answers.</AppText>
        <Button title="Copy comparison receipt" variant="secondary" onPress={() => void Clipboard.setStringAsync(JSON.stringify(current, null, 2)).then(() => setCopyStatus('Receipt copied.'), () => setCopyStatus('Receipt could not be copied.'))} />
        {copyStatus ? <AppText variant="small">{copyStatus}</AppText> : null}
      </Disclosure>
    </View> : null}
  </View>;
}
export function FixedDepositComparison({ rows }: { rows: RateRow[] }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity);
  const [open, setOpen] = useState(false);
  const identity = hashText(canonical([manifest, rows]));
  const [loaded, setLoaded] = useState<{ identity: string; core: typeof core; integrity: typeof coreIntegrity; selections: (ApprovedSelection | null)[] } | null>(null);
  const selected = loaded?.identity === identity && loaded.core === core && loaded.integrity === coreIntegrity ? loaded : null;
  useEffect(() => {
    if (!open || rows.length < 2 || rows.length > 4) return; let active = true;
    void Promise.all(rows.map(row => loadExecutableSelections({ manifest, core, coreIntegrity }, row).then(list => { const current = list.filter(item => item.template.evaluatorVersion === EVALUATOR_VERSION); return current.length === 1 ? current[0] : null; }, () => null))).then(selections => {
      if (active) setLoaded({ identity, core, integrity: coreIntegrity, selections });
    });
    return () => { active = false; };
  }, [open, identity, manifest, core, coreIntegrity, rows]);
  return <Disclosure title="Personal cost comparison" summary="Check maturity returns" open={open} onToggle={() => setOpen(!open)}>
    <AppText variant="small">Published-rate rankings do not compare your full costs or assess eligibility. This calculation supports approved fixed-deposit maturity returns only.</AppText>
    {selected ? <ComparisonForm key={identity} rows={rows} selections={selected.selections} context={{ manifest, core, coreIntegrity }} /> : <AppText variant="small">Checking reviewed calculation terms...</AppText>}
  </Disclosure>;
}
