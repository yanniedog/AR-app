import Ionicons from '../icons/AppIcon';
import { FlashList } from '@shopify/flash-list';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { BankInsightsPayload } from '../../data/bankInsights';
import { buildCompactBankResponseWindows, bankResponseDecisionLabel, type CompactBankResponseRow } from '../../data/bankResponseModel';
import { buildBankSpreadChartModel, type BankSpreadHistoryPayload } from '../../data/bankSpreadHistory';
import { resolveBrandShort } from '../../data/bankBrand';
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
import { AppText, Button, Card, Row } from '../ui';
import { MortgageSavingsSpreadChart } from './MortgageSavingsSpreadChart';

const SECTIONS = [
  { value: 'Mortgage' as const, label: 'Mortgage' },
  { value: 'Savings' as const, label: 'Savings' },
  { value: 'TD' as const, label: 'Term deposits' },
];

function DecisionArrow({ newer, onPress }: { newer: boolean; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={newer ? 'Newer RBA decision' : 'Older RBA decision'}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
  >
    <Ionicons name={newer ? 'chevron-forward' : 'chevron-back'} size={20} color={theme.colors.text} />
  </Pressable>;
}

const CompactRow = memo(function CompactRow({ row }: { row: CompactBankResponseRow }) {
  const theme = useTheme();
  const brand = useStore((state) => state.core?.brands?.[row.provider]);
  const short = resolveBrandShort(row.provider, brand?.short).toUpperCase().slice(0, 5);
  const move = row.movePp == null ? '—' : `${row.movePp > 0 ? '+' : row.movePp < 0 ? '−' : ''}${Math.abs(row.movePp).toFixed(2)} pp`;
  const after = row.daysAfter == null ? '—' : `${row.daysAfter}d`;
  return <View
    accessible
    accessibilityLabel={`${row.provider}. First observed move ${row.movePp == null ? 'not observed' : move}, ${row.daysAfter == null ? 'timing unavailable' : `${row.daysAfter} days after the decision`}.`}
    style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border }}
  >
    <Row gap={7} style={{ width: '54%', minWidth: 0 }}>
      <BankAvatar provider={row.provider} size={20} />
      <View style={{ minWidth: 0, flex: 1 }}>
        <AppText variant="tiny" weight="800">{short}</AppText>
        <AppText variant="tiny" color="textMuted" numberOfLines={1}>{row.provider}</AppText>
      </View>
    </Row>
    <AppText variant="tiny" weight="700" style={{ width: '28%', textAlign: 'right' }}>{move}</AppText>
    <AppText variant="tiny" color="textMuted" style={{ width: '18%', textAlign: 'right' }}>{after}</AppText>
  </View>;
});

export function BankResponseDashboard({
  payload, spreadHistory, calendar, initialDecisionDate, initialSection = 'Mortgage', spreadError, onRetrySpread,
}: {
  payload: BankInsightsPayload;
  spreadHistory: BankSpreadHistoryPayload | null;
  calendar: RbaCalendar | null;
  initialDecisionDate?: string | null;
  initialSection?: SectionKey;
  spreadError?: string | null;
  onRetrySpread?: () => void;
}) {
  const [section, setSection] = useState<SectionKey>(initialSection);
  const windows = useMemo(() => buildCompactBankResponseWindows(payload, calendar, section), [calendar, payload, section]);
  const initialIndex = Math.max(0, windows.findIndex((window) => window.decision.date === initialDecisionDate));
  const [decisionIndex, setDecisionIndex] = useState(initialIndex);
  const active = windows[Math.min(decisionIndex, Math.max(0, windows.length - 1))];
  const spreadModel = useMemo(() => spreadHistory ? buildBankSpreadChartModel(spreadHistory, calendar) : null, [calendar, spreadHistory]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [listMounted, setListMounted] = useState(false);
  const [listReadyRevision, setListReadyRevision] = useState<string | null>(null);
  const [layoutReadyRevision, setLayoutReadyRevision] = useState<string | null>(null);
  const [chartMounted, setChartMounted] = useState(false);
  const [chartReadyRevision, setChartReadyRevision] = useState<string | null>(null);
  useEffect(() => setSection(initialSection), [initialSection]);
  useEffect(() => {
    if (!spreadModel?.lines.length) return;
    if (!spreadModel.lines.some((line) => line.provider === selectedProvider)) setSelectedProvider(spreadModel.lines[0].provider);
  }, [selectedProvider, spreadModel]);
  useEffect(() => setDecisionIndex(0), [section]);
  useEffect(() => {
    if (!initialDecisionDate) return;
    const index = windows.findIndex((window) => window.decision.date === initialDecisionDate);
    if (index >= 0) setDecisionIndex(index);
  }, [initialDecisionDate, windows]);
  const renderRevision = `${payload.run_date}:${section}:${active?.decision.date ?? 'none'}:${selectedProvider || 'none'}`;
  useEffect(() => {
    if (!listMounted || !active) return;
    const frame = requestAnimationFrame(() => {
      setListReadyRevision(renderRevision);
      setLayoutReadyRevision(renderRevision);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, listMounted, renderRevision]);
  useEffect(() => {
    if (!spreadModel || !selectedProvider) {
      setChartMounted(false);
      setChartReadyRevision(null);
      return;
    }
    if (!chartMounted) return;
    const frame = requestAnimationFrame(() => setChartReadyRevision(renderRevision));
    return () => cancelAnimationFrame(frame);
  }, [chartMounted, renderRevision, selectedProvider, spreadModel]);

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
      const requestedSection = SECTIONS.find((option) => option.value === requested)?.value;
      if (requestedSection && requestedSection !== section) {
        setSection(requestedSection);
        return;
      }
      const index = Math.max(0, SECTIONS.findIndex((option) => option.value === section));
      setSection(SECTIONS[(index + 1) % SECTIONS.length].value);
    },
    'moves.response-chart.provider.next': () => {
      if (!spreadModel?.lines.length) {
        return { unavailableReason: 'Mortgage-savings history is unavailable' };
      }
      if (spreadModel.lines.length < 2) {
        return { unavailableReason: 'Only one eligible bank is available in the chart' };
      }
      const index = Math.max(0, spreadModel.lines.findIndex((line) => line.provider === selectedProvider));
      setSelectedProvider(spreadModel.lines[(index + 1) % spreadModel.lines.length].provider);
      return undefined;
    },
  }), [decisionIndex, section, selectedProvider, spreadModel, windows]);
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
    status: active && listReadyRevision === renderRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: active?.rows.length ?? 0,
    actualCount: active && listReadyRevision === renderRevision ? active.rows.length : 0,
    emptyStateRendered: active?.rows.length === 0 && listReadyRevision === renderRevision,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-response-layout',
    kind: 'layout',
    status: active && layoutReadyRevision === renderRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    layoutMeasured: layoutReadyRevision === renderRevision,
  });
  const selectedLine = spreadModel?.lines.find((line) => line.provider === selectedProvider) ?? null;
  usePerformanceAuditProbe(auditSurface, {
    id: 'mortgage-savings-chart',
    kind: 'graphic',
    required: false,
    status: !selectedLine || chartReadyRevision === renderRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    expectedCount: selectedLine?.points.length ?? 0,
    actualCount: selectedLine && chartReadyRevision === renderRevision ? selectedLine.points.length : 0,
    accessibleSummary: Boolean(selectedLine && chartReadyRevision === renderRevision),
  });
  if (!active) return <Card><AppText>No recorded RBA decisions overlap the available history.</AppText></Card>;

  const header = <View style={{ gap: 12, paddingBottom: 10 }}>
    <Card>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <DecisionArrow newer={false} onPress={() => setDecisionIndex((index) => Math.min(windows.length - 1, index + 1))} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="tiny" color="textMuted">{active.decision.date}</AppText>
          <AppText variant="h2" style={{ textAlign: 'center' }}>{bankResponseDecisionLabel(active.decision)}</AppText>
          <AppText variant="tiny" color="textMuted">
            {active.partialHistory
              ? `Partial history from ${active.observationStart}`
              : active.open
                ? `Observed to ${active.observedThrough}`
                : `Window ended ${active.windowEnd}`}
          </AppText>
        </View>
        <DecisionArrow newer onPress={() => setDecisionIndex((index) => Math.max(0, index - 1))} />
      </Row>
    </Card>
    {spreadModel && selectedProvider ? <>
      <View>
        <AppText variant="h3">Mortgage–savings gap</AppText>
        <AppText variant="tiny" color="textMuted">Provider means · percentage points</AppText>
      </View>
      <View
        onLayout={(event) => {
          if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
            setChartMounted(true);
            setChartReadyRevision(renderRevision);
          }
        }}
      >
        <MortgageSavingsSpreadChart model={spreadModel} selectedProvider={selectedProvider} onSelectedProviderChange={setSelectedProvider} />
      </View>
    </> : <Card variant="outlined" style={{ gap: 8 }}>
      <AppText variant="small" weight="700">
        {spreadError ? 'Mortgage–savings history unavailable' : 'Mortgage–savings history is building'}
      </AppText>
      <AppText variant="tiny" color="textMuted">The bank response table remains available.</AppText>
      {spreadError && onRetrySpread ? (
        <Button title="Retry history" icon="refresh" variant="secondary" onPress={onRetrySpread} />
      ) : null}
    </Card>}
    <Card variant="outlined">
      <AppText variant="small" weight="700">What this can show</AppText>
      <AppText variant="tiny" color="textMuted" style={{ marginTop: 4 }}>
        A wider mortgage–savings gap can reveal asymmetric repricing. It does not prove intent or measure funding costs, margins or individual pricing.
      </AppText>
    </Card>
    <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
    <View>
      <AppText variant="h3">Bank Response</AppText>
      <AppText variant="tiny" color="textMuted">
        First observed advertised product move after this {active.decision.outcome}. Banks are listed A–Z.
      </AppText>
    </View>
    <View style={{ flexDirection: 'row', paddingBottom: 5 }}>
      <AppText variant="tiny" color="textFaint" weight="800" style={{ width: '54%' }}>BANK</AppText>
      <AppText variant="tiny" color="textFaint" weight="800" style={{ width: '28%', textAlign: 'right' }}>MOVE</AppText>
      <AppText variant="tiny" color="textFaint" weight="800" style={{ width: '18%', textAlign: 'right' }}>AFTER</AppText>
    </View>
  </View>;
  return <FlashList
    data={active.rows}
    extraData={renderRevision}
    keyExtractor={(row) => row.provider}
    renderItem={({ item }) => <CompactRow row={item} />}
    ListHeaderComponent={header}
    ListEmptyComponent={
      <Card variant="outlined">
        <AppText variant="small" color="textMuted">No bank moves were observed in this response window.</AppText>
      </Card>
    }
    contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
    onLayout={(event) => {
      if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
        setLayoutReadyRevision(renderRevision);
      }
    }}
    onLoad={() => {
      setListMounted(true);
      setListReadyRevision(renderRevision);
    }}
    onContentSizeChange={() => setListReadyRevision(renderRevision)}
  />;
}
