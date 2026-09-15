import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../../data/store';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import type { RateRow, SectionKey } from '../../types';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { loadMortgageSelections, assertMortgageSelection, type MortgageContext, type MortgageSelection, type MortgageTarget } from '../../data/mortgageContracts/transport';
import { compareMortgagePeriods, type MortgageComparisonDraft } from '../../data/portfolioContracts/mortgageAdapter';
import { MortgagePeriodForm, MortgageResultDetails, type MortgageFormInput } from './MortgagePeriodForm';
import { HoldingsResultDetails } from './PortfolioComparison';
import { AppText, Button, Chip, Disclosure } from '../ui';

export interface MortgageComparisonOption { target: MortgageTarget; selections: MortgageSelection[]; label: string }
export function MortgageComparisonForm({ context, options }: { context: MortgageContext; options: MortgageComparisonOption[] }) {
  const customer = useCustomerProfile(), [inputs, setInputs] = useState<(MortgageFormInput | null)[]>([null, null]);
  const [confirmed, setConfirmed] = useState(false), [referenceId, setReference] = useState('loan-1');
  const [metric, setMetric] = useState<MortgageComparisonDraft['metric']>('net_interest_fee_cost'), [copy, setCopy] = useState('');
  const change = useCallback((n: number, value: MortgageFormInput | null) => { setInputs(old => old.map((v, i) => i === n ? value : v)); setConfirmed(false); setCopy(''); }, []);
  const first = useCallback((v: MortgageFormInput | null) => change(0, v), [change]), second = useCallback((v: MortgageFormInput | null) => change(1, v), [change]);
  const identity = canonical([inputs, confirmed, referenceId, metric, customer.profile?.revision, context.manifest]);
  const [result, setResult] = useState<{ identity: string; value?: ReturnType<typeof compareMortgagePeriods>; error?: string } | null>(null);
  const current = result?.identity === identity ? result : null;
  function calculate() {
    if (!customer.profile || inputs.some(i => !i) || options.length !== 2) throw Error('Choose both reviewed scopes and confirm all inputs.');
    const selected = inputs as MortgageFormInput[], s = selected[0].selection.subject;
    return compareMortgagePeriods(context, customer.profile, { startDate: s.scope.from, endDateExclusive: s.scope.toExclusive, timezone: s.authorityGraph.completedPeriod.timezone,
      metric, referenceId, independentLoansConfirmed: confirmed, alternatives: selected.map((v, n) => ({ id: `loan-${n + 1}`, ...v, target: options[n].target })) });
  }
  return <View style={{ gap: 12 }}>
    <AppText>Compare two confirmed historical loan periods</AppText>
    <AppText variant="small">Use the same period, opening total debt and cleared payment dates, amounts and timing. Do not change statement facts to make loans comparable. Interest and external fees may differ. This excludes household wealth, switching costs, future borrowing and tax effects.</AppText>
    {options.map((o, n) => <View key={n} style={{ gap: 8 }}><AppText weight="700">Loan {n + 1}: {o.label}</AppText><MortgagePeriodForm selections={o.selections} target={o.target} context={context} onComparisonInput={n === 0 ? first : second} /></View>)}
    <Chip label="These loan-only periods have no omitted linked-account effects" selected={confirmed} onPress={() => { setConfirmed(!confirmed); setCopy(''); }} />
    {(['net_interest_fee_cost', 'terminal_net_worth'] as const).map(m => <Chip key={m} label={m === 'net_interest_fee_cost' ? 'Compare interest and fee cost' : 'Compare closing loan-frame wealth'} selected={metric === m} onPress={() => { setMetric(m); setCopy(''); }} />)}
    {['loan-1', 'loan-2'].map(id => <Chip key={id} label={`Reference: ${id}`} selected={referenceId === id} onPress={() => { setReference(id); setCopy(''); }} />)}
    <Button title="Compare confirmed mortgage periods" disabled={customer.busy} onPress={() => { try { setResult({ identity, value: calculate() }); } catch (e) { setResult({ identity, error: e instanceof Error ? e.message : 'Comparison unavailable.' }); } setCopy(''); }} />
    {current?.error && <AppText>{current.error}</AppText>}
    {current?.value && <><AppText>{current.value.receipt.available ? 'Complete for these confirmed loan-only periods.' : 'Comparison incomplete or unavailable; no ranking.'}</AppText>
      {current.value.receipt.issues.map(issue => <AppText key={issue}>{issue}</AppText>)}
      {current.value.receipt.results.map(r => <View key={r.id} style={{ gap: 8 }}><AppText>{r.id}: rank {r.rank ?? 'unavailable'}; interest and fee cost {r.receipt.netInterestFeeCost ?? 'unknown'} AUD; closing loan-frame wealth {r.receipt.closingNetWorth ?? 'unknown'} AUD.</AppText>
        {Object.entries(r.receipt.accounts).map(([id, receipt]) => <MortgageResultDetails key={id} receipt={receipt} />)}<HoldingsResultDetails result={r} referenceId={referenceId} /></View>)}
      <Button title="Copy mortgage comparison receipt" onPress={() => { try { inputs.forEach((i, n) => assertMortgageSelection(i!.selection, context, options[n].target)); void Clipboard.setStringAsync(JSON.stringify(current.value, null, 2)).then(() => setCopy('Receipt copied.'), () => setCopy('Copy failed.')); } catch { setCopy('Source changed. Calculate again.'); } }} />
      <AppText variant="small">The receipt contains private offer, account, statement and payment details. Saved output is not current approval.</AppText></>}
    {!!copy && current && <AppText variant="small">{copy}</AppText>}
  </View>;
}

export function MortgageComparison({ rows }: { rows: { row: RateRow; section: SectionKey }[] }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity), details = useStore(s => s.details), ensureDetails = useStore(s => s.ensureDetails);
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0), identity = hashText(canonical([manifest, rows]));
  const [loaded, setLoaded] = useState<{ identity: string; context: MortgageContext; options: MortgageComparisonOption[]; error?: string } | null>(null);
  const current = loaded?.identity === identity && loaded.context.core === core && loaded.context.coreIntegrity === coreIntegrity && loaded.context.details === details ? loaded : null;
  useEffect(() => {
    if (!open) return; let active = true;
    const context = { manifest, core, coreIntegrity, details }, save = (options: MortgageComparisonOption[], error?: string) => { if (active) setLoaded({ identity, context, options, error }); };
    if (rows.length !== 2 || rows.some(r => r.section !== 'Mortgage') || !details) { save([], 'Choose exactly two mortgage rows with verified details.'); return; }
    void (async () => {
      const options: MortgageComparisonOption[] = [];
      // Bound discovery to the two chosen targets; no catalogue-wide prefetch.
      for (const { row } of rows) {
        const detail = details.products[row.product_key]; if (!detail) throw Error('Missing verified mortgage details.');
        const target: MortgageTarget = { kind: 'rate_variant', section: 'Mortgage', row, productKey: row.product_key, detail };
        const selections = await loadMortgageSelections(context, target);
        if (!selections.length) throw Error('A reviewed mortgage comparison is unavailable for one selected row.');
        options.push({ target, selections, label: row.product_name || row.product_key });
      }
      save(options);
    })().catch(e => save([], e instanceof Error ? e.message : 'Mortgage policies could not be verified.'));
    return () => { active = false; };
  }, [open, retry, identity, manifest, core, coreIntegrity, details, rows]);
  return <Disclosure title="Compare historical mortgage periods" open={open} onToggle={() => setOpen(!open)}>
    {current?.options.length === 2 ? <MortgageComparisonForm key={identity} context={current.context} options={current.options} /> : <><AppText>{current?.error ?? 'Checking reviewed mortgage policies...'}</AppText><Button title="Retry mortgage comparison policies" onPress={() => void ensureDetails({ forProductView: true }).catch(() => undefined).finally(() => setRetry(n => n + 1))} /></>}
  </Disclosure>;
}
