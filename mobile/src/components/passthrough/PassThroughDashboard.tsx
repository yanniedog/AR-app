import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import React, { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SECTION_ORDER, SECTIONS } from '../../constants';
import { sectionSegmentOptions } from '../../data/interests';
import {
  rbaPassThroughDecisionList,
  rbaPassThroughMultiSection,
  type BankInsightsPayload,
  type MultiSectionPassThroughModel,
  type MultiSectionPassThroughRow,
  type PassThroughRow,
} from '../../data/bankInsights';
import { formatRunDate } from '../../data/format';
import {
  filterAndSortSectionRows,
  lenderResponseAccessibilityLabel,
  passThroughCustomerContext,
  passThroughEvidenceLabel,
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
import { AppText, Badge, Button, Card, Chip, Row } from '../ui';
import { ResponseScatter } from './ResponseScatter';

type LenderRow = MultiSectionPassThroughRow & { response: PassThroughRow };

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
  decisions,
  section,
  sectionOptions,
  onSectionChange,
  onDecisionChange,
}: {
  model: MultiSectionPassThroughModel;
  decisions: ReturnType<typeof rbaPassThroughDecisionList>;
  section: SectionKey;
  sectionOptions: ReturnType<typeof sectionSegmentOptions>;
  onSectionChange: (section: SectionKey) => void;
  onDecisionChange: (date: string) => void;
}) {
  const theme = useTheme();
  const summary = useMemo(() => summarizeSectionResponse(model, section), [model, section]);
  const direction = model.decision.bps > 0 ? 'raised' : 'cut';
  const partial = model.decision.partialObservation;
  const decisionIndex = Math.max(0, decisions.findIndex((decision) => decision.date === model.decision.date));
  const newerDecision = decisions[decisionIndex - 1];
  const olderDecision = decisions[decisionIndex + 1];
  return (
    <View>
      <Card variant="outlined" style={{ marginBottom: 14, overflow: 'hidden' }}>
        <AppText variant="small" color="textMuted">
          RBA decision · {formatRunDate(model.decision.date)}
        </AppText>
        <Row gap={8} style={{ marginTop: 4, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <AppText variant="h1">{model.decision.bps > 0 ? '+' : '−'}{Math.abs(model.decision.bps)} bp</AppText>
          <AppText variant="small" color="textMuted">cash-rate {direction}</AppText>
        </Row>
        <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          <Badge label={passThroughEvidenceLabel(model)} tone={partial ? 'warning' : model.windowOpen ? 'primary' : 'success'} />
        </View>
        <AppText variant="small" color="textMuted" style={{ marginTop: 10 }}>
          How advertised provider-median rates moved in the {model.windowDays}-day response window.
        </AppText>
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 5 }}>
          Observed through {formatRunDate(model.observedThrough)} · window {model.windowOpen ? 'open to' : 'closed'} {formatRunDate(model.windowEnd)}
        </AppText>
        {decisions.length > 1 ? (
          <Row gap={8} style={{ marginTop: 10 }}>
            <Button
              title="Earlier"
              variant="ghost"
              disabled={!olderDecision}
              onPress={() => olderDecision && onDecisionChange(olderDecision.date)}
              style={{ flex: 1 }}
            />
            <Button
              title="Later"
              variant="ghost"
              disabled={!newerDecision}
              onPress={() => newerDecision && onDecisionChange(newerDecision.date)}
              style={{ flex: 1 }}
            />
          </Row>
        ) : null}
      </Card>

      <SegmentedControl
        options={sectionOptions}
        value={section}
        onChange={onSectionChange}
      />

      <View style={{ marginTop: 14, marginBottom: 14, paddingHorizontal: 4 }}>
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <Ionicons
            name={partial ? 'flask-outline' : 'analytics-outline'}
            size={18}
            color={partial ? theme.colors.warning : theme.colors.primary}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="small" weight="700">
              {partial ? 'Early evidence, not a bank ranking' : `${SECTIONS[section].title} response`}
            </AppText>
            <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
              {partial
                ? 'This decision predates tracking. Movement and timing may be missing, so no full-pass or fastest claims are made.'
                : 'Provider medians are compared before and after the decision; the 100% line is context, not proof of causation.'}
            </AppText>
          </View>
        </Row>
      </View>

      <Row gap={10} style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <MetricTile label="Observed" value={`${summary.movedWithRba}/${summary.eligible}`} detail="moved with the RBA direction" />
        <MetricTile
          label="Typical move"
          value={summary.medianObservedBps == null ? '—' : `${summary.medianObservedBps} bp`}
          detail="median provider movement observed"
        />
        <MetricTile
          label="Typical timing"
          value={summary.medianDays == null ? '—' : `${partial ? '≤' : ''}${summary.medianDays}d`}
          detail="median first observed response"
        />
      </Row>
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
  decisions: ReturnType<typeof rbaPassThroughDecisionList>;
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
  const listRef = useRef<FlashListRef<LenderRow>>(null);
  const decisions = useMemo(
    () => rbaPassThroughDecisionList(payload, rba, { calendar }),
    [payload, rba, calendar],
  );
  useEffect(() => {
    if (initialDecisionDate) setSelectedDate(initialDecisionDate);
  }, [initialDecisionDate]);
  const activeDate = selectedDate && decisions.some((decision) => decision.date === selectedDate)
    ? selectedDate
    : decisions[0]?.date;
  const model = useMemo(
    () => rbaPassThroughMultiSection(payload, rba, { calendar, decisionDate: activeDate }),
    [payload, rba, calendar, activeDate],
  );
  const rows = useMemo(
    () =>
      model
        ? filterAndSortSectionRows(model, section, query, sort, selectedProvider)
        : [],
    [model, section, query, sort, selectedProvider],
  );
  const sectionEligible = useMemo(
    () => (model ? summarizeSectionResponse(model, section).eligible : 0),
    [model, section],
  );
  const renderRevision = `${payload.run_date}:${activeDate ?? 'none'}:${section}:${query}:${sort}:${selectedProvider ?? 'all'}:${chartZoom}`;
  useEffect(() => {
    if (!listMounted || !model) return;
    const frame = requestAnimationFrame(() => setListReadyRevision(renderRevision));
    return () => cancelAnimationFrame(frame);
  }, [listMounted, model, renderRevision, rows]);

  const onSectionChange = useCallback((next: SectionKey) => {
    if (controlledSection == null) setLocalSection(next);
    controlledSectionChange?.(next);
    setSelectedProvider(null);
  }, [controlledSection, controlledSectionChange]);

  const onDecisionChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedProvider(null);
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
    'moves.lender.open': (value: unknown) => {
      const provider = actionParameter(value, 'provider') ?? selectedProvider ?? rows[0]?.provider;
      if (provider) {
        openBank(provider);
        return { expectedPath: `/bank/${encodeURIComponent(provider)}` };
      }
      return { unavailableReason: 'No lender is rendered for drill-down' };
    },
  }), [activeDate, availableSections, clearProviderFilter, decisions, onChartProviderSelect, onDecisionChange, onSectionChange, rows, section, selectedProvider]);

  const auditSurface = usePerformanceAuditSurface({
    id: 'moves.response-chart',
    routeKey: '/passthrough',
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
    expectedCount: rows.length,
    actualCount: listReadyRevision === renderRevision ? rows.length : 0,
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
    status: model && layoutReadyRevision === payload.run_date && chartReadyRevision?.startsWith(`${model.decision.date}:${section}:${chartZoom}:`)
      ? 'ready'
      : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: sectionEligible,
    actualCount: chartPointCount,
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
    ({ item }: { item: LenderRow }) => (
      <LenderResponseRow
        item={item}
        section={section}
        model={model!}
        selected={item.provider === selectedProvider}
      />
    ),
    [section, model, selectedProvider],
  );

  const staticHeader = useMemo(() => {
    if (!model) return null;
    return (
      <AnalysisHeader
        model={model}
        decisions={decisions}
        section={section}
        sectionOptions={sectionOptions}
        onSectionChange={onSectionChange}
        onDecisionChange={onDecisionChange}
      />
    );
  }, [model, decisions, section, sectionOptions, onSectionChange, onDecisionChange]);

  const compareControls = useMemo(
    () => (
      <>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-end' }}>
          <View>
            <AppText variant="h3">Compare lenders</AppText>
            <AppText variant="tiny" color="textMuted">
              {selectedProvider
                ? `Showing ${selectedProvider} only`
                : 'Home loans · Savings · Term deposits'}
            </AppText>
          </View>
          <Badge label={`${rows.length}`} tone="muted" />
        </Row>
        {selectedProvider ? (
          <View style={{ marginBottom: 10 }}>
            <Chip
              label="Clear selection · show all banks"
              selected
              onPress={clearProviderFilter}
            />
          </View>
        ) : null}
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search lenders" />
        <Row gap={6} style={{ marginTop: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textFaint" weight="700">SORT</AppText>
          <Chip label="Response" selected={sort === 'response'} onPress={() => setSort('response')} />
          <Chip label="Timing" selected={sort === 'timing'} onPress={() => setSort('timing')} />
          <Chip label="Bank" selected={sort === 'bank'} onPress={() => setSort('bank')} />
        </Row>
      </>
    ),
    [rows.length, query, sort, selectedProvider, clearProviderFilter],
  );

  const listHeader = useMemo(() => {
    if (!model || !staticHeader) return null;
    return (
      <>
        {staticHeader}
        <SpeedResponseCard
          model={model}
          section={section}
          decisions={decisions}
          eligible={sectionEligible}
          selectedProvider={selectedProvider}
          onProviderSelect={onChartProviderSelect}
          zoom={chartZoom}
          onZoomChange={setChartZoom}
          onGraphicReady={onChartReady}
        />
        {compareControls}
      </>
    );
  }, [
    model,
    staticHeader,
    section,
    decisions,
    sectionEligible,
    selectedProvider,
    onChartProviderSelect,
    chartZoom,
    onChartReady,
    compareControls,
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
      data={rows}
      extraData={selectedProvider}
      keyExtractor={(item) => item.provider}
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
            {selectedProvider
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
