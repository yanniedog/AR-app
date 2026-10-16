import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { ChartText as SvgText } from '../charts/ChartText';

import {
  rbaPassThrough,
  rbaPassThroughDecisionList,
  type BankInsightsPayload,
  type PassThroughRow,
} from '../../data/bankInsights';
import type { RbaCalendar } from '../../data/rbaCalendar';
import { uiLabel,  uiCount, uiDate, uiDuration, uiJoin, uiProviderName } from '../../lib/uiCopy';
import { uiChartBps, uiResponseDays } from '../../lib/chartUiCopy';
import { openBank } from '../../lib/nav';
import type { RbaEntry } from '../../types';
import { withAlpha } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
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
  height = 190,
}: {
  payload: BankInsightsPayload | null;
  rba: RbaEntry[];
  calendar?: RbaCalendar | null;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const decisions = useMemo(
    () => rbaPassThroughDecisionList(payload, rba, { calendar }),
    [payload, rba, calendar],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate =
    selectedDate && decisions.some((d) => d.date === selectedDate)
      ? selectedDate
      : decisions[0]?.date;
  const model = useMemo(
    () => rbaPassThrough(payload, rba, { calendar, decisionDate: activeDate }),
    [payload, rba, calendar, activeDate],
  );
  if (!model) {
    return (
      <AppText variant="small" color="textMuted">
        {uiLabel("No observations")}</AppText>
    );
  }

  const { decision, rows, windowDays, windowEnd, windowOpen, observedThrough } = model;
  const moved = rows.filter((r) => r.daysToFirstMove != null);
  const holdouts = rows.filter((r) => r.daysToFirstMove == null);
  const fullPasses = rows.filter((r) => r.passStatus === 'full' || r.passStatus === 'over');
  const partialPasses = rows.filter((r) => r.passStatus === 'partial');

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
      {decisions.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Row gap={6}>
            {decisions.map((d) => (
              <Chip
                key={d.date}
                label={uiJoin(uiDate(d.date), ' · ', uiChartBps(d.bps))}
                selected={d.date === decision.date}
                onPress={() => setSelectedDate(d.date)}
              />
            ))}
          </Row>
        </ScrollView>
      ) : null}
      <AppText variant="small" color="textMuted" style={{ marginBottom: 6 }}>
        {uiJoin('RBA', ' · ', uiChartBps(decision.bps), ' · ', uiDate(decision.date), ' · ', windowOpen ? 'Open window' : 'Closed window', ' · ', uiDate(windowEnd), ' · ', 'Observed', ' · ', uiDate(observedThrough))}
      </AppText>
      {decision.partialObservation ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
          {uiJoin('Partial', ' · ', 'Response', ' · ', '≤', ' ', 'days')}
        </AppText>
      ) : null}
      {windowOpen ? (
        <AppText variant="tiny" color="textFaint" style={{ marginBottom: 6 }}>
          {uiLabel("Open window")}</AppText>
      ) : null}
      <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge label={uiJoin('Full pass-through', ' ', uiCount(fullPasses.length))} tone="success" />
        {partialPasses.length ? (
          <Badge label={uiJoin('Partial', ' ', uiCount(partialPasses.length))} tone="warning" />
        ) : null}
        <Badge label={uiJoin('Moves', ' ', uiCount(moved.length))} tone="primary" />
        {holdouts.length ? (
          <Badge
            label={uiJoin(windowOpen ? 'Pending' : 'No observed move', ' ', uiCount(holdouts.length))}
            tone="warning"
          />
        ) : null}
      </Row>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={uiJoin('RBA', ' · ', uiDate(decision.date), ' · ', uiChartBps(decision.bps), ' · ', 'Moves', ' ', uiCount(moved.length), ' · ', 'Full pass-through', ' ', uiCount(fullPasses.length), ' · ', windowOpen ? 'Pending' : 'No observed move', ' ', uiCount(holdouts.length), ' · ', uiDate(windowEnd))}
        style={{ width: '100%', height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={padL} y1={yAt(0)} x2={width - padR} y2={yAt(0)} stroke={theme.colors.border} strokeWidth={1} />
            <Line
              x1={padL}
              y1={yAt(decision.bps)}
              x2={width - padR}
              y2={yAt(decision.bps)}
              stroke={theme.colors.rba}
              strokeWidth={1.4}
              strokeDasharray="5 4"
            />
            <SvgText x={padL + 2} y={yAt(decision.bps) - 4} fontSize={9} fill={theme.colors.rba} fontWeight="600">
              {uiJoin('Full pass-through', ' ', uiChartBps(decision.bps))}
            </SvgText>
            <SvgText x={padL - 6} y={yAt(0) + 3} fontSize={9} fill={theme.colors.textFaint} textAnchor="end">
              {0}</SvgText>
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
                <SvgText x={xAt(d)} y={height - 12} fontSize={9} fill={theme.colors.textFaint} textAnchor="middle">
                  {uiDuration(d, 'days')}
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
            <SvgText x={padL + innerW / 2} y={height - 1} fontSize={9} fill={theme.colors.textFaint} textAnchor="middle">
              {uiJoin('Response', ' · ', 'days')}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      {fastest ? (
        <Pressable
          onPress={() => openBank(fastest.provider)}
          accessibilityRole="button"
          accessibilityLabel={uiJoin('Fastest response', ' · ', uiProviderName(fastest), ' · ', uiResponseDays(fastest.daysToFirstMove, decision.partialObservation))}
        >
          <Row gap={8} style={{ marginTop: 8 }}>
            <BankAvatar provider={fastest.provider} size={22} />
            <AppText variant="tiny" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>
              {uiJoin('Fastest response', ' · ', uiProviderName(fastest), ' · ', uiResponseDays(fastest.daysToFirstMove, decision.partialObservation), ' · ', uiChartBps(fastest.passedBps))}
            </AppText>
          </Row>
        </Pressable>
      ) : null}
    </View>
  );
}
