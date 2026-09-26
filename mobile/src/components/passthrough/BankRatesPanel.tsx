import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../../types';
import { bankRateScope, buildBankRateChart, type BankRateChartModel, type RateStatistic } from '../../data/bankRateOverview';
import { availableBankRateHistory, missingBankRateHistoryDates, packedBankRateSnapshots } from '../../data/bankRateHistory';
import { cachedHistoricalBankRateSnapshots, historicalBankRateSnapshotsAsync } from '../../data/historicalBankRateCatalogue';
import { cachedHistoricalBankRateCatalogue, missingHistoricalCatalogueDates, prepareAvailableHistoricalBankRateCatalogue } from '../../data/historicalBankRateCatalogueStore';
import { visibleAccountRows } from '../../data/format';
import { profileFeaturesForSection, profileFilterRows, profileSelectionCount } from '../../data/profile';
import { normalizeInterests, sectionSegmentOptions } from '../../data/interests';
import { useStore } from '../../data/store';
import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import { yieldToUi } from '../../lib/yieldToUi';
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
  const request = useMemo(() => ({ core, scope, historyRevision, revision, filters: {
    profileFilters: prefs.profileFilters,
    interests: prefs.onboarded ? normalizeInterests(prefs.interests) : SECTION_KEYS,
    includeNonStandard: prefs.includeNonStandard,
  } }), [core, scope, historyRevision, revision, prefs.profileFilters, prefs.onboarded, prefs.interests, prefs.includeNonStandard]);
  const [settled, setSettled] = useState<{ request: typeof request; failed: boolean } | null>(null);
  const [invalidRich, setInvalidRich] = useState<{ core: CorePayload; value: unknown } | null>(null);
  const catalogue = core ? cachedHistoricalBankRateCatalogue(core) : null;
  const rejectedRich = invalidRich?.core === core && invalidRich?.value === core?.bank_rate_history_catalogue;
  const richHistory = !!catalogue || (!!core?.bank_rate_history_catalogue && !rejectedRich);
  const snapshots = useMemo(() => {
    void settled;
    return core ? richHistory ? catalogue ? cachedHistoricalBankRateSnapshots(catalogue, core, scope, request.filters) : null
      : packedBankRateSnapshots(core, scope) : {};
  }, [catalogue, core, scope, request, richHistory, settled]);
  useEffect(() => {
    if (!core || !richHistory) return;
    if (catalogue && cachedHistoricalBankRateSnapshots(catalogue, core, scope, request.filters)) return;
    let active = true;
    void (async () => {
      const ready = catalogue ?? await prepareAvailableHistoricalBankRateCatalogue(core);
      if (!ready) {
        // A rejected optional rich extension must not hide valid legacy history.
        // Only the active request may reject it; fallback uses the latest scope.
        if (active) setInvalidRich({ core, value: core.bank_rate_history_catalogue });
        return;
      }
      await historicalBankRateSnapshotsAsync(ready, core, scope, request.filters, () => yieldToUi(0));
      if (active) setSettled({ request, failed: false });
    })().catch(() => { if (active) setSettled({ request, failed: true }); });
    return () => { active = false; };
  }, [catalogue, core, scope, request, richHistory]);
  const updating = richHistory && snapshots === null;
  const failed = settled?.request === request && settled.failed;
  const historyAvailable = richHistory || (core ? availableBankRateHistory(core) !== null : false);
  const missingDates = core ? catalogue ? missingHistoricalCatalogueDates(core) : richHistory ? [] : missingBankRateHistoryDates(core) : [];
  const model = useMemo(() => buildBankRateChart(snapshots ?? {}, section, statistic, gap, calendar), [calendar, gap, section, snapshots, statistic]);
  useEffect(() => { onModelChange?.(updating || (tab === 'gap' && !gapAllowed) ? null : model); }, [gapAllowed, model, onModelChange, tab, updating]);
  useEffect(() => { if (updating) onChartReady?.(false); }, [onChartReady, updating]);
  return <View style={{ gap: 12 }} testID="bank-rates-panel">
    <AppText variant="h3">Bank rates</AppText>
    <SegmentedControl options={[{ value: 'rates' as const, label: 'Rates' }, { value: 'gap' as const, label: 'Gap' }]} value={tab} onChange={setTab} />
    {tab === 'gap' && !gapAllowed ? <Card><AppText variant="small">The gap needs both Mortgage and Savings in your profile interests.</AppText></Card> : <>
      {showSections && !gap ? <SegmentedControl options={options} value={section} onChange={next => { setChosenSection(next); onSectionChange?.(next); }} /> : null}
      {!gap ? <SegmentedControl options={STATISTICS} value={statistic} onChange={setStatistic} /> : null}
      <AppText variant="tiny" color="textMuted">{personalized ? 'Matching your profile' : 'Included products'} · {gap ? 'Mortgage mean − savings mean' : 'Advertised rate tiers'}</AppText>
      {core && !historyAvailable ? <AppText variant="small" color="textMuted" accessibilityRole="alert">Historical rates are unavailable in this update. Showing current rates only.</AppText> : null}
      {missingDates.length > 0 ? <AppText variant="small" color="textMuted" accessibilityRole="alert">Some historical observations are unavailable in this update and stay blank.</AppText> : null}
      {updating ? <Card><AppText variant="small" accessibilityRole="alert">{failed ? 'Historical rates could not be prepared. Please try again.' : 'Updating historical rates for your filters…'}</AppText></Card> : model.lines.length ? <View onLayout={() => onChartReady?.(true)}><BankRateChart model={model} provider={selectedProvider ?? provider} onProviderChange={onProviderChange ?? setProvider} label={gap ? 'Gap' : STATISTICS.find(s => s.value === statistic)!.label} gap={gap} /></View> : <Card><AppText variant="small">No matching rates. Required product details may still be loading.</AppText></Card>}
      <AppText variant="tiny" color="textMuted">Each matching rate tier has equal weight. {catalogue ? 'History includes products matching your filters on each observed date, including products since withdrawn.' : 'History follows currently matching tiers.'} Missing observations stay blank.{gap ? ' The gap does not measure bank margins.' : ''}</AppText>
    </>}
  </View>;
}
