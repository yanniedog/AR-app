import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import React, { memo, startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SECTION_ORDER, SECTIONS } from '../../constants';
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
import { hapticSelection } from '../../lib/haptics';
import { moveTone } from '../../lib/moveSemantics';
import { openBank } from '../../lib/nav';
import type { RbaEntry, SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { SearchBar, SegmentedControl } from '../controls';
import { AppText, Badge, Card, Chip, Row } from '../ui';
import { ResponseScatter } from './ResponseScatter';

type LenderRow = MultiSectionPassThroughRow & { response: PassThroughRow };

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
  onSelect,
}: {
  item: LenderRow;
  section: SectionKey;
  model: MultiSectionPassThroughModel;
  selected: boolean;
  onSelect: (provider: string) => void;
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
        <Row gap={0} style={{ alignItems: 'stretch', marginTop: 10 }}>
          {SECTION_ORDER.map((key, index) => (
            <View
              key={key}
              style={{
                flex: 1,
                minWidth: 0,
                paddingHorizontal: 8,
                borderLeftWidth: index === 0 ? 0 : 1,
                borderLeftColor: theme.colors.border,
                backgroundColor: key === section ? theme.colors.primaryMuted : 'transparent',
              }}
            >
              <ResponseCell
                section={key}
                row={item.sections[key]}
                partial={model.decision.partialObservation}
              />
            </View>
          ))}
        </Row>
      </Pressable>
      <Pressable
        onPress={() => onSelect(item.provider)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${selected ? 'Hide' : 'Show'} ${item.provider} on response chart`}
        style={{
          minHeight: 48,
          paddingHorizontal: 14,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="locate-outline" size={15} color={theme.colors.primary} />
        <AppText variant="tiny" weight="700" color="primary">
          {selected ? 'HIDE FROM CHART' : 'SHOW ON CHART'}
        </AppText>
      </Pressable>
    </View>
  );
});

const AnalysisHeader = memo(function AnalysisHeader({
  model,
  decisions,
  section,
  onSectionChange,
  onDecisionChange,
}: {
  model: MultiSectionPassThroughModel;
  decisions: ReturnType<typeof rbaPassThroughDecisionList>;
  section: SectionKey;
  onSectionChange: (section: SectionKey) => void;
  onDecisionChange: (date: string) => void;
}) {
  const theme = useTheme();
  const summary = useMemo(() => summarizeSectionResponse(model, section), [model, section]);
  const direction = model.decision.bps > 0 ? 'raised' : 'cut';
  const partial = model.decision.partialObservation;
  return (
    <View>
      <Card style={{ marginBottom: 14, overflow: 'hidden' }}>
        <AppText variant="tiny" color="textFaint" weight="700">
          RBA DECISION · {formatRunDate(model.decision.date).toUpperCase()}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <Row gap={6}>
              {decisions.map((decision) => (
                <Chip
                  key={decision.date}
                  label={`${formatRunDate(decision.date)} · ${decision.bps > 0 ? '+' : '−'}${Math.abs(decision.bps)} bp`}
                  selected={decision.date === model.decision.date}
                  onPress={() => onDecisionChange(decision.date)}
                />
              ))}
            </Row>
          </ScrollView>
        ) : null}
      </Card>

      <SegmentedControl
        options={SECTION_ORDER.map((key) => ({ value: key, label: SECTIONS[key].short }))}
        value={section}
        onChange={onSectionChange}
      />

      <Card style={{ marginTop: 14, marginBottom: 14 }}>
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
      </Card>

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
        <MetricTile label="Opposite" value={`${summary.movedOpposite}`} detail="provider medians moved the other way" />
      </Row>
    </View>
  );
});

/** Isolated so chart selection updates do not rebuild decision metrics. */
const SpeedResponseCard = memo(function SpeedResponseCard({
  model,
  section,
  eligible,
  selectedProvider,
  onProviderSelect,
}: {
  model: MultiSectionPassThroughModel;
  section: SectionKey;
  eligible: number;
  selectedProvider: string | null;
  onProviderSelect: (provider: string | null) => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 2 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <AppText variant="h3">Speed × response</AppText>
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
            Tap a point to reveal the lender · untimed and non-matching moves use the right rail
          </AppText>
        </View>
        <Badge label={`${eligible} lenders`} tone="muted" />
      </Row>
      <ResponseScatter
        model={model}
        section={section}
        selectedProvider={selectedProvider}
        onProviderSelect={onProviderSelect}
      />
      <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 10 }}>
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
}: {
  payload: BankInsightsPayload;
  rba: RbaEntry[];
  calendar: RbaCalendar | null;
}) {
  const [section, setSection] = useState<SectionKey>('Mortgage');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PassThroughSort>('response');
  const listRef = useRef<FlashListRef<LenderRow>>(null);
  const decisions = useMemo(
    () => rbaPassThroughDecisionList(payload, rba, { calendar }),
    [payload, rba, calendar],
  );
  const activeDate = selectedDate && decisions.some((decision) => decision.date === selectedDate)
    ? selectedDate
    : decisions[0]?.date;
  const model = useMemo(
    () => rbaPassThroughMultiSection(payload, rba, { calendar, decisionDate: activeDate }),
    [payload, rba, calendar, activeDate],
  );
  const rows = useMemo(
    () => (model ? filterAndSortSectionRows(model, section, query, sort) : []),
    [model, section, query, sort],
  );
  const sectionEligible = useMemo(
    () => (model ? summarizeSectionResponse(model, section).eligible : 0),
    [model, section],
  );

  const onSectionChange = useCallback((next: SectionKey) => {
    setSection(next);
    setSelectedProvider(null);
  }, []);

  const onDecisionChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedProvider(null);
  }, []);

  /** Chart already painted locally — defer list highlight work off the tap path. */
  const onChartProviderSelect = useCallback((provider: string | null) => {
    startTransition(() => {
      setSelectedProvider(provider);
    });
  }, []);

  const onListProviderSelect = useCallback((provider: string) => {
    hapticSelection();
    setSelectedProvider((current) => (provider === current ? null : provider));
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: LenderRow }) => (
      <LenderResponseRow
        item={item}
        section={section}
        model={model!}
        selected={item.provider === selectedProvider}
        onSelect={onListProviderSelect}
      />
    ),
    [section, model, selectedProvider, onListProviderSelect],
  );

  const staticHeader = useMemo(() => {
    if (!model) return null;
    return (
      <AnalysisHeader
        model={model}
        decisions={decisions}
        section={section}
        onSectionChange={onSectionChange}
        onDecisionChange={onDecisionChange}
      />
    );
  }, [model, decisions, section, onSectionChange, onDecisionChange]);

  const compareControls = useMemo(
    () => (
      <>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-end' }}>
          <View>
            <AppText variant="h3">Compare lenders</AppText>
            <AppText variant="tiny" color="textMuted">Home loans · Savings · Term deposits</AppText>
          </View>
          <Badge label={`${rows.length}`} tone="muted" />
        </Row>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search lenders" />
        <Row gap={6} style={{ marginTop: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textFaint" weight="700">SORT</AppText>
          <Chip label="Response" selected={sort === 'response'} onPress={() => setSort('response')} />
          <Chip label="Timing" selected={sort === 'timing'} onPress={() => setSort('timing')} />
          <Chip label="Bank" selected={sort === 'bank'} onPress={() => setSort('bank')} />
        </Row>
      </>
    ),
    [rows.length, query, sort],
  );

  const listHeader = useMemo(() => {
    if (!model || !staticHeader) return null;
    return (
      <>
        {staticHeader}
        <SpeedResponseCard
          model={model}
          section={section}
          eligible={sectionEligible}
          selectedProvider={selectedProvider}
          onProviderSelect={onChartProviderSelect}
        />
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
      ListHeaderComponent={listHeader}
      renderItem={renderItem}
      ListEmptyComponent={
        <Card>
          <AppText variant="small" color="textMuted">No lenders match that search.</AppText>
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
