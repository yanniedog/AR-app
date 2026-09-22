import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { EconomicPoint } from '../../data/economicOutlook';
import { commissionerFamily } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerText } from '../ledger';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function outlookMonth(date: string): string {
  const month = Number(date.slice(5, 7));
  return `${MONTHS[month - 1] ?? date} ${date.slice(2, 4)}`;
}

/** A visible rate axis shared by both outlooks; never exaggerate a tiny spread. */
export function outlookRateDomain(points: readonly EconomicPoint[], cashRate: number | null): [number, number] {
  const values = points.map((point) => point.value).filter(Number.isFinite);
  if (cashRate != null && Number.isFinite(cashRate)) values.push(cashRate);
  if (!values.length) return [0, 1];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = Math.max(0.125, (high - low) * 0.15);
  return [Math.floor((low - margin) * 4) / 4, Math.ceil((high + margin) * 4) / 4];
}

export function RateOutlookChart({
  label,
  points,
  cashRate,
  tone = 'eucalyptus',
  selectedIndex,
  onSelect,
  onReady,
}: {
  label: string;
  points: readonly EconomicPoint[];
  cashRate: number | null;
  tone?: 'eucalyptus' | 'info';
  selectedIndex: number;
  onSelect: (index: number) => void;
  onReady?: (revision: string) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const valid = useMemo(() => points.filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.date))), [points]);
  const revision = valid.map((point) => `${point.date}:${point.value}`).join('|');
  const [min, max] = outlookRateDomain(valid, cashRate);
  const index = Math.min(Math.max(0, selectedIndex), valid.length - 1);
  const selected = valid[index];
  const height = 220;
  const left = 48;
  const right = 28;
  const top = 18;
  const bottom = 35;
  const innerW = Math.max(1, width - left - right);
  const innerH = height - top - bottom;
  const first = Date.parse(valid[0]?.date ?? '');
  const span = Math.max(1, Date.parse(valid.at(-1)?.date ?? '') - first);
  const x = (date: string) => left + (valid.length === 1 ? 0.5 : (Date.parse(date) - first) / span) * innerW;
  const y = (value: number) => top + (max - value) / (max - min) * innerH;
  const color = theme.ledger[tone];
  const path = valid.map((point, i) => `${i ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`).join(' ');
  const summary = `${label}. ${valid.map((point) => `${outlookMonth(point.date)}: ${point.value.toFixed(2)} percent`).join('; ')}.`;

  useEffect(() => {
    if (width > 76 && revision) onReadyRef.current?.(revision);
  }, [revision, width]);

  if (!selected) return <LedgerText tone="mutedInk">No forecast observations published.</LedgerText>;
  const delta = cashRate == null || !Number.isFinite(cashRate) ? null : Math.round((selected.value - cashRate) * 100);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <LedgerText variant="rateLarge" tone={tone}>{selected.value.toFixed(2)}%</LedgerText>
        <View style={{ paddingBottom: 4, flexShrink: 1 }}>
          <LedgerText variant="label">{outlookMonth(selected.date)}</LedgerText>
          {delta != null ? (
            <LedgerText variant="caption" tone="mutedInk">
              {delta === 0 ? 'Same as the cash rate' : `${delta > 0 ? '+' : '−'}${(Math.abs(delta) / 100).toFixed(2)} percentage points vs cash`}
            </LedgerText>
          ) : null}
        </View>
      </View>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height, width: '100%' }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        {width > left + right ? (
          <Svg width={width} height={height} accessible={false}>
            {[min, (min + max) / 2, max].map((tick) => (
              <React.Fragment key={tick}>
                <Line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={theme.ledger.rule} />
                <SvgText x={left - 8} y={y(tick) + 4} textAnchor="end" fill={theme.ledger.mutedInk} fontSize={12} fontFamily={commissionerFamily('500')}>
                  {tick.toFixed(2)}%
                </SvgText>
              </React.Fragment>
            ))}
            {cashRate != null && Number.isFinite(cashRate) ? (
              <Line x1={left} x2={width - right} y1={y(cashRate)} y2={y(cashRate)} stroke={theme.ledger.mutedInk} strokeDasharray="4 5" />
            ) : null}
            <Path d={path} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {valid.map((point, i) => (
              <Circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={i === index ? 6 : 3} fill={i === index ? theme.ledger.wattle : color} stroke={color} strokeWidth={2} />
            ))}
            {valid.filter((_, i) => (valid.length <= 5 && innerW / Math.max(1, valid.length - 1) >= 64) || i === 0 || i === Math.floor((valid.length - 1) / 2) || i === valid.length - 1).map((point) => (
              <SvgText key={point.date} x={x(point.date)} y={height - 10} textAnchor="middle" fill={theme.ledger.mutedInk} fontSize={12} fontFamily={commissionerFamily('500')}>
                {outlookMonth(point.date)}
              </SvgText>
            ))}
          </Svg>
        ) : null}
      </View>
      {cashRate != null && Number.isFinite(cashRate) ? <LedgerText variant="caption" tone="mutedInk">Dashed line · cash rate {cashRate.toFixed(2)}%</LedgerText> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {valid.map((point, i) => (
          <Pressable
            key={point.date}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${outlookMonth(point.date)}, ${point.value.toFixed(2)} percent`}
            accessibilityState={{ selected: i === index }}
            style={{ minHeight: 48, minWidth: 64, padding: 8, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: i === index ? theme.ledger.wattle : theme.ledger.controlRule }}
          >
            <LedgerText variant="caption" weight={i === index ? '700' : '500'}>{outlookMonth(point.date)}</LedgerText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
