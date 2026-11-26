import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SECTION_KEYS, type SectionKey } from '../../types';
import { buildBankRateChart, type BankRateChartModel, type RateStatistic } from '../../data/bankRateOverview';
import { bankRateSnapshotsInRange, focusBankRateChart, type BankRateRange } from '../../data/bankRateChartView';
import { isBigFourProvider } from '../../data/bankGroups';
import { useSavedProviders } from '../../hooks/useSavedProviders';
import { profileSelectionCount } from '../../data/profile';
import { sectionSegmentOptions } from '../../data/interests';
import { useStore } from '../../data/store';
import { useBankRateHistory } from '../../hooks/useBankRateHistory';
import { hasPositiveChartLayout, type ChartRenderEvidence } from '../../lib/chartRenderEvidence';
import { BankRateChart } from './BankRateChart';
import { SegmentedControl } from '../controls';
import { AppText, Chip } from '../ui';
import { uiCount, uiJoin, uiLabel, type UiCopy } from '../../lib/uiCopy';
import { uiChartWindow } from '../../lib/chartUiCopy';
import { ChipStrip } from '../selectors';

const STATISTICS: { value: RateStatistic; label: UiCopy }[] = [
  { value: 'min', label: 'Min' }, { value: 'mean', label: 'Mean' },
  { value: 'median', label: 'Median' }, { value: 'max', label: 'Max' },
];
export interface BankRatesAuditState {
  revision: string;
  status: 'pending' | 'ready' | 'error';
  error: string | null;
  modelPointCount: number;
  renderedPointCount: number;
  emptyStateRendered: boolean;
  accessibleSummary: boolean;
  layoutMeasured: boolean;
}
export function BankRatesPanel({ section: requestedSection = 'Mortgage', onSectionChange, showSections = true,
  selectedProvider, onProviderChange, onModelChange, onChartReady, onAuditStateChange,
}: {
  section?: SectionKey; onSectionChange?: (section: SectionKey) => void; showSections?: boolean;
  selectedProvider?: string; onProviderChange?: (provider: string) => void;
  onModelChange?: (model: BankRateChartModel | null) => void; onChartReady?: (ready: boolean) => void;
  onAuditStateChange?: (state: BankRatesAuditState) => void;
}) {
  const core = useStore(s => s.core);
  const prefs = useStore(s => s.prefs);
  const calendar = useStore(s => s.rbaCalendar);
  const ensureCalendar = useStore(s => s.ensureRbaCalendar);
  const { snapshots, updating, failed, historyAvailable, historyLoading, missingDates, cataloguePrepared, revision } = useBankRateHistory();
  const [tab, setTab] = useState<'rates' | 'gap'>('rates');
  const [statistic, setStatistic] = useState<RateStatistic>('mean');
  const [chosenSection, setChosenSection] = useState(requestedSection);
  const [provider, setProvider] = useState('');
  const [range, setRange] = useState<BankRateRange>('All');
  const [comparison, setComparison] = useState<'big4' | 'all'>('all');
  const saved = useSavedProviders();
  const [graphic, setGraphic] = useState<ChartRenderEvidence | null>(null);
  const [renderedEmptyRevision, setRenderedEmptyRevision] = useState<string | null>(null);
  const options = sectionSegmentOptions(SECTION_KEYS);
  const section = options.some(option => option.value === chosenSection) ? chosenSection : options[0].value;
  const gapAllowed = options.some(o => o.value === 'Mortgage') && options.some(o => o.value === 'Savings');
  const gap = tab === 'gap' && gapAllowed;
  const personalized = profileSelectionCount(prefs.profileFilters) > 0;
  useEffect(() => setChosenSection(requestedSection), [requestedSection]);
  useEffect(() => { if (core) void ensureCalendar(); }, [core, ensureCalendar]);
  const fullModel = useMemo(
    () => buildBankRateChart(bankRateSnapshotsInRange(snapshots ?? {}, range), section, statistic, gap, calendar),
    [calendar, gap, range, section, snapshots, statistic],
  );
  const providers = useMemo(() => fullModel.lines.map(line => line.provider), [fullModel.lines]);
  const defaultProvider = useMemo(() => {
    const hasValidObservation = (line: BankRateChartModel['lines'][number]) =>
      line.points.some(point => Number.isFinite(point.value) && point.count > 0 && (gap || point.value > 0));
    const valid = fullModel.lines.filter(hasValidObservation);
    return (valid.find(line => saved.has(line.provider)) ?? valid[0] ?? fullModel.lines[0])?.provider ?? '';
  }, [fullModel.lines, gap, saved]);
  const requestedProvider = selectedProvider ?? provider;
  const requestedLine = fullModel.lines.find(line => line.provider === requestedProvider);
  const activeProvider = requestedLine ? requestedLine.provider : defaultProvider;
  const model = useMemo(() => comparison === 'all' ? fullModel
    : focusBankRateChart(fullModel, name => name === activeProvider || isBigFourProvider(name)),
  [activeProvider, comparison, fullModel]);
  const chartSourceRevision = `${revision}:${section}:${statistic}:${tab}:${range}:${comparison === 'all' ? 'all' : `big4:${activeProvider}`}:${model.decisions.map(item => `${item.date}:${item.outcome}`).join(',')}`;
  const chartRevision = `${chartSourceRevision}:${activeProvider || 'none'}`;
  const activeChartRevision = useRef(chartRevision); activeChartRevision.current = chartRevision;
  const gapUnavailable = tab === 'gap' && !gapAllowed;
  const modelPointCount = useMemo(() => gapUnavailable ? 0 : model.lines.reduce((count, line) => count + line.points.length, 0), [gapUnavailable, model]);
  const activeChartPointCount = useRef(modelPointCount); activeChartPointCount.current = modelPointCount;
  const auditState = useMemo<BankRatesAuditState>(() => {
    const chartRendered = graphic?.revision === chartRevision && graphic.layoutMeasured && graphic.pointCount === modelPointCount && graphic.expectedCount === modelPointCount && modelPointCount > 0 && graphic.accessibleSummary;
    const emptyStateRendered = renderedEmptyRevision === chartRevision && modelPointCount === 0;
    return {
      revision: chartRevision,
      status: failed ? 'error' : !core || updating ? 'pending' : chartRendered || emptyStateRendered ? 'ready' : 'pending',
      error: failed ? 'Historical rates could not be prepared' : null,
      modelPointCount,
      renderedPointCount: graphic?.revision === chartRevision ? graphic.pointCount : 0,
      emptyStateRendered,
      accessibleSummary: chartRendered && graphic.accessibleSummary,
      layoutMeasured: chartRendered || emptyStateRendered,
    };
  }, [chartRevision, core, failed, graphic, modelPointCount, renderedEmptyRevision, updating]);
  const recordGraphic = useCallback((evidence: ChartRenderEvidence) => {
    if (evidence.revision !== activeChartRevision.current) return;
    setGraphic(current => current
      && current.revision === evidence.revision
      && current.pointCount === evidence.pointCount
      && current.expectedCount === evidence.expectedCount
      && current.layoutMeasured === evidence.layoutMeasured
      && current.accessibleSummary === evidence.accessibleSummary
      && current.emptyStateRendered === evidence.emptyStateRendered
      ? current : evidence);
    onChartReady?.(evidence.layoutMeasured && evidence.accessibleSummary && evidence.pointCount > 0 && evidence.pointCount === evidence.expectedCount && evidence.pointCount === activeChartPointCount.current);
  }, [onChartReady]);
  useEffect(() => { onAuditStateChange?.(auditState); }, [auditState, onAuditStateChange]);
  useEffect(() => { onModelChange?.(updating || (tab === 'gap' && !gapAllowed) ? null : model); }, [gapAllowed, model, onModelChange, tab, updating]);
  useEffect(() => { if (updating) onChartReady?.(false); }, [onChartReady, updating]);
  return <View style={{ gap: 20 }} testID="bank-rates-panel">
    <View style={{ gap: 4 }}>
      <AppText variant="h2" accessibilityRole="header">{uiLabel("Bank rates")}</AppText>
    </View>
    <SegmentedControl options={[{ value: 'rates' as const, label: 'Rates' }, { value: 'gap' as const, label: 'Gap' }]} value={tab} onChange={setTab} />
    {gapUnavailable ? <View key={chartRevision} onLayout={(event) => { if (hasPositiveChartLayout(event) && activeChartRevision.current === chartRevision) setRenderedEmptyRevision(chartRevision); }}><AppText variant="small">{uiJoin('Gap', ' · ', 'Unavailable')}</AppText></View> : <>
      {showSections && !gap ? <SegmentedControl options={options} value={section} onChange={next => { setChosenSection(next); onSectionChange?.(next); }} /> : null}
      {!gap ? <ChipStrip>
        {STATISTICS.map(item => (
          <Chip key={item.value} label={item.label} selected={statistic === item.value} onPress={() => setStatistic(item.value)} />
        ))}
      </ChipStrip> : null}
      <ChipStrip>
        <Chip label={uiChartWindow('1Y')} selected={range === '1Y'} onPress={() => setRange('1Y')} />
        <Chip label={uiChartWindow('All')} selected={range === 'All'} onPress={() => setRange('All')} />
        <Chip label="Big four" selected={comparison === 'big4'} onPress={() => setComparison('big4')} />
        <Chip label="All banks" selected={comparison === 'all'} onPress={() => setComparison('all')} />
      </ChipStrip>
      <AppText variant="small" color="textMuted">{uiJoin(personalized ? 'Profile' : 'Products', ' · ', gap ? uiJoin('Home loans', ' ', 'Mean', ' ', '−', ' ', 'Savings', ' ', 'Mean') : uiLabel('Advertised rate'))}</AppText>
      {core && !historyAvailable && !historyLoading ? <AppText variant="small" color="textMuted" accessibilityRole="alert">{uiJoin('History', ' · ', 'Unavailable', ' · ', 'Current rate')}</AppText> : null}
      {!historyLoading && missingDates.length > 0 ? <AppText variant="small" color="textMuted" accessibilityRole="alert">{uiJoin('Missing observations', ' · ', uiCount(missingDates.length))}</AppText> : null}
      {updating ? <AppText variant="small" accessibilityRole="alert">{uiLabel(failed ? 'Unavailable' : 'Loading')}</AppText> : model.lines.length ? <View key={chartSourceRevision} testID="bank-rates-chart-layout"><BankRateChart model={model} provider={activeProvider} onProviderChange={onProviderChange ?? setProvider}
        providers={providers} saved={saved} labelledComparison={comparison === 'big4'} label={gap ? 'Gap' : STATISTICS.find(s => s.value === statistic)!.label} gap={gap} auditRevision={chartRevision} onGraphicReady={recordGraphic} /></View> : <View key={chartRevision} testID="bank-rates-empty-layout" onLayout={(event) => { if (hasPositiveChartLayout(event) && activeChartRevision.current === chartRevision) setRenderedEmptyRevision(chartRevision); }}><AppText variant="small">{uiLabel("No results")}</AppText></View>}
      {gap ? <AppText variant="small" color="textMuted">{uiJoin('Bank margin', ' · ', 'Excluded')}</AppText> : null}
      {!cataloguePrepared && historyAvailable ? <AppText variant="small" color="textMuted">{uiJoin('Historical matches', ' · ', 'Unverified')}</AppText> : null}
    </>}
  </View>;
}
