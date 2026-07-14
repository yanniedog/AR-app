import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { SECTIONS } from '../../constants';
import {
  passThroughDaysLabel,
  passThroughPeerBenchmark,
  passThroughSectionOptions,
  rbaPassThrough,
  rbaPassThroughDecisionList,
  type BankInsightsPayload,
  type PassThroughRow,
} from '../../data/bankInsights';
import type { RbaCalendar } from '../../data/rbaCalendar';
import { formatRunDate } from '../../data/format';
import { passThroughA11ySummary } from '../../lib/a11ySummaries';
import { openBank } from '../../lib/nav';
import type { RbaEntry, SectionKey } from '../../types';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { SegmentedControl } from '../controls';
import { AppText, Badge, Chip, Row } from '../ui';

/**
 * RBA response map: every lender plotted by how fast (x, days) and how fully
 * (y, bps) they moved after a cash-rate hike/cut. The dashed line is the
 * decision itself — on it = full pass-through. Past scorable decisions in the
 * ingest window are selectable when more than one overlaps the ledger.
 */
export function RbaResponseScatter({
  payload,
  rba,
  calendar = null,
  section: sectionProp,
  height = 190,
}: {
  payload: BankInsightsPayload | null;
  rba: RbaEntry[];
  calendar?: RbaCalendar | null;
  /** When omitted, the chart offers a section control (Mortgage / Savings / TD). */
  section?: SectionKey;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const sectionOptions = useMemo(() => passThroughSectionOptions(payload), [payload]);
  const availableSections = useMemo(
    () => sectionOptions.map((o) => o.value),
    [sectionOptions],
  );
  const [sectionState, setSectionState] = useState<SectionKey>('Mortgage');
  const activeSection =
    sectionProp ??
    (availableSections.includes(sectionState) ? sectionState : availableSections[0] ?? 'Mortgage');

  const decisions = useMemo(
    () => rbaPassThroughDecisionList(payload, rba, { calendar, section: activeSection }),
    [payload, rba, calendar, activeSection],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate =
    selectedDate && decisions.some((d) => d.date === selectedDate)
      ? selectedDate
      : decisions[0]?.date;
  const model = useMemo(
    () =>
      rbaPassThrough(payload, rba, {
        calendar,
        decisionDate: activeDate,
        section: activeSection,
      }),
    [payload, rba, calendar, activeDate, activeSection],
  );

  if (!decisions.length) {
    return (
      <AppText variant="small" color="textMuted">
        No RBA hike or cut has a response window overlapping the tracked history yet. When the next
        one lands, every lender's speed and pass-through size will be mapped here.
      </AppText>
    );
  }

  if (!model) {
    return (
      <View style={{ gap: 8 }}>
        {!sectionProp && sectionOptions.length > 1 ? (
          <SegmentedControl
            options={sectionOptions}
            value={activeSection}
            onChange={setSectionState}
          />
        ) : null}
        <AppText variant="small" color="textMuted">
          No {SECTIONS[activeSection].short.toLowerCase()} lenders are observable for this decision
          yet. Switch section or wait for the next ingest.
        </AppText>
      </View>
    );
  }

  const { decision, rows, windowDays, windowEnd, windowOpen, observedThrough } = model;
  const peer = passThroughPeerBenchmark(rows);
  const moved = rows.filter((r) => r.daysToFirstMove != null);
  const holdouts = rows.filter((r) => r.daysToFirstMove == null);
  const isCut = decision.bps < 0;
  const dayOpts = { partialObservation: decision.partialObservation, windowOpen };

  const padL = 40;
  const padR = 12;
  const padT = 10;
  const padB = 26;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;

  // Scale X to the nominal window so late movers stay visually comparable across decisions.
  const maxDays = Math.max(
    7,
    windowDays,
    ...moved.map((r) => r.daysToFirstMove ?? 0),
    peer.medianDaysToMove ?? 0,
  );
  const bpsValues = rows.map((r) => r.passedBps).concat([decision.bps, 0]);
  const yMin = Math.min(...bpsValues) - 5;
  const yMax = Math.max(...bpsValues) + 5;
  const ySpan = yMax - yMin || 1;
  const xAt = (days: number) => padL + (days / maxDays) * innerW;
  const yAt = (bps: number) => padT + innerH - ((bps - yMin) / ySpan) * innerH;

  const dotColor = (r: PassThroughRow): string => {
    if (r.passStatus === 'full' || r.passStatus === 'over') return theme.colors.success;
    if (r.passStatus === 'partial') return theme.colors.warning;
    if (r.passedBps === 0) return theme.colors.textFaint;
    return theme.colors.warning;
  };

  const fastest = moved.length
    ? moved.reduce((acc, r) => ((r.daysToFirstMove ?? 99) < (acc.daysToFirstMove ?? 99) ? r : acc))
    : null;

  const axisMarks = [7, 14, 21, 28, 45, 60].filter((d) => d <= maxDays);

  return (
    <View>
      {!sectionProp && sectionOptions.length > 1 ? (
        <View style={{ marginBottom: 8 }}>
          <SegmentedControl
            options={sectionOptions}
            value={activeSection}
            onChange={setSectionState}
          />
        </View>
      ) : null}
      {decisions.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Row gap={6}>
            {decisions.map((d) => (
              <Chip
                key={d.date}
                label={`${formatRunDate(d.date)} · ${d.bps > 0 ? '+' : '−'}${Math.abs(d.bps)}`}
                selected={d.date === decision.date}
                onPress={() => setSelectedDate(d.date)}
              />
            ))}
          </Row>
        </ScrollView>
      ) : null}
      <AppText variant="small" color="textMuted" style={{ marginBottom: 4 }}>
        RBA {isCut ? 'cut' : 'raised'} by {Math.abs(decision.bps)} bps for{' '}
        {SECTIONS[activeSection].short.toLowerCase()}. Each dot is a lender: further left = faster
        first move, on the dashed line = full cumulative pass-through
        {windowOpen
          ? ` (window open through ${formatRunDate(windowEnd)}; data through ${formatRunDate(observedThrough)})`
          : ` (window closed ${formatRunDate(windowEnd)})`}
        .
      </AppText>
      <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
        Announced {formatRunDate(decision.date)}
        {decision.effective
          ? ` · effective ${formatRunDate(decision.effective)}`
          : ' · effective date not in calendar'}
        {peer.medianDaysToMove != null
          ? ` · peer median first move ${decision.partialObservation ? '≤' : ''}${peer.medianDaysToMove}d`
          : ''}
      </AppText>
      {decision.partialObservation ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
          Announcement predates tracked history — horizontal position uses ≤ days.
        </AppText>
      ) : null}
      {windowOpen ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
          Window still open — holdouts may yet move.
        </AppText>
      ) : null}
      <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge
          label={`${peer.fullOrOver} full pass${peer.fullOrOver === 1 ? '' : 'es'}`}
          tone="success"
        />
        {peer.partial ? <Badge label={`${peer.partial} partial`} tone="warning" /> : null}
        <Badge label={`${peer.movers} moved`} tone="primary" />
        {holdouts.length ? (
          <Badge
            label={windowOpen ? `${holdouts.length} waiting` : `${holdouts.length} no move`}
            tone="warning"
          />
        ) : null}
      </Row>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={passThroughA11ySummary(model)}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line
              x1={padL}
              y1={yAt(0)}
              x2={width - padR}
              y2={yAt(0)}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
            <Line
              x1={padL}
              y1={yAt(decision.bps)}
              x2={width - padR}
              y2={yAt(decision.bps)}
              stroke={theme.colors.rba}
              strokeWidth={1.4}
              strokeDasharray="5 4"
            />
            <SvgText
              x={padL + 2}
              y={yAt(decision.bps) - 4}
              fontSize={9}
              fill={theme.colors.rba}
              fontWeight="600"
            >
              full pass ({decision.bps > 0 ? '+' : ''}
              {decision.bps} bps)
            </SvgText>
            {peer.medianDaysToMove != null ? (
              <>
                <Line
                  x1={xAt(peer.medianDaysToMove)}
                  y1={padT}
                  x2={xAt(peer.medianDaysToMove)}
                  y2={padT + innerH}
                  stroke={withAlpha(theme.colors.primary, 0.55)}
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                />
                <SvgText
                  x={xAt(peer.medianDaysToMove) + 3}
                  y={padT + 10}
                  fontSize={8}
                  fill={theme.colors.primary}
                  fontWeight="600"
                >
                  peer {peer.medianDaysToMove}d
                </SvgText>
              </>
            ) : null}
            <SvgText
              x={padL - 6}
              y={yAt(0) + 3}
              fontSize={9}
              fill={theme.colors.textFaint}
              textAnchor="end"
            >
              0
            </SvgText>
            {axisMarks.map((d) => (
              <React.Fragment key={d}>
                <Line
                  x1={xAt(d)}
                  y1={padT}
                  x2={xAt(d)}
                  y2={padT + innerH}
                  stroke={withAlpha(theme.colors.textFaint, 0.18)}
                  strokeWidth={0.8}
                />
                <SvgText
                  x={xAt(d)}
                  y={height - 12}
                  fontSize={9}
                  fill={theme.colors.textFaint}
                  textAnchor="middle"
                >
                  {d}d
                </SvgText>
              </React.Fragment>
            ))}
            {moved.map((r) => (
              <Circle
                key={r.provider}
                cx={xAt(r.daysToFirstMove!)}
                cy={yAt(r.passedBps)}
                r={5}
                fill={withAlpha(dotColor(r), 0.85)}
              />
            ))}
            <SvgText
              x={padL + innerW / 2}
              y={height - 1}
              fontSize={9}
              fill={theme.colors.textFaint}
              textAnchor="middle"
            >
              days from announcement to first move
            </SvgText>
          </Svg>
        ) : null}
      </View>
      {fastest ? (
        <Pressable
          onPress={() => openBank(fastest.provider)}
          accessibilityRole="button"
          accessibilityLabel={`Fastest responder ${fastest.provider}, ${passThroughDaysLabel(
            fastest.daysToFirstMove,
            dayOpts,
          )}`}
        >
          <Row gap={8} style={{ marginTop: 8 }}>
            <BankAvatar provider={fastest.provider} size={22} />
            <AppText variant="tiny" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
              Fastest: <AppText variant="tiny" weight="700">{fastest.provider}</AppText>
              {' · '}
              {passThroughDaysLabel(fastest.daysToFirstMove, dayOpts)} (
              {fastest.passedBps > 0 ? '+' : ''}
              {fastest.passedBps} bps)
            </AppText>
          </Row>
        </Pressable>
      ) : null}
    </View>
  );
}
