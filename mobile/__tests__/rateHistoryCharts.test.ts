import { mergeProductHistoryTimeline, rateHistoryChartModel } from '../src/data/rateHistoryCharts';
import type { BankRateSnapshot, RateSummary } from '../src/data/bankRateOverview';

const dates = ['2026-09-20', '2026-09-21', '2026-09-22'];
const summary: RateSummary = { min: 1, max: 9, mean: 3, median: 1, count: 4 };
const blank = (date: string) => ({ date, min: null, max: null, mean: null, median: null, count: 0 });

test('market history uses exact section totals in fractional units and retains missing days', () => {
  const snapshots: Record<string, BankRateSnapshot> = {
    [dates[2]]: { sectionTotals: { Mortgage: summary } },
    [dates[0]]: { sectionTotals: { Mortgage: { min: 0, max: 0, mean: 0, median: 0, count: 1 } } },
    [dates[1]]: {},
  };
  const result = rateHistoryChartModel(snapshots, 'Mortgage')!;
  expect(result.dates).toEqual(dates);
  expect(result.allDates).toEqual(dates);
  expect(result.points).toEqual([
    { date: dates[0], min: 0, max: 0, mean: 0, median: 0, count: 1 },
    blank(dates[1]),
    { date: dates[2], min: 0.01, max: 0.09, mean: 0.03, median: 0.01, count: 4 },
  ]);
});

test('selected provider shows its actual range and statistics without borrowing another bank', () => {
  const snapshots: Record<string, BankRateSnapshot> = {
    [dates[0]]: { Mortgage: { Withdrawn: summary, Other: { ...summary, mean: 8 } } },
    [dates[1]]: { Mortgage: { Other: summary } },
    [dates[2]]: {},
  };
  const result = rateHistoryChartModel(snapshots, 'Mortgage', 'Withdrawn')!;
  expect(result.points[0]).toEqual({ date: dates[0], min: 0.01, max: 0.09, mean: 0.03, median: 0.01, count: 4 });
  expect(result.points.slice(1)).toEqual(dates.slice(1).map(blank));
  expect(rateHistoryChartModel(snapshots, 'Mortgage', 'Unknown')).toBeNull();
  expect(rateHistoryChartModel(snapshots, 'Savings', 'Withdrawn')).toBeNull();
  // Per-bank summaries are insufficient evidence for an exact market median.
  expect(rateHistoryChartModel(snapshots, 'Mortgage')).toBeNull();
});

test('empty or invalid summaries cannot become observed zeros', () => {
  expect(rateHistoryChartModel(null, 'Mortgage')).toBeNull();
  expect(rateHistoryChartModel({}, 'Mortgage')).toBeNull();
  expect(rateHistoryChartModel({ [dates[0]]: { sectionTotals: { Mortgage: { ...summary, count: 0 } } } }, 'Mortgage')).toBeNull();
  expect(rateHistoryChartModel({ [dates[0]]: { sectionTotals: { Mortgage: { ...summary, median: NaN } } } }, 'Mortgage')).toBeNull();
});

test('independent product dates expand a shorter market timeline without filling market gaps', () => {
  const market = rateHistoryChartModel({ [dates[2]]: { sectionTotals: { Mortgage: summary } } }, 'Mortgage')!;
  const before = JSON.stringify(market);
  const result = mergeProductHistoryTimeline(market, 'Mortgage', [...dates, dates[0]], dates[2])!;
  expect(result.dates).toEqual(dates);
  expect(result.points.slice(0, 2)).toEqual(dates.slice(0, 2).map(blank));
  expect(result.points[2]).toEqual(market.points[0]);
  expect(JSON.stringify(market)).toBe(before);
});

test('product-only history has a usable axis, excludes future stale ledger dates, and never mixes sections', () => {
  const result = mergeProductHistoryTimeline(null, 'Savings', [...dates, '2026-09-23'], dates[2])!;
  expect(result.dates).toEqual(dates);
  expect(result.points).toEqual(dates.map(blank));
  const otherSection = rateHistoryChartModel({ [dates[0]]: { sectionTotals: { Mortgage: summary } } }, 'Mortgage');
  expect(mergeProductHistoryTimeline(otherSection, 'Savings', dates, dates[2])!.points).toEqual(dates.map(blank));
  expect(mergeProductHistoryTimeline(null, 'Savings', null)).toBeNull();
});
