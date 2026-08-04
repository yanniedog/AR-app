import React from 'react';
import { View } from 'react-native';

import { SECTIONS } from '../constants';
import { formatRate } from '../data/format';
import type { RateStats } from '../data/taxonomy';
import { ribbonA11ySummary } from '../lib/a11ySummaries';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

function gapBps(best: number | null, typical: number | null): number | null {
  if (best == null || typical == null) return null;
  return Math.round(Math.abs(best - typical) * 10000);
}

function Insight({
  label,
  value,
  detail,
  footnote,
  compact,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  footnote?: string;
  compact?: boolean;
  accent?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={
        compact
          ? { flex: 1, minWidth: 0 }
          : {
              flexGrow: 1,
              flexBasis: '46%',
              minWidth: 120,
              padding: 10,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceAlt,
            }
      }
    >
      <AppText variant="tiny" color="textFaint" weight="700" numberOfLines={1}>
        {label.toUpperCase()}
      </AppText>
      <AppText
        variant={compact ? 'small' : 'rate'}
        weight="800"
        numberOfLines={1}
        style={{ color: accent ?? theme.colors.text, marginTop: compact ? 1 : 2 }}
      >
        {value}
      </AppText>
      {detail && !compact ? (
        <AppText variant="tiny" color="textMuted" style={{ marginTop: 1 }}>
          {detail}
        </AppText>
      ) : null}
      {footnote && !compact ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 3 }}>{footnote}</AppText>
      ) : null}
    </View>
  );
}

/**
 * Actionable market summary replacing the former min/median/mean/max range bar.
 * It contrasts the best rate with the median advertised rate row. The latter is
 * not provider-weighted, so the UI deliberately calls this a spread, not savings.
 */
export function Ribbon({
  stats,
  section,
  rbaRate,
  compact,
}: {
  stats: RateStats;
  section: SectionKey;
  rbaRate?: number | null;
  compact?: boolean;
  /** Retained for call-site compatibility; the old shared graph scale is no longer used. */
  domain?: { min: number; max: number } | null;
}) {
  const theme = useTheme();
  const meta = SECTIONS[section];
  const best = meta.lowerIsBetter ? stats.min : stats.max;
  const typical = stats.median ?? stats.mean;
  const gap = gapBps(best, typical);
  const accent = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  const a11ySummary = ribbonA11ySummary(stats, section, rbaRate);

  if (best == null) {
    return <AppText variant="small" color="textFaint">No rate data</AppText>;
  }

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={a11ySummary}>
      <Row gap={compact ? 8 : 10} style={{ alignItems: 'stretch', flexWrap: compact ? 'nowrap' : 'wrap' }}>
        <Insight
          label="Best"
          value={formatRate(best)}
          detail="best advertised"
          footnote={gap == null || compact ? undefined : `${gap} bp from typical`}
          compact={compact}
          accent={accent}
        />
        <Insight label="Typical" value={formatRate(typical)} detail="median advertised rate" compact={compact} />
      </Row>
      {compact && gap != null ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 3 }}>Best is {gap} bp from typical</AppText>
      ) : null}
      {!compact ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 7 }}>
          {stats.count} advertised rates · {stats.providers} lenders
          {section === 'Mortgage' && rbaRate != null
            ? ` · RBA cash rate ${formatRate(rbaRate > 1 ? rbaRate / 100 : rbaRate)}`
            : ''}
        </AppText>
      ) : null}
    </View>
  );
}
