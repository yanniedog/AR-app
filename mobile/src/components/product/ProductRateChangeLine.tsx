import React, { useMemo } from 'react';

import { formatRate, formatRateChangeDate } from '../../data/format';
import type { ProductBestRateSummary } from '../../data/productHistory';
import { selectedRateChange } from '../../data/selectedRateChange';
import type { RateRow } from '../../types';
import { useStore } from '../../data/store';
import { moveTone } from '../../lib/moveSemantics';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../ui';
import { uiJoin, uiNumber, type UiText } from '../../lib/uiCopy';

function bpsMagnitude(bps: number): UiText {
  const rounded = Math.round(Math.abs(bps) * 10) / 10;
  return uiJoin(uiNumber(rounded, rounded % 1 ? 1 : 0), ' ', 'bps');
}

export function productRateChangeText(
  summary: ProductBestRateSummary | null,
  compact = false,
): UiText | null {
  if (!summary) return null;
  if (summary.kind === 'tracking' || summary.kind === 'unchanged') return null;

  const arrow = summary.bps > 0 ? '↑' : '↓';
  const when = formatRateChangeDate(summary.observedOn);
  return compact
    ? uiJoin('Rate', ' ', arrow, ' ', bpsMagnitude(summary.bps), ' · ', when)
    : uiJoin('Rate', ' ', arrow, ' ', bpsMagnitude(summary.bps), ' · ', when, ' · ', formatRate(summary.fromRate), ' → ', formatRate(summary.toRate));
}

export function useProductRateChangeSummary(
  row: RateRow, section: SectionKey, metric?: RateMetric,
): ProductBestRateSummary | null {
  const core = useStore(s => s.core);
  const details = useStore(s => s.details);
  const manifest = useStore(s => s.manifest);
  const coreIntegrity = useStore(s => s.coreIntegrity);
  const previous = useStore(s => s.previousRateEdition);
  return useMemo(() => metric ? selectedRateChange(previous, { core, details, manifest, coreIntegrity }, row, section, metric) : null,
    [previous, core, details, manifest, coreIntegrity, row, section, metric]);
}

type RateMetric = 'rate' | 'comparison_rate' | 'ongoing_rate';

export function ProductRateChangeSummaryLine({
  section,
  compact = false,
  model,
}: {
  section: SectionKey;
  compact?: boolean;
  model: ProductBestRateSummary | null;
}) {
  const theme = useTheme();
  const text = productRateChangeText(model, compact);
  if (!text) return null;

  const tone = model?.kind === 'changed' ? moveTone(section, model.bps) : 'muted';
  const color =
    tone === 'success'
      ? theme.colors.success
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.textFaint;

  return (
    <AppText
      variant="tiny"
      weight={model?.kind === 'changed' ? '700' : '400'}
      style={{ color, marginTop: compact ? 3 : 8, textAlign: compact ? 'left' : 'center' }}
      accessibilityLabel={text}
    >
      {text}
    </AppText>
  );
}

export function ProductRateChangeLine({
  row,
  section,
  metric,
  compact = false,
}: {
  row: RateRow;
  section: SectionKey;
  metric?: RateMetric;
  compact?: boolean;
}) {
  const summary = useProductRateChangeSummary(row, section, metric);
  return (
    <ProductRateChangeSummaryLine model={summary} section={section} compact={compact} />
  );
}
