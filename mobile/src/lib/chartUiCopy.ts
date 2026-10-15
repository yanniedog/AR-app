import type { EconomicIndicatorId, EconomicPressure } from '../data/economicOutlook';
import type { BankMoveDir } from '../data/bankInsights';
import type { SectionKey } from '../types';
import { uiDate, uiDuration, uiJoin, uiLabel, uiNumber, type UiText } from './uiCopy';

export function uiChartSection(section: SectionKey): UiText {
  switch (section) {
    case 'Mortgage': return uiLabel('Home loans');
    case 'Savings': return uiLabel('Savings');
    case 'TD': return uiLabel('Term deposits');
  }
}
/** Only canonical indicator IDs admit a display name; source descriptions never do. */
export function uiEconomicIndicator(id: EconomicIndicatorId): UiText {
  switch (id) {
    case 'underlying_inflation': return uiLabel('Underlying inflation');
    case 'headline_inflation': return uiLabel('Headline CPI');
    case 'unemployment': return uiLabel('Unemployment');
    case 'participation': return uiLabel('Participation');
    case 'employment_growth': return uiLabel('Jobs growth');
    case 'wages': return uiLabel('Wages');
    case 'inflation_expectations': return uiLabel('Market 1Y expectations');
    case 'consumer_inflation_expectations': return uiLabel('Consumer expectations');
    default: return uiLabel('Unknown');
  }
}
export function uiEconomicPressure(direction: EconomicPressure): UiText {
  return uiLabel(direction === 'higher' ? 'Higher' : direction === 'lower' ? 'Lower' : 'Balanced');
}
export function uiChartMove(section: SectionKey, direction: BankMoveDir): UiText {
  return uiLabel(direction === 'mixed' ? 'Mixed' : section === 'Mortgage'
    ? direction === 'cut' ? 'Cut' : 'Hike' : direction === 'cut' ? 'Decrease' : 'Increase');
}
export function uiChartBps(value: number | null | undefined): UiText {
  return value == null || !Number.isFinite(value) ? uiLabel('Unknown')
    : uiJoin(value > 0 ? '+' : value < 0 ? '−' : '', uiNumber(Math.abs(value), 1), ' ', 'bps');
}
/** Economic/RBA source values are percentages, not decimal rate fractions. */
export function uiChartPercent(value: number | null | undefined, digits = 2): UiText {
  return value == null || !Number.isFinite(value) ? uiLabel('Unknown') : uiJoin(uiNumber(value, digits), '%');
}
export function uiChartPp(value: number | null | undefined): UiText {
  return value == null || !Number.isFinite(value) ? uiLabel('Unknown')
    : uiJoin(value > 0 ? '+' : value < 0 ? '−' : '', uiNumber(Math.abs(value), 2), ' ', 'pp');
}
export function uiChartWindow(value: string): UiText {
  switch (value) {
    case '7D': return uiDuration(7, 'days');
    case '30D': return uiDuration(30, 'days');
    case '90D': return uiDuration(90, 'days');
    case '180D': return uiDuration(180, 'days');
    case '1Y': return uiDuration(1, 'years');
    case '3Y': return uiDuration(3, 'years');
    case '5Y': return uiDuration(5, 'years');
    case 'All': case 'ALL': return uiLabel('All');
    default: return uiLabel('Unknown');
  }
}
export function uiChartObserved(date: string | null | undefined): UiText {
  return uiJoin('Observed', ' · ', uiDate(date));
}

const CHART_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** Compact date facts keep small axes readable without admitting arbitrary labels. */
export function uiChartDate(value: string | null | undefined, monthYear = false): UiText {
  const day = value?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return uiLabel('Unknown');
  const date = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return uiLabel('Unknown');
  const month = CHART_MONTHS[date.getUTCMonth()];
  return monthYear ? uiJoin(month, ' ', uiNumber(date.getUTCFullYear() % 100))
    : uiJoin(uiNumber(date.getUTCDate()), ' ', month);
}

export function uiResponseDays(value: number | null | undefined, partial = false): UiText {
  return value == null || !Number.isFinite(value) ? uiLabel('Timing unknown')
    : uiJoin(partial ? '≤' : '', uiDuration(value, 'days'));
}
export function uiCalendarMonth(value: string): UiText {
  return uiLabel(CHART_MONTHS.find(month => month === value) ?? 'Unknown');
}

/** Momentum windows come from the canonical model's two generated observation units. */
export function uiMomentumWindow(row: { periods: number; periodLabel: string }): UiText {
  const unit = row.periodLabel === 'last '+row.periods+' monthly observations' ? 'Monthly observations'
    : row.periodLabel === 'last '+row.periods+' observations' ? 'Observations' : null;
  return unit && Number.isFinite(row.periods) ? uiJoin(uiNumber(row.periods), ' ', unit) : uiLabel('Unknown');
}
