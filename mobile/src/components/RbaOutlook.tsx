import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import {
  ECONOMIC_RECHECK_MS,
  loadEconomicOutlook,
  RBA_ECONOMIC_TABLE_URL,
  type CashRateForecast,
  type EconomicIndicator,
  type EconomicOutlookPayload,
  type EconomicPoint,
  type EconomicPressure,
} from '../data/economicOutlook';
import { formatRunDate, relativeDate } from '../data/format';
import type { RbaEntry } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { EconomicExplorer } from './economy';
import { AppText, Badge, Button, Card, Row } from './ui';

function pressureMeta(direction: EconomicPressure): {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'warning' | 'primary' | 'muted';
} {
  // Resolved inside components so theme colors remain dynamic.
  if (direction === 'higher') {
    return { label: 'Higher-rate pressure', color: '', icon: 'arrow-up-circle-outline', tone: 'warning' };
  }
  if (direction === 'lower') {
    return { label: 'Lower-rate pressure', color: '', icon: 'arrow-down-circle-outline', tone: 'primary' };
  }
  return { label: 'Mixed / neutral', color: '', icon: 'remove-circle-outline', tone: 'muted' };
}

function Sparkline({
  points,
  targetBand,
  color,
  label,
}: {
  points: EconomicPoint[];
  targetBand?: [number, number];
  color: string;
  label: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const height = 92;
  const padX = 6;
  const padY = 10;
  const values = points.map((point) => point.value);
  if (targetBand) values.push(...targetBand);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(0.15, (rawMax - rawMin) * 0.12);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = height - padY * 2;
  const x = (index: number) =>
    padX + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => padY + innerH - ((value - min) / span) * innerH;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ');
  const latest = points[points.length - 1];
  const summary = `${label} chart from ${formatRunDate(points[0].date)} to ${formatRunDate(latest.date)}, latest ${latest.value.toFixed(1)} percent${targetBand ? `, reference band ${targetBand[0]} to ${targetBand[1]} percent` : ''}.`;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={{ height, width: '100%' }}
    >
      {width > 0 ? (
        <Svg width={width} height={height} importantForAccessibility="no-hide-descendants">
          {targetBand ? (
            <Rect
              x={padX}
              y={y(targetBand[1])}
              width={innerW}
              height={Math.max(1, y(targetBand[0]) - y(targetBand[1]))}
              fill={theme.colors.rba}
              opacity={0.1}
              rx={4}
            />
          ) : null}
          <Line x1={padX} y1={y(latest.value)} x2={width - padX} y2={y(latest.value)} stroke={theme.colors.border} strokeDasharray="3 4" />
          <Path d={path} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x(points.length - 1)} cy={y(latest.value)} r={4} fill={color} />
          <SvgText x={width - padX} y={Math.max(10, y(latest.value) - 7)} textAnchor="end" fontSize={10} fontWeight="700" fill={theme.colors.text}>
            {latest.value.toFixed(1)}%
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

function IndicatorCard({ indicator }: { indicator: EconomicIndicator }) {
  const theme = useTheme();
  const latest = indicator.points[indicator.points.length - 1];
  const meta = pressureMeta(indicator.signal.direction);
  const color = indicator.signal.direction === 'higher'
    ? theme.colors.warning
    : indicator.signal.direction === 'lower'
      ? theme.colors.primary
      : theme.colors.textMuted;
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        minWidth: 148,
        padding: 12,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 6 }}>
          <AppText variant="small" weight="700">{indicator.label}</AppText>
          <AppText variant="tiny" color="textFaint" numberOfLines={2}>{indicator.shortLabel}</AppText>
        </View>
        <Ionicons name={meta.icon} size={19} color={color} />
      </Row>
      <Sparkline
        points={indicator.points}
        targetBand={indicator.targetBand}
        color={color}
        label={indicator.label}
      />
      <AppText variant="tiny" color="textFaint">APP SIGNAL</AppText>
      <AppText variant="small" weight="800" style={{ color }}>{indicator.signal.label}</AppText>
      <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>{indicator.signal.explanation}</AppText>
      {indicator.status === 'stale' ? (
        <AppText variant="tiny" color="warning" weight="700" style={{ marginTop: 7 }}>
          RELEASE OVERDUE — showing the latest verified observation
        </AppText>
      ) : null}
      <AppText variant="tiny" color="textFaint" style={{ marginTop: 7 }}>
        Observation {formatRunDate(latest.date)} · released {formatRunDate(indicator.publicationDate)}
        {' · '}checked {relativeDate(indicator.checkedAt)}
      </AppText>
    </View>
  );
}

function CashForecastChart({ forecast }: { forecast: CashRateForecast }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const points = forecast.points;
  const height = 150;
  const padL = 10;
  const padR = 34;
  const padT = 18;
  const padB = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values) - 0.15;
  const max = Math.max(...values) + 0.15;
  const span = max - min || 1;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const times = points.map((point) => Date.parse(`${point.date}T00:00:00Z`));
  const firstTime = times[0];
  const timeSpan = times[times.length - 1] - firstTime;
  const x = (index: number) => padL + (timeSpan > 0 ? ((times[index] - firstTime) / timeSpan) * innerW : innerW / 2);
  const y = (value: number) => padT + innerH - ((value - min) / span) * innerH;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Market economists' median cash-rate path from ${points[0].value.toFixed(2)} percent to ${last.value.toFixed(2)} percent by ${formatRunDate(last.date)}. Surveyed ${formatRunDate(forecast.surveyDate)}.`}
      style={{ width: '100%', height }}
    >
      {width > 0 ? (
        <Svg width={width} height={height} importantForAccessibility="no-hide-descendants">
          <Line x1={padL} y1={y(min + 0.15)} x2={width - padR} y2={y(min + 0.15)} stroke={theme.colors.border} />
          <Path d={path} fill="none" stroke={theme.colors.rba} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <Circle key={`${point.date}-${index}`} cx={x(index)} cy={y(point.value)} r={4} fill={theme.colors.rba} />
          ))}
          <SvgText x={width - padR + 4} y={y(last.value) + 4} fontSize={10} fill={theme.colors.text}>{last.value.toFixed(2)}%</SvgText>
          <SvgText x={padL} y={height - 7} fontSize={10} fill={theme.colors.textFaint}>{formatRunDate(points[0].date)}</SvgText>
          <SvgText x={width - padR} y={height - 7} textAnchor="end" fontSize={10} fill={theme.colors.textFaint}>{formatRunDate(last.date)}</SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

function OutlookContent({ data, rba }: { data: EconomicOutlookPayload; rba: RbaEntry[] }) {
  const counts = data.indicators.reduce(
    (acc, indicator) => ({ ...acc, [indicator.signal.direction]: acc[indicator.signal.direction] + 1 }),
    { higher: 0, lower: 0, balanced: 0 },
  );
  return (
    <>
      <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 12 }}>
        <Badge label={`${counts.higher} higher-rate`} tone="warning" />
        <Badge label={`${counts.lower} lower-rate`} tone="primary" />
        <Badge label={`${counts.balanced} mixed`} tone="muted" />
      </Row>
      <AppText variant="tiny" color="textMuted" style={{ marginTop: 7 }}>
        Official source data with app interpretation. This pressure map is not a weighted prediction; no single release determines a decision.
      </AppText>
      <View style={{ marginTop: 16 }}>
        <AppText variant="h3">Economic explorer</AppText>
        <AppText variant="tiny" color="textMuted" style={{ marginTop: 2, marginBottom: 10 }}>
          Tap a lens, then tap or scrub any chart to inspect exact observations.
        </AppText>
        <EconomicExplorer data={data} rba={rba} />
      </View>
      <AppText variant="small" weight="700" style={{ marginTop: 18 }}>
        All indicators
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {data.indicators.map((indicator) => <IndicatorCard key={indicator.id} indicator={indicator} />)}
      </View>
      {data.cashRateForecast?.points.length ? (
        <View style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <AppText variant="h3">Economists' cash-rate path</AppText>
              <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
                Median RBA survey response · a view, not a probability
              </AppText>
            </View>
            <Badge label={`Survey ${formatRunDate(data.cashRateForecast.surveyDate)}`} tone="muted" />
          </Row>
          <CashForecastChart forecast={data.cashRateForecast} />
        </View>
      ) : null}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="tiny" color="textFaint">
            Checked {relativeDate(data.checkedAt)} · cached independently from the daily bank ingest
          </AppText>
          {data.refreshStatus && data.refreshStatus !== 'current' ? (
            <AppText variant="tiny" color={data.refreshStatus === 'offline' ? 'warning' : 'textMuted'}>
              {data.refreshStatus === 'offline'
                ? 'Could not verify the latest release · showing last-known official data'
                : 'Some official series could not be refreshed · last-known values retained'}
            </AppText>
          ) : null}
        </View>
        <Button title="Sources" variant="ghost" onPress={() => void Linking.openURL(RBA_ECONOMIC_TABLE_URL)} />
      </Row>
    </>
  );
}

export function RbaOutlook({ rba }: { rba: RbaEntry[] }) {
  const theme = useTheme();
  const [data, setData] = useState<EconomicOutlookPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const value = await loadEconomicOutlook(force);
      if (mounted.current) setData(value);
    } catch (err) {
      if (mounted.current) setError(String((err as Error)?.message ?? err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    void load(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(false);
    });
    const timer = setInterval(() => void load(false), ECONOMIC_RECHECK_MS);
    return () => {
      mounted.current = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, [load]));

  return (
    <Card style={{ marginBottom: 16, borderColor: `${theme.colors.rba}55` }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <AppText variant="h2">RBA outlook</AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
            Economic signals that shape the next rate decision
          </AppText>
        </View>
        <Badge label="OFFICIAL SOURCES" tone="primary" />
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <AppText variant="tiny" color="textFaint">
          Rechecks on entry, foreground and every 15 minutes
        </AppText>
        <Button
          title="Refresh"
          icon="refresh"
          variant="ghost"
          onPress={() => void load(true)}
          loading={loading && !!data}
        />
      </Row>
      {loading && !data ? (
        <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.rba} />
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 8 }}>Loading small RBA tables…</AppText>
        </View>
      ) : data ? (
        <>
          <OutlookContent data={data} rba={rba} />
          {error ? (
            <AppText variant="tiny" color="warning" style={{ marginTop: 8 }}>
              Could not verify the latest data: {error}
            </AppText>
          ) : null}
        </>
      ) : (
        <View style={{ marginTop: 14 }}>
          <AppText variant="small" color="textMuted">
            Economic signals are unavailable right now. Bank rates and cached app data still work normally.
          </AppText>
          {error ? <AppText variant="tiny" color="danger" style={{ marginTop: 5 }}>{error}</AppText> : null}
          <View style={{ alignSelf: 'flex-start', marginTop: 10 }}>
            <Button title="Retry signals" variant="secondary" onPress={() => void load(true)} loading={loading} />
          </View>
        </View>
      )}
    </Card>
  );
}
