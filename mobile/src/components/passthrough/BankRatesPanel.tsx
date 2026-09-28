import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SECTION_KEYS, type SectionKey } from '../../types';
import { buildBankRateChart, type BankRateChartModel, type RateStatistic } from '../../data/bankRateOverview';
import { profileSelectionCount } from '../../data/profile';
import { sectionSegmentOptions } from '../../data/interests';
import { useStore } from '../../data/store';
import { useBankRateHistory } from '../../hooks/useBankRateHistory';
import { BankRateChart } from './BankRateChart';
import { SegmentedControl } from '../controls';
import { AppText, Disclosure } from '../ui';

const STATISTICS: { value: RateStatistic; label: string }[] = [
  { value: 'min', label: 'Min' }, { value: 'mean', label: 'Mean' },
  { value: 'median', label: 'Median' }, { value: 'max', label: 'Max' },
];
export function BankRatesPanel({ section: requestedSection = 'Mortgage', onSectionChange, showSections = true,
  selectedProvider, onProviderChange, onModelChange, onChartReady,
}: {
  section?: SectionKey; onSectionChange?: (section: SectionKey) => void; showSections?: boolean;
  selectedProvider?: string; onProviderChange?: (provider: string) => void;
  onModelChange?: (model: BankRateChartModel | null) => void; onChartReady?: (ready: boolean) => void;
}) {
  const core = useStore(s => s.core);
  const prefs = useStore(s => s.prefs);
  const calendar = useStore(s => s.rbaCalendar);
  const ensureCalendar = useStore(s => s.ensureRbaCalendar);
  const { snapshots, updating, failed, historyAvailable, historyLoading, missingDates, cataloguePrepared } = useBankRateHistory();
  const [tab, setTab] = useState<'rates' | 'gap'>('rates');
  const [statistic, setStatistic] = useState<RateStatistic>('mean');
  const [chosenSection, setChosenSection] = useState(requestedSection);
  const [provider, setProvider] = useState('');
  const [methodOpen, setMethodOpen] = useState(false);
  const options = sectionSegmentOptions(prefs.onboarded ? prefs.interests : SECTION_KEYS);
  const section = options.some(option => option.value === chosenSection) ? chosenSection : options[0].value;
  const gapAllowed = options.some(o => o.value === 'Mortgage') && options.some(o => o.value === 'Savings');
  const gap = tab === 'gap' && gapAllowed;
  const personalized = profileSelectionCount(prefs.profileFilters) > 0;
  useEffect(() => setChosenSection(requestedSection), [requestedSection]);
  useEffect(() => { if (core) void ensureCalendar(); }, [core, ensureCalendar]);
  const model = useMemo(() => buildBankRateChart(snapshots ?? {}, section, statistic, gap, calendar), [calendar, gap, section, snapshots, statistic]);
  useEffect(() => { onModelChange?.(updating || (tab === 'gap' && !gapAllowed) ? null : model); }, [gapAllowed, model, onModelChange, tab, updating]);
  useEffect(() => { if (updating) onChartReady?.(false); }, [onChartReady, updating]);
  return <View style={{ gap: 20 }} testID="bank-rates-panel">
    <View style={{ gap: 4 }}>
      <AppText variant="h2" accessibilityRole="header">Bank rates</AppText>
      <AppText variant="small" color="textMuted">Compare the rates banks advertise over time.</AppText>
    </View>
    <SegmentedControl options={[{ value: 'rates' as const, label: 'Rates' }, { value: 'gap' as const, label: 'Gap' }]} value={tab} onChange={setTab} />
    {tab === 'gap' && !gapAllowed ? <AppText variant="small">The gap needs both Mortgage and Savings in your profile interests.</AppText> : <>
      {showSections && !gap ? <SegmentedControl options={options} value={section} onChange={next => { setChosenSection(next); onSectionChange?.(next); }} /> : null}
      {!gap ? <SegmentedControl options={STATISTICS} value={statistic} onChange={setStatistic} /> : null}
      <AppText variant="small" color="textMuted">{personalized ? 'Matching your profile' : 'Included products'} · {gap ? 'Mortgage mean − savings mean' : 'Advertised rate tiers'}</AppText>
      {core && !historyAvailable && !historyLoading ? <AppText variant="small" color="textMuted" accessibilityRole="alert">Historical rates are unavailable in this update. Showing current rates only.</AppText> : null}
      {!historyLoading && missingDates.length > 0 ? <AppText variant="small" color="textMuted" accessibilityRole="alert">Some historical observations are unavailable in this update and stay blank.</AppText> : null}
      {updating ? <AppText variant="small" accessibilityRole="alert">{failed ? 'Historical rates could not be prepared. Please try again.' : 'Updating historical rates for your filters…'}</AppText> : model.lines.length ? <View onLayout={() => onChartReady?.(true)}><BankRateChart model={model} provider={selectedProvider ?? provider} onProviderChange={onProviderChange ?? setProvider} label={gap ? 'Gap' : STATISTICS.find(s => s.value === statistic)!.label} gap={gap} /></View> : <AppText variant="small">No matching rates. Required product details may still be loading.</AppText>}
      {gap ? <AppText variant="small" color="textMuted">The gap does not measure bank margins.</AppText> : null}
      <Disclosure title="How these rates are compared" summary="Rate tiers, filters and missing observations" open={methodOpen} onToggle={() => setMethodOpen(open => !open)}>
        <AppText variant="small" color="textMuted">Each matching rate tier has equal weight. {cataloguePrepared ? 'History includes products matching your filters on each observed date, including products since withdrawn.' : 'History follows currently matching tiers.'} Missing observations stay blank.</AppText>
      </Disclosure>
    </>}
  </View>;
}
