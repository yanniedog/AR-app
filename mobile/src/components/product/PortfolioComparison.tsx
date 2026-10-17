import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppText, Button, Chip, Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import { useStore } from '../../data/store';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import type { RateRow, SectionKey } from '../../types';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { loadSavingsSelections, type SavingsContext, type SavingsTarget } from '../../data/monetaryContracts/transport';
import { compareSavingsHoldings, type HoldingsDraft } from '../../data/portfolioContracts/adapter';
import { emptyHolding, holdingInput, PortfolioAccountEditor, type HoldingOption, type HoldingEditorValue } from './PortfolioAccountEditor';
import type { ComparisonReceipt } from '../../lib/productTermsEngine/portfolioTypes';
import { uiCount, uiDate, uiDecimal, uiIdentifier, uiInputIdentifier, uiJoin, uiLabel, uiProductName, type UiLabel } from '../../lib/uiCopy';
import { EngineReceiptFacts, uiEngineStatus } from './EngineReceiptFacts';
import { uiEngineScope } from './engineComparisonUi';

const COMPARISON_ISSUE_CODES = new Set([
  'comparison_alternatives_invalid', 'comparison_input_limit', 'comparison_reference_missing',
  'comparison_frame_mismatch', 'comparison_material_inputs_incomplete',
  'comparison_conditional_not_permitted', 'comparison_daily_frame_incomplete',
  'comparison_input_invalid', 'evaluation_output_budget_exceeded',
]);

export function HoldingsResultDetails({ result, referenceId }: { result: ComparisonReceipt['results'][number]; referenceId: string }) {
  const [open, setOpen] = useState(false), b = result.breakEven;
  return <Disclosure title={uiJoin(uiIdentifier(result.id), ' · ', 'Results')} open={open} onToggle={() => setOpen(!open)}>
    <AppText variant="small">{uiJoin('Advantage', ': ', uiDecimal(result.advantage), ' · ', 'Reference', ': ', uiIdentifier(referenceId))}</AppText>
    {!b ? <AppText variant="small">{uiJoin('Break-even', ' · ', 'Unavailable')}</AppText> : <>
      <AppText variant="small">{uiJoin('First positive advantage', ': ', b.firstPositive ? uiDate(b.firstPositive) : uiLabel('Not reached'))}</AppText>
      <AppText variant="small">{uiJoin('Sustained positive advantage', ': ', b.sustainedFrom ? uiDate(b.sustainedFrom) : uiLabel('Not reached'), ' · ', 'Through', ': ', uiDate(b.through))}</AppText>
      <AppText variant="small">{uiJoin('Temporary lead', ': ', b.transient ? 'Yes' : 'No', ' · ', 'Tied dates', ': ', uiCount(b.tiedDates.length))}</AppText>
      {!!b.tiedDates.length && <AppText variant="small">{uiJoin('First equality', ': ', uiDate(b.tiedDates[0]))}</AppText>}
    </>}
    {Object.entries(result.receipt.accounts).map(([id, account]) => <View key={id}>
      <AppText variant="small">{uiJoin('Account', ': ', uiIdentifier(id))}</AppText>
      {!account.claimAvailable && <AppText variant="small">{uiLabel('Known components')}</AppText>}
      <EngineReceiptFacts receipt={account}/>
    </View>)}
  </Disclosure>;
}

export function HoldingsForm({ context, options }: { context: SavingsContext; options: HoldingOption[] }) {
  const customer = useCustomerProfile(), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [sets, setSets] = useState<HoldingEditorValue[][]>([[emptyHolding()], [emptyHolding()]]);
  const [referenceId, setReference] = useState('set-1'), [confirmed, setConfirmed] = useState(false);
  const [metric, setMetric] = useState<HoldingsDraft['metric']>('terminal_net_worth');
  const [result, setResult] = useState<{ identity: string; value?: ReturnType<typeof compareSavingsHoldings>; error?: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<UiLabel>('');
  const identity = canonical([start, end, sets, referenceId, confirmed, metric, customer.profile?.revision, context.manifest]);
  const current = result?.identity === identity ? result : null;
  function assemble() {
    if (!customer.profile) throw new Error('Local customer inputs are unavailable.');
    const alternatives = sets.map((accounts, n) => ({ id: `set-${n + 1}`, accounts: accounts.map(a => { const option = options.find(o => o.id === a.optionId); if (!option) throw new Error('Choose a reviewed scope for every account.'); return holdingInput(a, option, start, end); }) }));
    const timezone = alternatives[0].accounts[0].selection.subject.authorityGraph.completedPeriod.timezone;
    return compareSavingsHoldings(context, customer.profile, { startDate: start, endDateExclusive: end, timezone, referenceId, metric, independentHoldingsConfirmed: confirmed, alternatives });
  }
  function dates(value: string, setter: (s: string) => void) { setter(value); setSets(old => old.map(a => a.map(v => ({ ...v, confirmedAt: null })))); setConfirmed(false); }
  return <View style={{ gap: 10 }}>
    <AppText variant="small">{uiJoin('Basis', ' · ', 'History', ' · ', 'Equal opening totals', ' · ', 'Common period', ' · ', 'Tax', ' · ', 'Excluded', ' · ', 'No forecast', ' · ', 'No approval')}</AppText>
    <LedgerField label={uiJoin('Common start', ' · ', 'Included')} accessibilityLabel={uiJoin('Common start', ' · ', 'Included', ' · ', 'YYYY-MM-DD')} placeholder="YYYY-MM-DD" value={uiInputIdentifier(start)} onChangeText={s => dates(s, setStart)} />
    <LedgerField label={uiJoin('Common end', ' · ', 'Excluded')} accessibilityLabel={uiJoin('Common end', ' · ', 'Excluded', ' · ', 'YYYY-MM-DD')} placeholder="YYYY-MM-DD" value={uiInputIdentifier(end)} onChangeText={s => dates(s, setEnd)} />
    {sets.map((accounts, n) => <View key={n} style={{ gap: 8 }}><AppText>{uiJoin('Holding set', ' ', uiCount(n + 1))}</AppText>
      <Chip label={uiJoin('Reference', ' ', uiCount(n + 1))} selected={referenceId === 'set-'+(n + 1)} onPress={() => setReference('set-'+(n + 1))} />
      {accounts.map((a, j) => <View key={j}><PortfolioAccountEditor value={a} options={options} context={context} start={start} end={end} onChange={v => { setConfirmed(false); setSets(old => old.map((list, i) => i === n ? list.map((item, k) => k === j ? v : item) : list)); }} />
        {accounts.length > 1 && <Button title={uiJoin('Remove', ' ', 'Account', ' ', uiCount(j + 1), ' · ', 'Holding set', ' ', uiCount(n + 1))} onPress={() => { setConfirmed(false); setSets(old => old.map((list, i) => i === n ? list.filter((_, k) => k !== j) : list)); }} />}</View>)}
      {accounts.length < 4 && <Button title={uiJoin('Add', ' ', 'Account', ' · ', 'Holding set', ' ', uiCount(n + 1))} onPress={() => { setConfirmed(false); setSets(old => old.map((list, i) => i === n ? [...list, emptyHolding()] : list)); }} />}
    </View>)}
    <Chip label="Closing wealth" selected={metric === 'terminal_net_worth'} onPress={() => setMetric('terminal_net_worth')} />
    <Chip label="Interest and fee cost" selected={metric === 'net_interest_fee_cost'} onPress={() => setMetric('net_interest_fee_cost')} />
    <Chip label="No linked effects" selected={confirmed} onPress={() => setConfirmed(!confirmed)} />
    <AppText variant="small">{uiJoin('Excluded', ' · ', 'Transfers', ' / ', 'Package', ' / ', 'Linked accounts')}</AppText>
    <Button title={uiJoin('Calculate', ' ', 'Holding set')} onPress={() => { setCopyStatus(''); try { setResult({ identity, value: assemble() }); } catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Comparison unavailable' }); } }} />
    {!!current?.error && <AppText>{uiLabel('Unavailable')}</AppText>}
    {current?.value && <><AppText>{uiJoin('Status', ': ', uiLabel(current.value.receipt.available ? 'Complete' : 'Unavailable'), ' · ', 'Issues', ': ', uiCount(current.value.receipt.issues.length))}</AppText>
      {current.value.receipt.issues.map((code, index) => <AppText key={`comparison-issue-${index}`} variant="small">{uiJoin('Issue code', ': ', COMPARISON_ISSUE_CODES.has(code) ? uiIdentifier(code) : uiLabel('Source review required'))}</AppText>)}
      {current.value.receipt.results.map(r => <View key={r.id}><AppText>{uiJoin(uiIdentifier(r.id), ' · ', uiEngineStatus(r.receipt.completeness), ' · ', 'Closing wealth', ': ', uiDecimal(r.receipt.closingNetWorth), ' · ', 'Interest and fee cost', ': ', uiDecimal(r.receipt.netInterestFeeCost), ' · ', 'Rank', ': ', uiCount(r.rank))}</AppText><AppText variant="small">{uiJoin('Issues', ': ', uiCount(r.receipt.issues.length + Object.values(r.receipt.accounts).reduce((n,a)=>n+a.issues.length,0)))}</AppText><HoldingsResultDetails result={r} referenceId={current.value!.receipt.referenceId} /></View>)}
      <Button title={uiJoin('Copy', ' ', 'Receipt')} onPress={() => { try { const fresh = assemble(); if (fresh.inputSha256 !== current.value!.inputSha256) throw new Error('Inputs changed. Calculate again.'); void Clipboard.setStringAsync(JSON.stringify(fresh, null, 2)).then(() => setCopyStatus('Copied'), () => setCopyStatus('Copy failed')); } catch { setResult({ identity, error: 'Publication or inputs changed. Calculate again.' }); } }} />
    </>}
    {current && !!copyStatus && <AppText variant="small">{uiLabel(copyStatus)}</AppText>}
  </View>;
}

export function PortfolioComparison({ rows }: { rows: { row: RateRow; section: SectionKey }[] }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity), details = useStore(s => s.details), ensureDetails = useStore(s => s.ensureDetails);
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0);
  const identity = hashText(canonical([manifest, rows]));
  const [loaded, setLoaded] = useState<{ identity: string; context: SavingsContext; options: HoldingOption[]; error?: string } | null>(null);
  const current = loaded?.identity === identity && loaded.context.core === core && loaded.context.coreIntegrity === coreIntegrity && loaded.context.details === details ? loaded : null;
  useEffect(() => {
    if (!open) return; let active = true;
    const context = { manifest, core, coreIntegrity, details };
    const save = (options: HoldingOption[], error?: string) => { if (active) setLoaded({ identity, context, options, error }); };
    if (!rows.length || rows.some(r => r.section !== 'Savings') || !details) { save([], 'Choose savings rows with verified details. Other families are not supported here.'); return; }
    void Promise.all(rows.map(async ({ row }) => {
      const detail = details.products[row.product_key]; if (!detail) throw new Error('Missing details');
      const target: SavingsTarget = { kind: 'rate_variant', section: 'Savings', row, productKey: row.product_key, detail };
      return (await loadSavingsSelections(context, target)).map(selection => ({ selection, target, id: `${row.rate_index}:${selection.subject.id}`, label: uiJoin(uiProductName(row), ' / ', uiEngineScope(selection.subject.scope.cohortKey), ' / ', uiEngineScope(selection.subject.scope.tierKey), ' / ', uiEngineScope(selection.subject.scope.packageKey)) }));
    })).then(options => save(options.flat()), () => save([], 'Reviewed savings policies could not be verified.'));
    return () => { active = false; };
  }, [open, retry, identity, manifest, core, coreIntegrity, details, rows]);
  return <Disclosure title={uiJoin('Compare', ' · ', 'Savings', ' · ', 'History')} open={open} onToggle={() => setOpen(!open)}>
    {current?.options.length ? <HoldingsForm key={identity} context={current.context} options={current.options} /> : <><AppText>{uiLabel(current?.error || current ? 'Unavailable' : 'Loading')}</AppText><Button title="Retry" onPress={() => void ensureDetails({ forProductView: true }).catch(() => undefined).finally(() => setRetry(r => r + 1))} /></>}
  </Disclosure>;
}
