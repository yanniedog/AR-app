import { sectionSegmentOptions } from '../../data/interests';
import Ionicons from '../icons/AppIcon';
import { FlashList } from '@shopify/flash-list';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { FLASH_LIST_DRAW_DISTANCE, FLASH_LIST_VIEWABILITY_CONFIG } from '../../lib/flashListDefaults';
import type { BankInsightsPayload } from '../../data/bankInsights';
import { buildCompactBankResponseWindows, type CompactBankResponseRow } from '../../data/bankResponseModel';
import type { BankRateChartModel } from '../../data/bankRateOverview';
import type { RbaCalendar } from '../../data/rbaCalendar';
import { useStore } from '../../data/store';
import {
  usePerformanceAuditProbe,
  usePerformanceAuditSurface,
} from '../../hooks/usePerformanceAuditReadiness';
import { auditActionString } from '../../lib/performanceAuditActionParams';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { SegmentedControl } from '../controls';
import { responsiveScreenContentStyle } from '../Screen';
import { AppText, Row } from '../ui';
import { BankRatesPanel, type BankRatesAuditState } from './BankRatesPanel';
import { uiLabel,  uiDate, uiJoin, uiProviderName } from '../../lib/uiCopy';
import { uiChartBps, uiChartPercent, uiChartPp, uiResponseDays } from '../../lib/chartUiCopy';
import { yieldToPaintFrames } from '../../lib/yieldToUi';

function DecisionArrow({ newer, disabled, onPress }: { newer: boolean; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={newer ? 'Next date' : 'Previous date'}
    accessibilityState={{ disabled }}
    disabled={disabled}
    style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
  >
    <Ionicons name={newer ? 'chevron-forward' : 'chevron-back'} size={20} color={theme.colors.text} />
  </Pressable>;
}

const CompactRow = memo(function CompactRow({ row }: { row: CompactBankResponseRow }) {
  const theme = useTheme();
  const move = uiChartPp(row.movePp);
  const after = uiResponseDays(row.daysAfter);
  return <View
    accessible
    accessibilityLabel={uiJoin(uiProviderName(row), ' · ', 'First move', ' · ', move, ' · ', 'After', ' · ', after)}
    style={{ minHeight: 64, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border }}
  >
    <Row gap={7} style={{ width: '54%', minWidth: 0 }}>
      <BankAvatar provider={row.provider} size={28} />
      <AppText variant="small" weight="600" style={{ minWidth: 0, flex: 1 }}>{uiProviderName(row)}</AppText>
    </Row>
    <AppText variant="small" weight="600" style={{ width: '28%', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{move}</AppText>
    <AppText variant="small" color="textMuted" style={{ width: '18%', textAlign: 'right' }}>{after}</AppText>
  </View>;
});

export function BankResponseDashboard({
  payload, calendar, initialDecisionDate, initialSection = 'Mortgage',
}: {
  payload: BankInsightsPayload;
  calendar: RbaCalendar | null;
  initialDecisionDate?: string | null;
  initialSection?: SectionKey;
}) {
  const { width } = useWindowDimensions();
  const interests = useStore(state => state.prefs.interests);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const [section, setSection] = useState<SectionKey>(initialSection);
  useEffect(() => { if (!sectionOptions.some(option => option.value === section)) setSection(sectionOptions[0].value); }, [section, sectionOptions]);
  const windows = useMemo(() => buildCompactBankResponseWindows(payload, calendar, section), [calendar, payload, section]);
  const initialIndex = Math.max(0, windows.findIndex((window) => window.decision.date === initialDecisionDate));
  const [decisionIndex, setDecisionIndex] = useState(initialIndex);
  const active = windows[Math.min(decisionIndex, Math.max(0, windows.length - 1))];
  const [chartModel, setChartModel] = useState<BankRateChartModel | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [listMounted, setListMounted] = useState(false);
  const [listReadyRevision, setListReadyRevision] = useState<string | null>(null);
  const [layoutReadyRevision, setLayoutReadyRevision] = useState<string | null>(null);
  const [chartAuditState, setChartAuditState] = useState<BankRatesAuditState | null>(null);
  useEffect(() => setSection(initialSection), [initialSection]);
  useEffect(() => {
    if (!chartModel?.lines.length) return;
    if (!chartModel.lines.some((line) => line.provider === selectedProvider)) setSelectedProvider(chartModel.lines[0].provider);
  }, [selectedProvider, chartModel]);
  useEffect(() => setDecisionIndex(0), [section]);
  useEffect(() => {
    if (!initialDecisionDate) return;
    const index = windows.findIndex((window) => window.decision.date === initialDecisionDate);
    if (index >= 0) setDecisionIndex(index);
  }, [initialDecisionDate, windows]);
  // Provider changes belong to the chart. Folding them into the list revision
  // sent search/list probes back to pending after the table had already painted.
  const listRevision = `${payload.run_date}:${section}:${active?.decision.date ?? 'none'}`;
  const renderRevision = listRevision;
  const [chartMounted, setChartMounted] = useState(false);
  useEffect(() => {
    if (active && !listMounted) return;
    let alive = true;
    void (async () => {
      await yieldToPaintFrames(1);
      if (alive) setChartMounted(true);
    })();
    return () => { alive = false; };
  }, [active, listMounted, listRevision]);
  useEffect(() => {
    if (!listMounted || !active) return;
    const frame = requestAnimationFrame(() => {
      setListReadyRevision(current => current === listRevision ? current : listRevision);
      setLayoutReadyRevision(current => current === listRevision ? current : listRevision);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, listMounted, listRevision]);

  const actions = useMemo(() => ({
    'moves.open': () => undefined,
    'moves.decision.previous': () => {
      if (decisionIndex >= windows.length - 1) {
        return { unavailableReason: 'No older RBA decision is available' };
      }
      setDecisionIndex((index) => Math.min(windows.length - 1, index + 1));
      return undefined;
    },
    'moves.section.next': (...args: unknown[]) => {
      const requested = auditActionString(args, 'section');
      const requestedSection = sectionOptions.find((option) => option.value === requested)?.value;
      if (requestedSection && requestedSection !== section) {
        setSection(requestedSection);
        return;
      }
      const index = Math.max(0, sectionOptions.findIndex((option) => option.value === section));
      setSection(sectionOptions[(index + 1) % sectionOptions.length].value);
    },
    'moves.response-chart.provider.next': () => {
      if (!chartModel?.lines.length) {
        return { unavailableReason: 'Matching rate history is unavailable' };
      }
      if (chartModel.lines.length < 2) {
        return { unavailableReason: 'Only one eligible bank is available in the chart' };
      }
      const index = Math.max(0, chartModel.lines.findIndex((line) => line.provider === selectedProvider));
      setChartAuditState(null);
      setSelectedProvider(chartModel.lines[(index + 1) % chartModel.lines.length].provider);
      return undefined;
    },
  }), [decisionIndex, section, sectionOptions, selectedProvider, chartModel, windows]);
  const auditSurface = usePerformanceAuditSurface({
    id: 'moves.response-chart',
    routeKey: '/rba-response',
    datasetRevision: payload.run_date,
    renderRevision,
    actions,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-response-data',
    kind: 'data',
    status: active ? 'ready' : 'error',
    error: active ? null : 'No recorded RBA decision overlaps the available bank history',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: 1,
    actualCount: active ? 1 : 0,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-response-list',
    kind: 'list',
    status: active && listReadyRevision === listRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: active?.rows.length ?? 0,
    actualCount: active && listReadyRevision === listRevision ? active.rows.length : 0,
    emptyStateRendered: active?.rows.length === 0 && listReadyRevision === listRevision,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-response-layout',
    kind: 'layout',
    status: active && layoutReadyRevision === listRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    layoutMeasured: layoutReadyRevision === listRevision,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-rates-chart',
    kind: 'graphic',
    required: false,
    status: chartAuditState?.status ?? 'pending', error: chartAuditState?.error,
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: chartAuditState?.modelPointCount ?? 0,
    actualCount: chartAuditState?.renderedPointCount ?? 0,
    accessibleSummary: chartAuditState?.accessibleSummary ?? false,
    layoutMeasured: chartAuditState?.layoutMeasured ?? false,
    emptyStateRendered: chartAuditState?.emptyStateRendered ?? false,
  });
  const overview = chartMounted
    ? <BankRatesPanel section={section} onSectionChange={setSection} selectedProvider={selectedProvider} onProviderChange={setSelectedProvider} onModelChange={setChartModel} onAuditStateChange={setChartAuditState} />
    : null;
  if (!active) return <ScrollView contentContainerStyle={{ ...responsiveScreenContentStyle(width), paddingVertical: 24, gap: 28 }}>{overview}<AppText>{uiLabel("No observations")}</AppText></ScrollView>;

  const header = <View style={{ gap: 28, paddingBottom: 16 }}>
    {overview}
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <AppText variant="h2" accessibilityRole="header">{uiLabel("Response")}</AppText>
        <AppText variant="small" color="textMuted">
          {uiJoin('Basis', ' · ', 'First move', ' · ', 'Advertised rate')}
        </AppText>
      </View>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <DecisionArrow newer={false} disabled={decisionIndex >= windows.length - 1} onPress={() => setDecisionIndex((index) => Math.min(windows.length - 1, index + 1))} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="tiny" color="textMuted">{uiDate(active.decision.date)}</AppText>
          <AppText variant="h3" style={{ textAlign: 'center' }}>{uiJoin(uiChartBps(active.decision.delta_bps), ' · ', uiChartPercent(active.decision.rate))}</AppText>
          <AppText variant="tiny" color="textMuted">
            {uiJoin(active.partialHistory ? 'Partial' : active.open ? 'Open window' : 'Closed window', ' · ', active.partialHistory ? uiDate(active.observationStart) : active.open ? uiDate(active.observedThrough) : uiDate(active.windowEnd))}
          </AppText>
        </View>
        <DecisionArrow newer disabled={decisionIndex <= 0} onPress={() => setDecisionIndex((index) => Math.max(0, index - 1))} />
      </Row>
      <SegmentedControl options={sectionOptions} value={section} onChange={setSection} />
    </View>
    <View style={{ flexDirection: 'row', paddingBottom: 5 }}>
      <AppText variant="tiny" color="textFaint" weight="600" style={{ width: '54%' }}>{uiLabel("Bank A–Z")}</AppText>
      <AppText variant="tiny" color="textFaint" weight="600" style={{ width: '28%', textAlign: 'right' }}>{uiLabel("Changes")}</AppText>
      <AppText variant="tiny" color="textFaint" weight="600" style={{ width: '18%', textAlign: 'right' }}>{uiLabel("After")}</AppText>
    </View>
  </View>;
  return <View style={{ ...responsiveScreenContentStyle(width), flex: 1 }}><FlashList
    data={active.rows}
    drawDistance={FLASH_LIST_DRAW_DISTANCE}
    viewabilityConfig={FLASH_LIST_VIEWABILITY_CONFIG}
    extraData={renderRevision}
    keyExtractor={(row) => row.provider}
    renderItem={({ item }) => <CompactRow row={item} />}
    ListHeaderComponent={header}
    ListEmptyComponent={
      <AppText variant="small" color="textMuted">{uiLabel("No observed move")}</AppText>
    }
    contentContainerStyle={{ paddingTop: 24, paddingBottom: 36 }}
    onLayout={(event) => {
      // A positive list layout means the table or its empty state is on screen.
      // onLoad can lag the chart mount; waiting for it left list and layout
      // pending after the rows were already visible.
      if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
        setListMounted(true);
        setLayoutReadyRevision(current => current === listRevision ? current : listRevision);
        setListReadyRevision(current => current === listRevision ? current : listRevision);
      }
    }}
    onLoad={() => {
      setListMounted(true);
      setListReadyRevision(current => current === listRevision ? current : listRevision);
    }}
    onContentSizeChange={() => setListReadyRevision(current => current === listRevision ? current : listRevision)}
  /></View>;
}
