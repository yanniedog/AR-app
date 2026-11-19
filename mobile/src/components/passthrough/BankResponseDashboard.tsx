import { router } from 'expo-router';
import { orderProviders } from '../../data/bankGroups';
import { sectionSegmentOptions } from '../../data/interests';
import Ionicons from '../icons/AppIcon';
import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { FLASH_LIST_DRAW_DISTANCE, FLASH_LIST_VIEWABILITY_CONFIG } from '../../lib/flashListDefaults';
import type { BankInsightsPayload } from '../../data/bankInsights';
import { bankResponseStatus, buildCompactBankResponseWindows, type BankResponseStatus, type CompactBankResponseRow } from '../../data/bankResponseModel';
import type { RbaCalendar } from '../../data/rbaCalendar';
import { useStore } from '../../data/store';
import {
  usePerformanceAuditProbe,
  usePerformanceAuditSurface,
} from '../../hooks/usePerformanceAuditReadiness';
import { useSavedProviders } from '../../hooks/useSavedProviders';
import { openBank } from '../../lib/nav';
import { auditActionString } from '../../lib/performanceAuditActionParams';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { SearchBar, SegmentedControl } from '../controls';
import { responsiveScreenContentStyle } from '../Screen';
import { AppText, Badge, Button, Row } from '../ui';
import { uiLabel, uiDate, uiJoin, uiProviderName, useProviderSearchInput } from '../../lib/uiCopy';
import { uiChartPp, uiChartPercent, uiBankResponseMove, uiBankResponseStatus, uiBankResponseTiming } from '../../lib/chartUiCopy';

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

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

const CompactRow = memo(function CompactRow({ row, status, open, saved, decisionDate, section }: {
  row: CompactBankResponseRow; status: BankResponseStatus | null; open: boolean; saved: boolean;
  decisionDate: string; section: SectionKey;
}) {
  const theme = useTheme();
  const move = uiBankResponseMove(row);
  const after = uiBankResponseTiming(row);
  const statusLabel = status ? uiBankResponseStatus(status, open) : null;
  const unverified = row.movePp != null && !row.evidence.firstMoveVerified;
  const onPress = useCallback(() => openBank(row.provider, row.daysAfter != null
    ? { date: addDays(decisionDate, row.daysAfter), section }
    : { section }), [decisionDate, row.daysAfter, row.provider, section]);
  return <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={uiJoin(uiProviderName(row), saved ? uiJoin(' · ', 'Saved') : null, statusLabel ? uiJoin(' · ', statusLabel) : null,
      ' · ', 'First move', ' · ', move, ' · ', 'After', ' · ', after, unverified ? uiJoin(' · ', 'Unverified') : null)}
    style={{ minHeight: 64, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: theme.colors.border }}
  >
    <Row gap={7} style={{ flex: 1, minWidth: 0 }}>
      <BankAvatar provider={row.provider} size={28} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Row gap={4} style={{ minWidth: 0 }}>
          {saved ? <Ionicons name="star" size={12} color={theme.colors.primary} /> : null}
          <AppText variant="small" weight="600" numberOfLines={1} style={{ minWidth: 0, flexShrink: 1 }}>{uiProviderName(row)}</AppText>
        </Row>
        {statusLabel || unverified ? <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {statusLabel ? <Badge label={statusLabel} tone={status === 'full' ? 'primary' : status === 'opposite' ? 'warning' : 'muted'} /> : null}
          {unverified ? <Badge label="Unverified" tone="warning" /> : null}
        </Row> : null}
      </View>
    </Row>
    <AppText variant="small" weight="600" style={{ width: '24%', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{move}</AppText>
    <AppText variant="small" color="textMuted" style={{ width: '18%', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{after}</AppText>
  </Pressable>;
});

export function BankResponseDashboard({
  payload, sourcePayload, calendar, initialDecisionDate, initialSection = 'Mortgage',
}: {
  payload: BankInsightsPayload;
  sourcePayload?: BankInsightsPayload | null;
  calendar: RbaCalendar | null;
  initialDecisionDate?: string | null;
  initialSection?: SectionKey;
}) {
  const { width } = useWindowDimensions();
  const saved = useSavedProviders();
  const { value: query, raw: queryText, onChangeText: setQuery } = useProviderSearchInput();
  const interests = useStore(state => state.prefs.interests);
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const [section, setSection] = useState<SectionKey>(initialSection);
  useEffect(() => { if (!sectionOptions.some(option => option.value === section)) setSection(sectionOptions[0].value); }, [section, sectionOptions]);
  const [selectedDecisionIndex, setSelectedDecisionIndex] = useState<number | null>(null);
  const windows = useMemo(
    () => buildCompactBankResponseWindows(
      payload,
      calendar,
      section,
      sourcePayload,
      selectedDecisionIndex === null
        ? { activeIndex: 0, activeDecisionDate: initialDecisionDate }
        : { activeIndex: selectedDecisionIndex },
    ),
    [calendar, initialDecisionDate, payload, section, selectedDecisionIndex, sourcePayload],
  );
  const initialIndex = Math.max(0, windows.findIndex((window) => window.decision.date === initialDecisionDate));
  const decisionIndex = selectedDecisionIndex ?? initialIndex;
  const active = windows[Math.min(decisionIndex, Math.max(0, windows.length - 1))];
  const rows = useMemo(
    () => active ? orderProviders(active.rows, (row) => row.provider, saved, queryText) : [],
    [active, queryText, saved],
  );
  const [listMounted, setListMounted] = useState(false);
  const [listReadyRevision, setListReadyRevision] = useState<string | null>(null);
  const [layoutReadyRevision, setLayoutReadyRevision] = useState<string | null>(null);
  useEffect(() => setSection(initialSection), [initialSection]);
  const appliedInitialDateRef = useRef<string | null>(null);
  const lastSectionRef = useRef<SectionKey>(section);
  useEffect(() => {
    if (lastSectionRef.current === section) return;
    lastSectionRef.current = section;
    appliedInitialDateRef.current = null;
    setSelectedDecisionIndex(0);
  }, [section]);
  useEffect(() => {
    if (!initialDecisionDate) return;
    const key = `${section}:${initialDecisionDate}`;
    if (appliedInitialDateRef.current === key) return;
    const index = windows.findIndex((window) => window.decision.date === initialDecisionDate);
    if (index >= 0) {
      appliedInitialDateRef.current = key;
      setSelectedDecisionIndex(index);
    }
  }, [initialDecisionDate, section, windows]);
  const listRevision = `${payload.run_date}:${section}:${active?.decision.date ?? 'none'}:${queryText.trim().toLowerCase()}`;
  const renderRevision = listRevision;
  useEffect(() => {
    if (!listMounted || !active) return;
    const frame = requestAnimationFrame(() => {
      setListReadyRevision(current => current === listRevision ? current : listRevision);
      setLayoutReadyRevision(current => current === listRevision ? current : listRevision);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, listMounted, listRevision]);

  const openBankRates = useCallback(() => router.push({ pathname: '/bank-rates', params: { section } }), [section]);
  const actions = useMemo(() => ({
    'moves.open': () => undefined,
    'moves.decision.previous': () => {
      if (decisionIndex >= windows.length - 1) {
        return { unavailableReason: 'No older RBA decision is available' };
      }
      setSelectedDecisionIndex((index) => Math.min(windows.length - 1, (index ?? decisionIndex) + 1));
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
    'moves.bank-rates.open': openBankRates,
  }), [decisionIndex, openBankRates, section, sectionOptions, windows]);
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
    expectedCount: rows.length,
    actualCount: active && listReadyRevision === listRevision ? rows.length : 0,
    emptyStateRendered: rows.length === 0 && listReadyRevision === listRevision,
  });
  usePerformanceAuditProbe(auditSurface, {
    id: 'bank-response-layout',
    kind: 'layout',
    status: active && layoutReadyRevision === listRevision ? 'ready' : 'pending',
    datasetRevision: payload.run_date,
    renderRevision,
    layoutMeasured: layoutReadyRevision === listRevision,
  });

  if (!active) return <ScrollView contentContainerStyle={{ ...responsiveScreenContentStyle(width), paddingVertical: 24, gap: 28 }}>
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <AppText variant="h2" accessibilityRole="header">{uiLabel("Response")}</AppText>
      <Button title="Bank rates" variant="secondary" onPress={openBankRates} />
    </Row>
    <AppText>{uiLabel("No observations")}</AppText>
  </ScrollView>;

  const header = <View style={{ gap: 28, paddingBottom: 16 }}>
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <AppText variant="h2" accessibilityRole="header">{uiLabel("Response")}</AppText>
          <Button title="Bank rates" variant="secondary" onPress={openBankRates} />
        </Row>
      </View>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <DecisionArrow newer={false} disabled={decisionIndex >= windows.length - 1} onPress={() => setSelectedDecisionIndex((index) => Math.min(windows.length - 1, (index ?? decisionIndex) + 1))} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="tiny" color="textMuted">{uiDate(active.decision.date)}</AppText>
          <AppText variant="h3" style={{ textAlign: 'center' }}>{uiJoin(active.decision.delta_bps ? uiChartPp(active.decision.delta_bps / 100) : uiLabel('Held'), ' · ', uiChartPercent(active.decision.rate))}</AppText>
          <AppText variant="tiny" color="textMuted">
            {active.partialHistory
              ? uiJoin('Tracked from', ' ', uiDate(active.observationStart))
              : uiJoin('Tracked to', ' ', uiDate(active.open ? active.observedThrough : active.windowEnd))}
          </AppText>
        </View>
        <DecisionArrow newer disabled={decisionIndex <= 0} onPress={() => setSelectedDecisionIndex((index) => Math.max(0, (index ?? decisionIndex) - 1))} />
      </Row>
      <SegmentedControl options={sectionOptions} value={section} onChange={setSection} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search banks" />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 5 }}>
      <AppText variant="tiny" color="textFaint" weight="600" style={{ flex: 1, minWidth: 0 }}>{uiLabel("Bank")}</AppText>
      <AppText variant="tiny" color="textFaint" weight="600" style={{ width: '24%', textAlign: 'right' }}>{uiLabel("First move")}</AppText>
      <AppText variant="tiny" color="textFaint" weight="600" style={{ width: '18%', textAlign: 'right' }}>{uiLabel("After")}</AppText>
    </View>
  </View>;
  return <View style={{ ...responsiveScreenContentStyle(width), flex: 1 }}><FlashList
    data={rows}
    drawDistance={FLASH_LIST_DRAW_DISTANCE}
    viewabilityConfig={FLASH_LIST_VIEWABILITY_CONFIG}
    extraData={renderRevision}
    keyExtractor={(row) => row.provider}
    keyboardShouldPersistTaps="handled"
    renderItem={({ item }) => <CompactRow row={item} status={bankResponseStatus(item, active.decision.delta_bps)}
      open={active.open} saved={saved.has(item.provider)} decisionDate={active.decision.date} section={section} />}
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
