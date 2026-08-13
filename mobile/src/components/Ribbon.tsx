import React from 'react';
import { View } from 'react-native';

import { SECTIONS } from '../constants';
import { bpsBetween, formatRate } from '../data/format';
import { useStore } from '../data/store';
import type { RateStats } from '../data/taxonomy';
import { ribbonA11ySummary } from '../lib/a11ySummaries';
import type { SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

function gapBps(best: number | null, typical: number | null): number | null {
  const signed = bpsBetween(best, typical);
  return signed == null ? null : Math.abs(signed);
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
 * It contrasts the leading rate with the median row for the active ranking metric. The latter is
 * not provider-weighted, so the UI deliberately calls this a spread, not savings.
 */
export const Ribbon = React.memo(function Ribbon({
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
  const mortgageRateMetric = useStore((state) => state.prefs.mortgageRateMetric);
  const meta = SECTIONS[section];
  const best = meta.lowerIsBetter ? stats.min : stats.max;
  const typical = stats.median ?? stats.mean;
  const gap = gapBps(best, typical);
  const leadingLabel = meta.lowerIsBetter ? 'Lowest' : 'Highest';
  const metricLabel = section === 'Mortgage'
    ? mortgageRateMetric === 'comparison' ? 'comparison rate' : 'advertised rate'
    : 'rate';
  const accent = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  const a11ySummary = ribbonA11ySummary(stats, section, rbaRate, mortgageRateMetric);

  if (best == null) {
    return <AppText variant="small" color="textFaint">No rate data</AppText>;
  }

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={a11ySummary}>
      <Row gap={compact ? 8 : 10} style={{ alignItems: 'stretch', flexWrap: compact ? 'nowrap' : 'wrap' }}>
        <Insight
          label={leadingLabel}
          value={formatRate(best)}
          detail={metricLabel}
          footnote={gap == null || compact ? undefined : `${gap} bp to median`}
          compact={compact}
          accent={accent}
        />
        <Insight label="Median" value={formatRate(typical)} detail={`median ${metricLabel}`} compact={compact} />
      </Row>
      {compact && gap != null ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 3 }}>{gap} bp to median</AppText>
      ) : null}
      {!compact ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 7 }}>
          {stats.count} rates · {stats.providers} lenders
          {section === 'Mortgage' && rbaRate != null
            ? ` · RBA cash rate ${formatRate(rbaRate > 1 ? rbaRate / 100 : rbaRate)}`
            : ''}
        </AppText>
      ) : null}
    </View>
  );
});
