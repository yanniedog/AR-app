import React, { useMemo } from 'react';

import { formatRate, formatRateChangeDate } from '../../data/format';
import {
  bestRateForProduct,
  summarizeProductBestRateSeries,
  type CurrentProductBestRate,
  type ProductBestRateSummary,
} from '../../data/productHistory';
import { useStore } from '../../data/store';
import { moveTone } from '../../lib/moveSemantics';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../ui';

function bpsMagnitude(bps: number): string {
  const rounded = Math.round(Math.abs(bps) * 10) / 10;
  return `${rounded} bp${rounded === 1 ? '' : 's'}`;
}

export function productRateChangeText(
  summary: ProductBestRateSummary | null,
  compact = false,
): string | null {
  if (!summary) return null;
  if (summary.kind === 'tracking' || summary.kind === 'unchanged') return null;

  const arrow = summary.bps > 0 ? '↑' : '↓';
  const verb = summary.bps > 0 ? 'rose' : 'fell';
  const when = formatRateChangeDate(summary.observedOn);
  return compact
    ? `${arrow} ${bpsMagnitude(summary.bps)} · ${when}`
    : `Published rate ${verb} ${bpsMagnitude(summary.bps)} · ${when} · ${formatRate(
        summary.fromRate,
      )} → ${formatRate(summary.toRate)}`;
}

export function useProductRateChangeSummary(
  productKey: string,
  current?: CurrentProductBestRate,
): ProductBestRateSummary | null {
  const runDates = useStore((state) => state.productHistory?.run_dates ?? null);
  const series = useStore((state) => state.productHistory?.products?.[productKey] ?? null);
  const coreRunDate = useStore((state) => state.core?.run_date ?? null);
  const coreBestRate = useStore((state) => bestRateForProduct(state.core, productKey));
  const currentDate = current?.date ?? coreRunDate;
  const currentRate = current?.rate ?? coreBestRate;
  return useMemo(
    () => {
      return summarizeProductBestRateSeries(runDates, series, {
        date: currentDate,
        rate: currentRate,
      });
    },
    [currentDate, currentRate, runDates, series],
  );
}

export function ProductRateChangeSummaryLine({
  section,
  compact = false,
  summary,
}: {
  section: SectionKey;
  compact?: boolean;
  summary: ProductBestRateSummary | null;
}) {
  const theme = useTheme();
  const text = productRateChangeText(summary, compact);
  if (!text) return null;

  const tone = summary?.kind === 'changed' ? moveTone(section, summary.bps) : 'muted';
  const color =
    tone === 'success'
      ? theme.colors.success
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.textFaint;

  return (
    <AppText
      variant="tiny"
      weight={summary?.kind === 'changed' ? '700' : '400'}
      style={{ color, marginTop: compact ? 3 : 8, textAlign: compact ? 'left' : 'center' }}
      accessibilityLabel={text.replace('↑', 'up').replace('↓', 'down')}
    >
      {text}
    </AppText>
  );
}

export function ProductRateChangeLine({
  productKey,
  section,
  current,
  compact = false,
}: {
  productKey: string;
  section: SectionKey;
  current?: CurrentProductBestRate;
  compact?: boolean;
}) {
  const summary = useProductRateChangeSummary(productKey, current);
  return (
    <ProductRateChangeSummaryLine summary={summary} section={section} compact={compact} />
  );
}
