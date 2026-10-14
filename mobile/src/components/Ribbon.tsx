import React from 'react';
import { View } from 'react-native';

import { SECTIONS } from '../constants';
import { bpsBetween, formatRankedFraction } from '../data/format';
import { useStore } from '../data/store';
import type { RateStats } from '../data/taxonomy';
import { uiCount, uiJoin, uiLabel, uiNumber, uiRate, type UiCopy } from '../lib/uiCopy';
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
  compact,
  accent,
}: {
  label: UiCopy;
  value: UiCopy;
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
              paddingVertical: theme.spacing(3),
            }
      }
    >
      <AppText variant="tiny" color="textFaint" weight="700" numberOfLines={1}>
        {label}
      </AppText>
      <AppText
        variant={compact ? 'small' : 'rate'}
        weight="800"
        numberOfLines={1}
        style={{ color: accent ?? theme.colors.text, marginTop: compact ? 1 : 2 }}
      >
        {value}
      </AppText>
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
    ? mortgageRateMetric === 'comparison' ? uiLabel('Comparison rate') : uiLabel('Advertised rate')
    : uiLabel('Advertised rate');
  const accent = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  const facts = uiJoin(metricLabel, ' · ', leadingLabel === 'Lowest' ? uiLabel('Lowest') : uiLabel('Highest'), ': ', formatRankedFraction(best), ' · ', 'Median', ': ', formatRankedFraction(typical), ' · ', 'Spread', ': ', gap == null ? uiLabel('Unknown') : uiJoin(uiNumber(gap), ' ', 'bps'), ' · ', uiCount(stats.count), ' ', 'rates', ' · ', uiCount(stats.providers), ' ', 'banks', section === 'Mortgage' && rbaRate != null ? uiJoin(' · ', 'RBA cash rate', ': ', uiRate(rbaRate > 1 ? rbaRate / 100 : rbaRate)) : null);

  if (best == null) {
    return <AppText variant="small" color="textFaint">{uiJoin('Rates', ' · ', 'Unavailable')}</AppText>;
  }

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={facts}>
      <Row gap={compact ? 8 : 10} style={{ alignItems: 'stretch', flexWrap: compact ? 'nowrap' : 'wrap' }}>
        <Insight
          label={uiLabel(leadingLabel)}
          value={formatRankedFraction(best)}
          compact={compact}
          accent={accent}
        />
        <Insight label="Median" value={formatRankedFraction(typical)} compact={compact} />
      </Row>
      {compact && gap != null ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 3 }}>{uiJoin('Spread', ': ', uiNumber(gap), ' ', 'bps')}</AppText>
      ) : null}
      {!compact ? (
        <AppText variant="tiny" color="textFaint" style={{ marginTop: 7 }}>
          {uiJoin(metricLabel, ' · ', uiCount(stats.count), ' ', 'rates', ' · ', uiCount(stats.providers), ' ', 'banks', gap == null ? null : uiJoin(' · ', 'Spread', ': ', uiNumber(gap), ' ', 'bps'), section === 'Mortgage' && rbaRate != null ? uiJoin(' · ', 'RBA cash rate', ': ', uiRate(rbaRate > 1 ? rbaRate / 100 : rbaRate)) : null)}
        </AppText>
      ) : null}
    </View>
  );
});
