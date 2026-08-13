import type { RateRow, SectionKey } from '../types';
import { toFraction } from './format';
import type { MortgageRateMetric } from './selectors';

export type RateDisplayLabel = 'Advertised rate' | 'Comparison rate' | 'Rate';

export interface RatePresentation {
  primary: number | null;
  primaryLabel: RateDisplayLabel;
  secondary: number | null;
  secondaryLabel: Exclude<RateDisplayLabel, 'Rate'> | null;
}

/** One source of truth for the visual and spoken mortgage-rate hierarchy. */
export function ratePresentation(
  row: Pick<RateRow, 'rate' | 'comparison_rate'>,
  section: SectionKey,
  mortgageMetric: MortgageRateMetric = 'comparison',
): RatePresentation {
  const advertised = toFraction(row.rate);
  if (section !== 'Mortgage') {
    return {
      primary: advertised,
      primaryLabel: 'Rate',
      secondary: null,
      secondaryLabel: null,
    };
  }

  const comparison = toFraction(row.comparison_rate);
  if (mortgageMetric === 'comparison' && comparison !== null) {
    return {
      primary: comparison,
      primaryLabel: 'Comparison rate',
      secondary: advertised,
      secondaryLabel: advertised === null ? null : 'Advertised rate',
    };
  }
  return {
    primary: advertised,
    primaryLabel: 'Advertised rate',
    secondary: comparison,
    secondaryLabel: comparison === null ? null : 'Comparison rate',
  };
}
