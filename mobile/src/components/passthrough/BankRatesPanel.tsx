import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SECTION_KEYS, type RateRow, type SectionKey } from '../../types';
import { bankRateScope, buildBankRateChart, type BankRateChartModel, type RateStatistic } from '../../data/bankRateOverview';
import { availableBankRateHistory, missingBankRateHistoryDates, packedBankRateSnapshots } from '../../data/bankRateHistory';
import { visibleAccountRows } from '../../data/format';
import { profileFeaturesForSection, profileFilterRows, profileSelectionCount } from '../../data/profile';
import { normalizeInterests, sectionSegmentOptions } from '../../data/interests';
import { useStore } from '../../data/store';
import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import { BankRateChart } from './BankRateChart';
import { SegmentedControl } from '../controls';
import { AppText, Card } from '../ui';

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
  const historyRevision = useStore(s => s.bankRateHistoryRevision ?? 0);
  const details = useStore(s => s.details?.products);
  const prefs = useStore(s => s.prefs);
  const calendar = useStore(s => s.rbaCalendar);
  const ensureDetails = useStore(s => s.ensureDetails);
  const ensureCalendar = useStore(s => s.ensureRbaCalendar);
  const revision = useSuitabilityRevision();
  const [tab, setTab] = useState<'rates' | 'gap'>('rates');
  const [statistic, setStatistic] = useState<RateStatistic>('mean');
  const [chosenSection, setChosenSection] = useState(requestedSection);
  const [provider, setProvider] = useState('');
  const options = sectionSegmentOptions(prefs.onboarded ? prefs.interests : SECTION_KEYS);
  const section = options.some(option => option.value === chosenSection) ? chosenSection : options[0].value;
  const gapAllowed = options.some(o => o.value === 'Mortgage') && options.some(o => o.value === 'Savings');
  const gap = tab === 'gap' && gapAllowed;
  const personalized = profileSelectionCount(prefs.profileFilters) > 0;
  const scope = useMemo(() => {
    void revision;
    return bankRateScope(Object.fromEntries(SECTION_KEYS.map(key => [key,
      core && (!prefs.onboarded || normalizeInterests(prefs.interests).includes(key))
        ? profileFilterRows(visibleAccountRows(core.sections[key].rates, prefs.includeNonStandard, details), prefs.profileFilters, key, details) : [],
    ])) as Record<SectionKey, RateRow[]>);
  }, [core, details, prefs.includeNonStandard, prefs.interests, prefs.onboarded, prefs.profileFilters, revision]);
  useEffect(() => setChosenSection(requestedSection), [requestedSection]);
  useEffect(() => { if (core) void ensureCalendar(); }, [core, ensureCalendar]);
  useEffect(() => {
    if (core && !details && (!prefs.includeNonStandard || SECTION_KEYS.some(key => profileFeaturesForSection(prefs.profileFilters, key).length))) void ensureDetails();
  }, [core, details, ensureDetails, prefs.includeNonStandard, prefs.profileFilters]);
  const snapshots = useMemo(() => core ? packedBankRateSnapshots(core, scope) : {}, [core, scope, historyRevision]);
  const historyAvailable = core ? availableBankRateHistory(core) !== null : false;
  const model = useMemo(() => buildBankRateChart(snapshots, section, statistic, gap, calendar), [calendar, gap, section, snapshots, statistic]);
  useEffect(() => { onModelChange?.(tab === 'gap' && !gapAllowed ? null : model); }, [gapAllowed, model, onModelChange, tab]);
  return <View style={{ gap: 12 }} testID="bank-rates-panel">
    <AppText variant="h3">Bank rates</AppText>
    <SegmentedControl options={[{ value: 'rates' as const, label: 'Rates' }, { value: 'gap' as const, label: 'Gap' }]} value={tab} onChange={setTab} />
    {tab === 'gap' && !gapAllowed ? <Card><AppText variant="small">The gap needs both Mortgage and Savings in your profile interests.</AppText></Card> : <>
      {showSections && !gap ? <SegmentedControl options={options} value={section} onChange={next => { setChosenSection(next); onSectionChange?.(next); }} /> : null}
      {!gap ? <SegmentedControl options={STATISTICS} value={statistic} onChange={setStatistic} /> : null}
      <AppText variant="tiny" color="textMuted">{personalized ? 'Matching your profile' : 'Included products'} · {gap ? 'Mortgage mean − savings mean' : 'Advertised rate tiers'}</AppText>
      {core && !historyAvailable ? <AppText variant="small" color="textMuted" accessibilityRole="alert">Historical rates are unavailable in this update. Showing current rates only.</AppText> : null}
      {core && missingBankRateHistoryDates(core).length > 0 ? <AppText variant="small" color="textMuted" accessibilityRole="alert">Some historical updates could not be loaded. Refresh to retry; missing observations stay blank.</AppText> : null}
      {model.lines.length ? <View onLayout={() => onChartReady?.(true)}><BankRateChart model={model} provider={selectedProvider ?? provider} onProviderChange={onProviderChange ?? setProvider} label={gap ? 'Gap' : STATISTICS.find(s => s.value === statistic)!.label} gap={gap} /></View> : <Card><AppText variant="small">No matching rates. Required product details may still be loading.</AppText></Card>}
      <AppText variant="tiny" color="textMuted">Each matching rate tier has equal weight. History follows currently matching tiers; missing observations stay blank.{gap ? ' The gap does not measure bank margins.' : ''}</AppText>
    </>}
  </View>;
}
