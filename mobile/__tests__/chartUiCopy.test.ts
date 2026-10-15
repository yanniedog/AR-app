import type { EconomicIndicatorId } from '../src/data/economicOutlook';
import { uiCalendarMonth, uiChartBps, uiChartDate, uiChartPercent, uiChartPp, uiChartSection, uiChartWindow, uiEconomicIndicator, uiMomentumWindow, uiResponseDays } from '../src/lib/chartUiCopy';

test('only canonical economic IDs admit a heading, never supplied wording', () => {
  expect(uiEconomicIndicator('underlying_inflation')).toBe('Underlying inflation');
  expect(uiEconomicIndicator('headline_inflation')).toBe('Headline CPI');
  expect(uiEconomicIndicator('Market rates will rise. Tap to learn more.' as EconomicIndicatorId)).toBe('Unknown');
});
test('sections and windows preserve their financial scope', () => {
  expect(uiChartSection('Mortgage')).toBe('Home loans');
  expect(uiChartSection('TD')).toBe('Term deposits');
  expect(uiChartWindow('30D')).toBe('30 days');
  expect(uiChartWindow('3Y')).toBe('3 years');
  expect(uiChartWindow('All')).toBe('All');
  expect(uiChartWindow('Read more about this view')).toBe('Unknown');
});
test('percentage source values and signed movement units remain distinct', () => {
  expect(uiChartPercent(4.35)).toBe('4.35%');
  expect(uiChartBps(-25)).toBe('−25.0 bps');
  expect(uiChartPp(0.25)).toBe('+0.25 pp');
});
test.each([null, undefined, NaN, Infinity, -Infinity])('unknown numeric observation %s never becomes zero', value => {
  expect(uiChartPercent(value)).toBe('Unknown');
  expect(uiChartBps(value)).toBe('Unknown');
  expect(uiChartPp(value)).toBe('Unknown');
  expect(uiResponseDays(value)).toBe('Timing unknown');
});
test('partial timing stays an upper bound and real zero-day responses remain zero', () => {
  expect(uiResponseDays(4, true)).toBe('≤4 days');
  expect(uiResponseDays(0)).toBe('0 days');
});
test('compact dates reject invalid calendars and descriptions', () => {
  expect(uiChartDate('2026-10-14')).toBe('14 Oct');
  expect(uiChartDate('2026-10-14', true)).toBe('Oct 26');
  expect(uiChartDate('2026-02-31')).toBe('Unknown');
  expect(uiChartDate('Select a month')).toBe('Unknown');
  expect(uiCalendarMonth('Oct')).toBe('Oct');
  expect(uiCalendarMonth('Interest depends on conditions.')).toBe('Unknown');
});

test('momentum retains monthly or unspecified observation units without supplied prose', () => {
  expect(uiMomentumWindow({ periods: 6, periodLabel: 'last 6 monthly observations' })).toBe('6 Monthly observations');
  expect(uiMomentumWindow({ periods: 4, periodLabel: 'last 4 observations' })).toBe('4 Observations');
  expect(uiMomentumWindow({ periods: 4, periodLabel: 'Read the instructions.' })).toBe('Unknown');
});
