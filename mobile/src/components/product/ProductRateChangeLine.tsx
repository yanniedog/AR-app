import React, { useMemo } from 'react';

import { formatRate, formatRateChangeDate } from '../../data/format';
import type { ProductBestRateSummary } from '../../data/productHistoryModel';
import { exactRateMove, rateEvidenceId } from '../../data/exactRateMove';
import { sourceRowForPublicRow } from '../../data/publicRateIntegration';
import { useStore } from '../../data/store';
import { moveTone } from '../../lib/moveSemantics';
import type { RateRow, SectionKey } from '../../types';
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
    ? uiJoin('Advertised rate', ' ', arrow, ' ', bpsMagnitude(summary.bps), ' · ', when)
    : uiJoin('Advertised rate', ' ', arrow, ' ', bpsMagnitude(summary.bps), ' · ', when, ' · ', formatRate(summary.fromRate), ' → ', formatRate(summary.toRate));
}

export function useProductRateChangeSummary(
  row: RateRow, section: SectionKey, displayed: number | string | null | undefined,
): ProductBestRateSummary | null {
  const core = useStore(state => state.core);
  return useMemo(() => exactRateMove(core, section, sourceRowForPublicRow(row), displayed),
    [core, row, section, displayed]);
}

export function ProductRateChangeSummaryLine({
  section,
  compact = false,
  model,
  evidenceId,
}: {
  section: SectionKey;
  compact?: boolean;
  model: ProductBestRateSummary | null;
  evidenceId?: string;
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
      testID={evidenceId}
      accessibilityLabel={text}
    >
      {text}
    </AppText>
  );
}

export function ProductRateChangeLine({
  row,
  section,
  displayed,
  compact = false,
}: {
  row: RateRow;
  section: SectionKey;
  displayed: number | string | null | undefined;
  compact?: boolean;
}) {
  const manifest = useStore(state => state.manifest);
  const summary = useProductRateChangeSummary(row, section, displayed);
  return (
    <ProductRateChangeSummaryLine evidenceId={summary ? rateEvidenceId('rate-move', manifest, section, row) : undefined} model={summary} section={section} compact={compact} />
  );
}
