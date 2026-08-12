import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import React, { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SECTION_ORDER, SECTIONS } from '../../constants';
import { sectionSegmentOptions } from '../../data/interests';
import {
  rbaPassThroughMultiSection,
  rbaResponseWindowList,
  type BankInsightsPayload,
  type MultiSectionPassThroughModel,
  type MultiSectionPassThroughRow,
  type PassThroughRow,
  type RbaDecisionRef,
} from '../../data/bankInsights';
import {
  buildBankResponseProfiles,
  filterAndSortSectionRows,
  lenderResponseAccessibilityLabel,
  passThroughCustomerContext,
  responseBpsLabel,
  responseTimingLabel,
  summarizeSectionResponse,
  type PassThroughSort,
} from '../../data/passThroughModels';
import type { RbaCalendar } from '../../data/rbaCalendar';
import {
  usePerformanceAuditProbe,
  usePerformanceAuditSurface,
} from '../../hooks/usePerformanceAuditReadiness';
import { hapticSelection } from '../../lib/haptics';
import { moveTone } from '../../lib/moveSemantics';
import { openBank } from '../../lib/nav';
import { useRegisterLogosStore } from '../../lib/registerLogos';
import type { RbaEntry, SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { SearchBar, SegmentedControl } from '../controls';
import { AppText, Badge, Card, Chip, Row } from '../ui';
import { ResponseScatter } from './ResponseScatter';
import { BankPatternRow } from './BankPatternRow';
import { ResponseComposition } from './ResponseComposition';
import { ResponseWindowHeader } from './ResponseWindowHeader';

type LenderRow = MultiSectionPassThroughRow & { response: PassThroughRow };
type DashboardItem =
  | { kind: 'window'; row: LenderRow }
  | { kind: 'pattern'; profile: ReturnType<typeof buildBankResponseProfiles>[number] };
type ResponseView = 'window' | 'patterns';

function actionParameter(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : null;
}

function actionSection(value: unknown): SectionKey | null {
  const candidate = actionParameter(value, 'section');
  return candidate && SECTION_ORDER.includes(candidate as SectionKey) ? candidate as SectionKey : null;
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        minWidth: 132,
        padding: 12,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      <AppText variant="tiny" color="textFaint" weight="700">
        {label.toUpperCase()}
      </AppText>
      <AppText variant="rate" style={{ marginTop: 2 }}>
        {value}
      </AppText>
      <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
        {detail}
      </AppText>
    </View>
  );
}

function ResponseCell({
  section,
  row,
  partial,
}: {
  section: SectionKey;
  row: PassThroughRow | undefined;
  partial: boolean;
}) {
  if (!row) {
    return (
      <View style={{ minHeight: 76, paddingVertical: 8 }}>
        <AppText variant="tiny" color="textFaint" weight="700" numberOfLines={2}>
          {SECTIONS[section].short.toUpperCase()}
        </AppText>
        <AppText variant="tiny" color="textMuted" style={{ marginTop: 6 }}>
          No series
        </AppText>
      </View>
    );
  }
  const net = row.netChangeBps ?? row.passedBps;
  const tone = net === 0 ? 'textMuted' : moveTone(section, net) === 'success' ? 'success' : 'danger';
  return (
    <View style={{ minHeight: 76, paddingVertical: 8 }}>
      <AppText variant="tiny" color="textFaint" weight="700" numberOfLines={2}>
        {SECTIONS[section].short.toUpperCase()}
      </AppText>
      <AppText variant="small" weight="800" color={tone} style={{ marginTop: 3 }}>
        {responseBpsLabel(net)}
      </AppText>
      <AppText variant="tiny" color="textMuted" numberOfLines={2}>
        {responseTimingLabel(row, partial)}
      </AppText>
    </View>
  );
}

const LenderResponseRow = memo(function LenderResponseRow({
  item,
  section,
  model,
  selected,
}: {
  item: LenderRow;
  section: SectionKey;
  model: MultiSectionPassThroughModel;
  selected: boolean;
}) {
  const theme = useTheme();
  const accessibilityLabel = lenderResponseAccessibilityLabel(
    item,
    section,
    model.decision.partialObservation,
  );
  return (
    <View
      style={{
        backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      <Pressable
        onPress={() => openBank(item.provider)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Open this lender's profile."
        style={{ padding: 14 }}
      >
        <Row gap={10} style={{ alignItems: 'center' }}>
          <BankAvatar provider={item.provider} size={38} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText variant="small" weight="700" numberOfLines={1} style={{ flex: 1 }}>
                {item.provider}
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textFaint} />
            </Row>
          </View>
        </Row>
        <View
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
          }}
        >
          <ResponseCell
            section={section}
            row={item.sections[section]}
            partial={model.decision.partialObservation}
          />
        </View>
      </Pressable>
    </View>
  );
});

const AnalysisHeader = memo(function AnalysisHeader({
  model,
  hasWindowData,
  windowTracked,
  decisions,
  section,
  sectionOptions,
  onSectionChange,
  onDecisionChange,
}: {
  model: MultiSectionPassThroughModel;
  hasWindowData: boolean;
  windowTracked: boolean;
  decisions: RbaDecisionRef[];
  section: SectionKey;
  sectionOptions: ReturnType<typeof sectionSegmentOptions>;
  onSectionChange: (section: SectionKey) => void;
  onDecisionChange: (date: string) => void;
}) {
  const summary = useMemo(() => summarizeSectionResponse(model, section), [model, section]);
  const partial = model.decision.partialObservation;
  return (
    <View>
      <ResponseWindowHeader
        model={model}
        decisions={decisions}
        onDecisionChange={onDecisionChange}
      />

      <SegmentedControl
        options={sectionOptions}
        value={section}
        onChange={onSectionChange}
      />

      {!windowTracked ? (
        <Card style={{ marginTop: 14, marginBottom: 14 }}>
          <AppText variant="h3">No tracked bank data</AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 5 }}>
            This rate-change window ended before the available daily bank history began. It remains in the chronology without inventing a response analysis.
          </AppText>
        </Card>
      ) : null}

      {windowTracked && !hasWindowData ? (
        <Card style={{ marginTop: 14, marginBottom: 14 }}>
          <AppText variant="h3">No lender observations</AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 5 }}>
            Bank history overlaps this window, but no eligible provider series can be scored for the selected product section.
          </AppText>
        </Card>
      ) : null}

      {hasWindowData ? <Card style={{ marginTop: 14, marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <View>
            <AppText variant="h3">Window response</AppText>
            <AppText variant="tiny" color="textMuted">
              {partial ? 'Partial history · provisional' : 'Advertised provider medians'}
            </AppText>
          </View>
          <AppText variant="rate">{summary.movedWithRba}/{summary.eligible}</AppText>
        </Row>
        <ResponseComposition summary={summary} />
      </Card> : null}

      {hasWindowData ? <Row gap={10} style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <MetricTile
          label="Typical size"
          value={summary.medianObservedBps == null ? '—' : `${summary.medianObservedBps} bp`}
          detail="median matching move"
        />
        <MetricTile
          label="Typical speed"
          value={summary.medianDays == null ? '—' : `${partial ? '≤' : ''}${summary.medianDays}d`}
          detail="median first response"
        />
      </Row> : null}
    </View>
  );
});

/** Isolated so chart selection updates do not rebuild decision metrics. */
const SpeedResponseCard = memo(function SpeedResponseCard({
  model,
  section,
  decisions,
  eligible,
  selectedProvider,
  onProviderSelect,
  zoom,
  onZoomChange,
  onGraphicReady,
}: {
  model: MultiSectionPassThroughModel;
  section: SectionKey;
  decisions: RbaDecisionRef[];
  eligible: number;
  selectedProvider: string | null;
  onProviderSelect: (provider: string | null) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onGraphicReady: (result: { revision: string; pointCount: number }) => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 2 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <AppText variant="h3">Speed × response</AppText>
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
            Tap a point to filter the lender list · zoom to inspect clusters · every RBA decision is marked
          </AppText>
        </View>
        <Badge label={`${eligible} lenders`} tone="muted" />
      </Row>
      <ResponseScatter
        model={model}
        section={section}
        decisions={decisions}
        selectedProvider={selectedProvider}
        onProviderSelect={onProviderSelect}
        zoom={zoom}
        onZoomChange={onZoomChange}
        onGraphicReady={onGraphicReady}
      />
      <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 10, marginTop: 8 }}>
        <AppText variant="tiny" color="textMuted">
          {passThroughCustomerContext(section, model.decision.bps)}
        </AppText>
      </View>
    </Card>
  );
});

export function PassThroughDashboard({
  payload,
  rba,
  calendar,
  initialDecisionDate,
  section: controlledSection,
  onSectionChange: controlledSectionChange,
  interests,
}: {
  payload: BankInsightsPayload;
  rba: RbaEntry[];
  calendar: RbaCalendar | null;
  initialDecisionDate?: string;
  section?: SectionKey;
  onSectionChange?: (section: SectionKey) => void;
  interests?: SectionKey[];
}) {
  const [localSection, setLocalSection] = useState<SectionKey>(controlledSection ?? 'Mortgage');
  const section = controlledSection ?? localSection;
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDecisionDate ?? null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [view, setView] = useState<ResponseView>('window');
  const [patternDirection, setPatternDirection] = useState<'hike' | 'cut'>('cut');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PassThroughSort>('response');
  const [chartZoom, setChartZoom] = useState(1);
  const [chartReadyRevision, setChartReadyRevision] = useState<string | null>(null);
  const [chartPointCount, setChartPointCount] = useState(0);
  const [listReadyRevision, setListReadyRevision] = useState<string | null>(null);
  const [listMounted, setListMounted] = useState(false);
  const [layoutReadyRevision, setLayoutReadyRevision] = useState<string | null>(null);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests ?? SECTION_ORDER), [interests]);
  const availableSections = useMemo(() => sectionOptions.map((option) => option.value), [sectionOptions]);
  const registerLogosLoaded = useRegisterLogosStore((state) => state.loaded);
  const listRef = useRef<FlashListRef<DashboardItem>>(null);
  const responseWindows = useMemo(
    () => rbaResponseWindowList(payload, rba, { calendar }),
    [payload, rba, calendar],
  );
  const decisions = useMemo(
    () => responseWindows.map((window) => window.decision),
    [responseWindows],
  );
  const latestDecisionDate = decisions[0]?.date;
  const latestDecisionOutcome = decisions[0]?.outcome;
  useEffect(() => {
    if (latestDecisionOutcome) setPatternDirection(latestDecisionOutcome);
  }, [latestDecisionDate, latestDecisionOutcome]);
  useEffect(() => {
    if (initialDecisionDate) setSelectedDate(initialDecisionDate);
  }, [initialDecisionDate]);
  const activeDate = selectedDate && decisions.some((decision) => decision.date === selectedDate)
    ? selectedDate
    : decisions[0]?.date;
  const scoredModel = useMemo(
    () => rbaPassThroughMultiSection(payload, rba, { calendar, decisionDate: activeDate }),
    [payload, rba, calendar, activeDate],
  );
  const activeWindow = responseWindows.find((window) => window.decision.date === activeDate);
  const model = useMemo<MultiSectionPassThroughModel | null>(() => {
    if (scoredModel) return scoredModel;
    if (!activeWindow) return null;
    return {
      decision: activeWindow.decision,
      rows: [],
      windowDays: activeWindow.windowDays,
      windowEnd: activeWindow.windowEnd,
      observedThrough: payload.run_date,
      windowOpen: activeWindow.windowOpen,
    };
  }, [activeWindow, payload.run_date, scoredModel]);
  const hasWindowData = !!scoredModel;
  const rows = useMemo(
    () =>
      model
        ? filterAndSortSectionRows(model, section, query, sort, selectedProvider)
        : [],
    [model, section, query, sort, selectedProvider],
  );
  const profiles = useMemo(
    () => model && view === 'patterns'
      ? buildBankResponseProfiles(payload, rba, calendar, section, patternDirection)
      : [],
    [calendar, model, patternDirection, payload, rba, section, view],
  );
  const visibleProfiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return profiles.filter((profile) =>
      !normalized || profile.provider.toLocaleLowerCase().includes(normalized),
    );
  }, [profiles, query]);
  const items = useMemo<DashboardItem[]>(
    () => view === 'window'
      ? rows.map((row) => ({ kind: 'window', row }))
      : visibleProfiles.map((profile) => ({ kind: 'pattern', profile })),
    [rows, view, visibleProfiles],
  );
  const sectionEligible = useMemo(
    () => (model ? summarizeSectionResponse(model, section).eligible : 0),
    [model, section],
  );
  const renderRevision = `${payload.run_date}:${activeDate ?? 'none'}:${section}:${view}:${query}:${sort}:${selectedProvider ?? 'all'}:${chartZoom}`;
  useEffect(() => {
    if (!listMounted || !model) return;
    const frame = requestAnimationFrame(() => setListReadyRevision(renderRevision));
    return () => cancelAnimationFrame(frame);
  }, [items, listMounted, model, renderRevision]);

  const onSectionChange = useCallback((next: SectionKey) => {
    if (controlledSection == null) setLocalSection(next);
    controlledSectionChange?.(next);
    setSelectedProvider(null);
  }, [controlledSection, controlledSectionChange]);

  const onDecisionChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedProvider(null);
    setChartZoom(1);
  }, []);

  const onChartReady = useCallback((result: { revision: string; pointCount: number }) => {
    setChartReadyRevision(result.revision);
    setChartPointCount(result.pointCount);
  }, []);

  /** Chart already painted locally — defer list filter work off the tap path. */
  const onChartProviderSelect = useCallback((provider: string | null) => {
    startTransition(() => {
      setSelectedProvider(provider);
    });
  }, []);

  const clearProviderFilter = useCallback(() => {
    hapticSelection();
    setSelectedProvider(null);
  }, []);

  const changeView = useCallback((next: ResponseView) => {
    setView(next);
    setSelectedProvider(null);
    setQuery('');
  }, []);

  const actions = useMemo(() => ({
    'moves.open': () => undefined,
    'moves.decision.previous': () => {
      if (decisions.length < 2) return { unavailableReason: 'Fewer than two RBA decisions are rendered' };
      const index = Math.max(0, decisions.findIndex((decision) => decision.date === activeDate));
      const previous = decisions[Math.min(decisions.length - 1, index + 1)];
      if (previous) onDecisionChange(previous.date);
    },
    'moves.section.next': (parameters: unknown) => {
      const planned = actionSection(parameters);
      if (planned && availableSections.includes(planned)) {
        onSectionChange(planned);
        return;
      }
      const index = Math.max(0, availableSections.indexOf(section));
      onSectionChange(availableSections[(index + 1) % availableSections.length]);
    },
    'moves.response-chart.zoom-in': () => setChartZoom((current) => Math.min(3, current + 0.5)),
    'moves.response-chart.reset': () => setChartZoom(1),
    'moves.response-chart.provider.first': () => {
      const provider = rows[0]?.provider ?? null;
      if (!provider) return { unavailableReason: 'No lender point is rendered in the response chart' };
      onChartProviderSelect(provider);
    },
    'moves.sort.timing': () => setSort('timing'),
    'moves.query.provider': (value: unknown) => setQuery(actionParameter(value, 'query') ?? ''),
    'moves.filter.provider.clear': clearProviderFilter,
    'moves.patterns.open': () => changeView('patterns'),
    'moves.lender.open': (value: unknown) => {
      const provider = actionParameter(value, 'provider') ?? selectedProvider ?? rows[0]?.provider;
      if (provider) {
        openBank(provider);
        return { expectedPath: `/bank/${encodeURIComponent(provider)}` };
      }
      return { unavailableReason: 'No lender is rendered for drill-down' };
    },
  }), [activeDate, availableSections, changeView, clearProviderFilter, decisions, onChartProviderSelect, onDecisionChange, onSectionChange, rows, section, selectedProvider]);

  const auditSurface = usePerformanceAuditSurface({
    id: 'moves.response-chart',
    routeKey: '/rba-response',
    datasetRevision: payload.run_date,
    renderRevision,
    actions,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-insights',
    kind: 'data',
    status: model ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: 1,
    actualCount: model ? 1 : 0,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'lender-list',
    kind: 'list',
    status: model && listReadyRevision === renderRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: items.length,
    actualCount: listReadyRevision === renderRevision ? items.length : 0,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'response-chart-layout',
    kind: 'layout',
    status: model && layoutReadyRevision === payload.run_date ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'response-chart-graphic',
    kind: 'graphic',
    required: view === 'window' && hasWindowData,
    status: view !== 'window' || !hasWindowData || (model && layoutReadyRevision === payload.run_date && chartReadyRevision?.startsWith(`${model.decision.date}:${section}:${chartZoom}:`))
      ? 'ready'
      : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: sectionEligible,
    actualCount: chartPointCount,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-patterns',
    kind: 'list',
    required: view === 'patterns',
    status: view !== 'patterns' || listReadyRevision === renderRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: view === 'patterns' ? visibleProfiles.length : 0,
    actualCount: view === 'patterns' && listReadyRevision === renderRevision ? visibleProfiles.length : 0,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'visible-lender-logos',
    kind: 'logo',
    required: false,
    status: registerLogosLoaded ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: rows.length ? 1 : 0,
    actualCount: registerLogosLoaded && rows.length ? 1 : 0,
  });

  const renderItem = useCallback(
    ({ item }: { item: DashboardItem }) => item.kind === 'pattern'
      ? <BankPatternRow profile={item.profile} />
      : (
        <LenderResponseRow
          item={item.row}
          section={section}
          model={model!}
          selected={item.row.provider === selectedProvider}
        />
      ),
    [section, model, selectedProvider],
  );

  const staticHeader = useMemo(() => {
    if (!model) return null;
    return (
      <AnalysisHeader
        model={model}
        hasWindowData={hasWindowData}
        windowTracked={activeWindow?.tracked !== false}
        decisions={decisions}
        section={section}
        sectionOptions={sectionOptions}
        onSectionChange={onSectionChange}
        onDecisionChange={onDecisionChange}
      />
    );
  }, [activeWindow?.tracked, model, hasWindowData, decisions, section, sectionOptions, onSectionChange, onDecisionChange]);

  const compareControls = useMemo(
    () => (
      <>
        <SegmentedControl
          options={[
            { value: 'window', label: 'This window' },
            { value: 'patterns', label: 'Bank patterns' },
          ]}
          value={view}
          onChange={changeView}
        />
        <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 8, alignItems: 'flex-end' }}>
          <View>
            <AppText variant="h3">{view === 'window' ? 'Banks in this window' : 'How banks tend to respond'}</AppText>
            <AppText variant="tiny" color="textMuted">
              {view === 'patterns'
                ? `${patternDirection === 'hike' ? 'After cash-rate increases' : 'After cash-rate cuts'} · open evidence stays provisional`
                : selectedProvider
                ? `Showing ${selectedProvider} only`
                : `${SECTIONS[section].title} · advertised medians`}
            </AppText>
          </View>
          <Badge label={`${view === 'window' ? rows.length : visibleProfiles.length}`} tone="muted" />
        </Row>
        {view === 'window' && selectedProvider ? (
          <View style={{ marginBottom: 10 }}>
            <Chip
              label="Clear selection · show all banks"
              selected
              onPress={clearProviderFilter}
            />
          </View>
        ) : null}
        {view === 'patterns' ? (
          <Row gap={6} style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            <Chip
              label="After cuts"
              selected={patternDirection === 'cut'}
              onPress={() => setPatternDirection('cut')}
            />
            <Chip
              label="After increases"
              selected={patternDirection === 'hike'}
              onPress={() => setPatternDirection('hike')}
            />
          </Row>
        ) : null}
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search lenders" />
        {view === 'window' ? <Row gap={6} style={{ marginTop: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textFaint" weight="700">SORT</AppText>
          <Chip label="Response" selected={sort === 'response'} onPress={() => setSort('response')} />
          <Chip label="Timing" selected={sort === 'timing'} onPress={() => setSort('timing')} />
          <Chip label="Bank" selected={sort === 'bank'} onPress={() => setSort('bank')} />
        </Row> : (
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 8, marginBottom: 10 }}>
            General tendencies use complete past windows only. The open window is provisional and never lowers a bank's historical response rate.
          </AppText>
        )}
      </>
    ),
    [changeView, clearProviderFilter, patternDirection, query, rows.length, section, selectedProvider, sort, view, visibleProfiles.length],
  );

  const listHeader = useMemo(() => {
    if (!model || !staticHeader) return null;
    return (
      <>
        {staticHeader}
        {view === 'window' && hasWindowData ? <SpeedResponseCard
          model={model}
          section={section}
          decisions={[model.decision]}
          eligible={sectionEligible}
          selectedProvider={selectedProvider}
          onProviderSelect={onChartProviderSelect}
          zoom={chartZoom}
          onZoomChange={setChartZoom}
          onGraphicReady={onChartReady}
        /> : null}
        {compareControls}
      </>
    );
  }, [
    model,
    staticHeader,
    section,
    sectionEligible,
    selectedProvider,
    onChartProviderSelect,
    chartZoom,
    onChartReady,
    compareControls,
    hasWindowData,
    view,
  ]);

  if (!model) {
    return (
      <Card>
        <AppText variant="h3">No response window yet</AppText>
        <AppText variant="small" color="textMuted" style={{ marginTop: 6 }}>
          This view will activate when tracked bank history overlaps an RBA hike or cut.
        </AppText>
      </Card>
    );
  }

  return (
    <FlashList
      ref={listRef}
      data={items}
      extraData={`${view}:${selectedProvider ?? 'all'}`}
      keyExtractor={(item) => item.kind === 'window'
        ? `window:${item.row.provider}`
        : `pattern:${item.profile.provider}`}
      contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
      style={{ width: '100%', maxWidth: 860, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      onLayout={(event) => {
        if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
          setLayoutReadyRevision(payload.run_date);
        }
      }}
      onLoad={() => {
        setListMounted(true);
        setListReadyRevision(renderRevision);
      }}
      onContentSizeChange={() => setListReadyRevision(renderRevision)}
      ListHeaderComponent={listHeader}
      renderItem={renderItem}
      ListEmptyComponent={
        <Card>
          <AppText variant="small" color="textMuted">
            {view === 'patterns'
              ? 'No banks match that search.'
              : !hasWindowData
                ? 'No bank history overlaps this response window.'
              : selectedProvider
              ? 'No lenders match that search within the chart filter.'
              : 'No lenders match that search.'}
          </AppText>
        </Card>
      }
      ListFooterComponent={
        <Card style={{ marginTop: 6 }}>
          <AppText variant="tiny" color="textFaint">
            Based on advertised CDR rates, not individual customer rates. Product additions and removals can change provider medians. Mortgage fees and comparison rates, savings conditions, and TD term-market effects may not be reflected. General information only — not financial advice.
          </AppText>
        </Card>
      }
    />
  );
}
