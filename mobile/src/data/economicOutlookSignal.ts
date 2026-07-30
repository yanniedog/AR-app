import {
  ABS_CPI_RELEASE_URL,
  ECONOMIC_URLS,
  type EconomicIndicator,
  type EconomicIndicatorId,
  type EconomicOutlookPayload,
  type EconomicPoint,
  type EconomicSignal,
  type ParsedSeries,
  type RequiredSourceKey,
} from './economicOutlookTypes';
import {
  parseAbsCpiCsv,
  parseCashForecastCsv,
  parseCashRateTargetCsv,
  parseRbaSeriesCsv,
  preferNewerSeries,
} from './economicOutlookParse';

const MONTHLY_STALE_MS = 45 * 24 * 60 * 60 * 1000;
const QUARTERLY_STALE_MS = 120 * 24 * 60 * 60 * 1000;

/** @internal reused by loadEconomicOutlook */
export const URLS = ECONOMIC_URLS;

export interface IndicatorDefinition {
  source: RequiredSourceKey;
  id: EconomicIndicatorId;
  label: string;
  shortLabel: string;
  seriesId: string;
  frequency: EconomicIndicator['frequency'];
  targetBand?: [number, number];
}

/**
 * Official RBA series shown in Outlook. Extra labour / inflation series reuse the
 * same four CSV tables — one network fetch per table, then multiple series parses.
 * Full published history is retained so 1Y / 3Y / 5Y / All chart windows have data.
 */
export const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  {
    source: 'inflation',
    id: 'underlying_inflation',
    label: 'Underlying inflation',
    shortLabel: 'Trimmed mean · year-ended',
    seriesId: 'GCPIOCPMTMYP',
    frequency: 'quarterly',
    targetBand: [2, 3],
  },
  {
    source: 'inflation',
    id: 'headline_inflation',
    label: 'Headline CPI',
    shortLabel: 'All groups · year-ended',
    seriesId: 'GCPIAGYP',
    frequency: 'quarterly',
    targetBand: [2, 3],
  },
  {
    source: 'labour',
    id: 'unemployment',
    label: 'Unemployment',
    shortLabel: 'Seasonally adjusted',
    seriesId: 'GLFSURSA',
    frequency: 'monthly',
  },
  {
    source: 'labour',
    id: 'participation',
    label: 'Participation',
    shortLabel: 'Labour force participation',
    seriesId: 'GLFSPRSA',
    frequency: 'monthly',
  },
  {
    source: 'labour',
    id: 'employment_growth',
    label: 'Employment growth',
    shortLabel: 'Year-ended · seasonally adjusted',
    seriesId: 'GLFSEPTSYP',
    frequency: 'monthly',
  },
  {
    source: 'wages',
    id: 'wages',
    label: 'Wage growth',
    shortLabel: 'WPI · year-ended',
    seriesId: 'GWPIYP',
    frequency: 'quarterly',
  },
  {
    source: 'expectations',
    id: 'inflation_expectations',
    label: 'Market expectations',
    shortLabel: 'Economists · 1 year ahead',
    seriesId: 'GMAREXPY',
    frequency: 'quarterly',
    targetBand: [2, 3],
  },
  {
    source: 'expectations',
    id: 'consumer_inflation_expectations',
    label: 'Consumer expectations',
    shortLabel: 'Households · 1 year ahead',
    seriesId: 'GCONEXP',
    frequency: 'quarterly',
  },
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointDelta(points: EconomicPoint[], periodsBack: number): number | null {
  if (points.length <= periodsBack) return null;
  return round(points[points.length - 1].value - points[points.length - 1 - periodsBack].value);
}

export function indicatorIsStale(
  publicationDate: string,
  frequency: EconomicIndicator['frequency'],
  nowMs = Date.now(),
): boolean {
  const publishedMs = Date.parse(`${publicationDate}T00:00:00Z`);
  if (!Number.isFinite(publishedMs)) return true;
  const limit = frequency === 'monthly' ? MONTHLY_STALE_MS : QUARTERLY_STALE_MS;
  return nowMs - publishedMs > limit;
}

export function economicSignal(
  id: EconomicIndicatorId,
  points: EconomicPoint[],
): EconomicSignal {
  const latest = points[points.length - 1]?.value;
  if (latest == null) {
    return { direction: 'balanced', label: 'No current read', explanation: 'Awaiting a current observation.' };
  }
  if (
    id === 'underlying_inflation' ||
    id === 'headline_inflation' ||
    id === 'inflation_expectations'
  ) {
    if (latest > 3) {
      return {
        direction: 'higher',
        label: 'Above 2–3% band',
        explanation: 'Persistent inflation pressure can make cuts harder and increases the case for tighter policy.',
      };
    }
    if (latest < 2) {
      return {
        direction: 'lower',
        label: 'Below 2–3% band',
        explanation: 'Sub-target inflation pressure can increase room for easier policy if other data agree.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Inside 2–3% band',
      explanation: 'Being inside the band reduces this signal, but persistence and the direction of travel still matter.',
    };
  }
  if (id === 'consumer_inflation_expectations') {
    const delta = pointDelta(points, 4);
    if (latest >= 5 || (delta != null && delta >= 0.5)) {
      return {
        direction: 'higher',
        label: latest >= 5 ? 'Elevated household read' : `Up ${delta!.toFixed(1)} pp in a year`,
        explanation: 'High or rising consumer inflation expectations can entrench price-setting behaviour.',
      };
    }
    if (delta != null && delta <= -0.5) {
      return {
        direction: 'lower',
        label: `Down ${Math.abs(delta).toFixed(1)} pp in a year`,
        explanation: 'Cooling household inflation expectations can ease the persistence of price pressure.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Households broadly steady',
      explanation: 'Consumer expectations are noisy; the RBA weighs them alongside market and business surveys.',
    };
  }
  if (id === 'unemployment') {
    const delta = pointDelta(points, 6);
    if (delta != null && delta >= 0.2) {
      return {
        direction: 'lower',
        label: `Up ${delta.toFixed(1)} pp in 6m`,
        explanation: 'A loosening labour market can reduce wage and demand pressure, adding to the case for easier policy.',
      };
    }
    if (delta != null && delta <= -0.2) {
      return {
        direction: 'higher',
        label: `Down ${Math.abs(delta).toFixed(1)} pp in 6m`,
        explanation: 'A tightening labour market can add wage and demand pressure, increasing the case for tighter policy.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Broadly steady in 6m',
      explanation: 'The unemployment rate alone is neutral; the RBA assesses a wider suite of labour-market measures.',
    };
  }
  if (id === 'participation') {
    const delta = pointDelta(points, 6);
    if (delta != null && delta >= 0.3) {
      return {
        direction: 'higher',
        label: `Up ${delta.toFixed(1)} pp in 6m`,
        explanation: 'Rising participation can expand labour supply, but strong engagement often accompanies firm demand.',
      };
    }
    if (delta != null && delta <= -0.3) {
      return {
        direction: 'lower',
        label: `Down ${Math.abs(delta).toFixed(1)} pp in 6m`,
        explanation: 'Falling participation can signal softer labour-market attachment alongside weaker demand.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Participation steady',
      explanation: 'Participation is a context series for the unemployment rate rather than a standalone policy trigger.',
    };
  }
  if (id === 'employment_growth') {
    const delta = pointDelta(points, 6);
    if (latest >= 2.5 && (delta == null || delta >= -0.3)) {
      return {
        direction: 'higher',
        label: 'Firm jobs growth',
        explanation: 'Strong year-ended employment growth supports demand and can keep labour-market pressure elevated.',
      };
    }
    if (latest <= 0.5 || (delta != null && delta <= -1)) {
      return {
        direction: 'lower',
        label: latest <= 0.5 ? 'Soft jobs growth' : 'Jobs growth slowing',
        explanation: 'Weak or slowing employment growth can ease capacity pressure and wage bargaining strength.',
      };
    }
    return {
      direction: 'balanced',
      label: 'Jobs growth moderate',
      explanation: 'Moderate employment growth is consistent with a labour market that is neither overheating nor collapsing.',
    };
  }
  const annualDelta = pointDelta(points, 4);
  if (latest > 3.5 && (annualDelta == null || annualDelta >= -0.1)) {
    return {
      direction: 'higher',
      label: 'Firm wage growth',
      explanation: 'Firm wage growth can sustain services inflation when productivity growth does not offset it.',
    };
  }
  if (latest < 3 || (annualDelta != null && annualDelta <= -0.3)) {
    return {
      direction: 'lower',
      label: 'Wage pressure easing',
      explanation: 'Cooling wage growth can reduce domestic inflation pressure, adding to the case for easier policy.',
    };
  }
  return {
    direction: 'balanced',
    label: 'Wage pressure mixed',
    explanation: 'Wage growth is neither an obvious tightening nor easing signal without productivity context.',
  };
}

export function buildEconomicOutlookFromCsv(input: {
  inflation: string;
  expectations: string;
  labour: string;
  wages: string;
  cashForecast?: string | null;
  cashRate?: string | null;
  /** Optional ABS headline CPI CSV; preferred when newer than RBA G1. */
  absHeadline?: string | null;
  absHeadlinePublicationDate?: string;
}, fetchedAt = new Date().toISOString()): EconomicOutlookPayload {
  // Soft-skip series missing from a table so unit fixtures can ship one column.
  const indicators = INDICATOR_DEFINITIONS.flatMap((definition) => {
    try {
      let parsed = parseRbaSeriesCsv(input[definition.source], definition.seriesId);
      let sourceUrl: string = URLS[definition.source];
      let frequency = definition.frequency;
      let shortLabel = definition.shortLabel;
      if (definition.id === 'headline_inflation' && input.absHeadline) {
        try {
          const abs = parseAbsCpiCsv(
            input.absHeadline,
            input.absHeadlinePublicationDate ?? '',
          );
          parsed = preferNewerSeries(abs, parsed);
          if (parsed.sourceAgency === 'abs') {
            sourceUrl = ABS_CPI_RELEASE_URL;
            frequency = 'monthly';
            shortLabel = 'All groups · year-ended · monthly';
          }
        } catch {
          // Keep RBA headline when ABS parse fails.
        }
      }
      return [buildIndicator(definition, parsed, fetchedAt, {
        sourceUrl,
        frequency,
        shortLabel,
      })];
    } catch {
      return [];
    }
  });
  let cashRateHistory: EconomicPoint[] | undefined;
  if (input.cashRate) {
    try {
      cashRateHistory = parseCashRateTargetCsv(input.cashRate);
    } catch {
      cashRateHistory = undefined;
    }
  }
  return {
    schema_version: 2,
    fetchedAt,
    checkedAt: fetchedAt,
    refreshStatus: 'current',
    indicators,
    cashRateForecast: input.cashForecast ? parseCashForecastCsv(input.cashForecast) : null,
    cashRateHistory,
  };
}

export function buildIndicator(
  definition: IndicatorDefinition,
  parsed: ParsedSeries,
  checkedAt: string,
  overrides?: {
    sourceUrl?: string;
    frequency?: EconomicIndicator['frequency'];
    shortLabel?: string;
  },
): EconomicIndicator {
  const points = parsed.points;
  const frequency = overrides?.frequency ?? definition.frequency;
  const observationDate = points.at(-1)?.date;
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: overrides?.shortLabel ?? definition.shortLabel,
    publicationDate: parsed.publicationDate,
    observationDate,
    points,
    targetBand: definition.targetBand,
    signal: economicSignal(definition.id, points),
    sourceUrl: overrides?.sourceUrl ?? URLS[definition.source],
    checkedAt,
    frequency,
    status: indicatorIsStale(parsed.publicationDate, frequency) ? 'stale' : 'current',
    sourceAgency: parsed.sourceAgency ?? 'rba',
  };
}

