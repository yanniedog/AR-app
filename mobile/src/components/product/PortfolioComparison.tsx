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

export function HoldingsResultDetails({ result, referenceId }: { result: ComparisonReceipt['results'][number]; referenceId: string }) {
  const [open, setOpen] = useState(false), b = result.breakEven;
  return <Disclosure title={`${result.id} result details`} open={open} onToggle={() => setOpen(!open)}>
    <AppText variant="small">Advantage over {referenceId}: {result.advantage ?? 'unknown'} AUD. Positive means higher wealth or lower cost for the selected metric.</AppText>
    <AppText variant="small">{!b ? 'Break-even unavailable.' : `First positive advantage: ${b.firstPositive ?? 'not reached'}. Sustained positive advantage: ${b.sustainedFrom ?? 'not reached'}${b.through ? ` through ${b.through}` : ''}. ${b.transient ? 'An earlier lead was temporary.' : ''}`}</AppText>
    {!!b?.tiedDates.length && <AppText variant="small">Equal on {b.tiedDates.length} evaluated dates; first equality {b.tiedDates[0]}. Equality is not a positive advantage.</AppText>}
    {Object.entries(result.receipt.accounts).map(([id, account]) => <View key={id}>
      <AppText variant="small">{id}: opening amount {account.totals?.openingBalance ?? 'unknown'} AUD; interest accrued {account.totals?.interestAccrued ?? 'unknown'} AUD; fees {account.totals?.feesCharged ?? 'unknown'} AUD.</AppText>
      {!account.claimAvailable && <AppText variant="small">Known components only; not a complete return or guaranteed bound.</AppText>}
    </View>)}
  </Disclosure>;
}

export function HoldingsForm({ context, options }: { context: SavingsContext; options: HoldingOption[] }) {
  const customer = useCustomerProfile(), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [sets, setSets] = useState<HoldingEditorValue[][]>([[emptyHolding()], [emptyHolding()]]);
  const [referenceId, setReference] = useState('set-1'), [confirmed, setConfirmed] = useState(false);
  const [metric, setMetric] = useState<HoldingsDraft['metric']>('terminal_net_worth');
  const [result, setResult] = useState<{ identity: string; value?: ReturnType<typeof compareSavingsHoldings>; error?: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
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
    <AppText variant="small">Compare two user-reported historical savings holding sets before tax. Equal opening totals and the same period are required. No forecast or bank approval. Draft account inputs stay here until this view closes.</AppText>
    <LedgerField label="Common start" hint="YYYY-MM-DD, included" value={start} onChangeText={s => dates(s, setStart)} />
    <LedgerField label="Common end" hint="YYYY-MM-DD, excluded" value={end} onChangeText={s => dates(s, setEnd)} />
    {sets.map((accounts, n) => <View key={n} style={{ gap: 8 }}><AppText>Holding set {n + 1}</AppText>
      <Chip label={`Reference set ${n + 1}`} selected={referenceId === `set-${n + 1}`} onPress={() => setReference(`set-${n + 1}`)} />
      {accounts.map((a, j) => <View key={j}><PortfolioAccountEditor value={a} options={options} start={start} end={end} onChange={v => { setConfirmed(false); setSets(old => old.map((list, i) => i === n ? list.map((item, k) => k === j ? v : item) : list)); }} />
        {accounts.length > 1 && <Button title={`Remove account ${j + 1} from set ${n + 1}`} onPress={() => { setConfirmed(false); setSets(old => old.map((list, i) => i === n ? list.filter((_, k) => k !== j) : list)); }} />}</View>)}
      {accounts.length < 4 && <Button title={`Add account to set ${n + 1}`} onPress={() => { setConfirmed(false); setSets(old => old.map((list, i) => i === n ? [...list, emptyHolding()] : list)); }} />}
    </View>)}
    <Chip label="Closing wealth" selected={metric === 'terminal_net_worth'} onPress={() => setMetric('terminal_net_worth')} />
    <Chip label="Interest and fee cost" selected={metric === 'net_interest_fee_cost'} onPress={() => setMetric('net_interest_fee_cost')} />
    <Chip label="These selected holdings have no transfers, packages or linked-account effects" selected={confirmed} onPress={() => setConfirmed(!confirmed)} />
    <Button title="Calculate holdings comparison" onPress={() => { setCopyStatus(''); try { setResult({ identity, value: assemble() }); } catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Comparison unavailable' }); } }} />
    {!!current?.error && <AppText>{current.error}</AppText>}
    {current?.value && <><AppText>{current.value.receipt.available ? 'Complete for the selected historical holdings.' : 'Comparison unavailable; all holdings remain unranked.'}</AppText>
      <AppText variant="small">{current.value.receipt.issues.join(', ')}</AppText>
      {current.value.receipt.results.map(r => <View key={r.id}><AppText>{r.id}: {r.receipt.completeness}; closing wealth {r.receipt.closingNetWorth ?? 'unknown'} AUD; cost {r.receipt.netInterestFeeCost ?? 'unknown'} AUD{r.rank === null ? '' : `; rank ${r.rank}`}</AppText><AppText variant="small">{[...r.receipt.issues, ...Object.values(r.receipt.accounts).flatMap(a => a.issues)].join(', ')}</AppText><HoldingsResultDetails result={r} referenceId={current.value!.receipt.referenceId} /></View>)}
      <Button title="Copy holdings receipt" onPress={() => { try { const fresh = assemble(); if (fresh.inputSha256 !== current.value!.inputSha256) throw new Error('Inputs changed. Calculate again.'); void Clipboard.setStringAsync(JSON.stringify(fresh, null, 2)).then(() => setCopyStatus('Copied.'), () => setCopyStatus('Copy failed.')); } catch { setResult({ identity, error: 'Publication or inputs changed. Calculate again.' }); } }} />
    </>}
    {current && !!copyStatus && <AppText variant="small">{copyStatus}</AppText>}
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
      return (await loadSavingsSelections(context, target)).map(selection => ({ selection, target, id: `${row.rate_index}:${selection.subject.id}`, label: `${row.product_name} / ${selection.subject.scope.cohortKey} / ${selection.subject.scope.tierKey} / ${selection.subject.scope.packageKey}` }));
    })).then(options => save(options.flat()), () => save([], 'Reviewed savings policies could not be verified.'));
    return () => { active = false; };
  }, [open, retry, identity, manifest, core, coreIntegrity, details, rows]);
  return <Disclosure title="Compare historical savings holdings" open={open} onToggle={() => setOpen(!open)}>
    {current?.options.length ? <HoldingsForm key={identity} context={current.context} options={current.options} /> : <><AppText>{current?.error ?? (current ? 'Approved holdings are unavailable for this publication.' : 'Checking reviewed savings policies...')}</AppText><Button title="Retry holdings policies" onPress={() => void ensureDetails({ forProductView: true }).catch(() => undefined).finally(() => setRetry(r => r + 1))} /></>}
  </Disclosure>;
}
