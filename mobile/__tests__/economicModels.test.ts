import {
  coverageLabelForDate,
  economicMomentumModel,
  economicPointAtOrBefore,
  economicPointsInWindow,
  economicReleaseRow,
  economicReleasesModel,
  indicatorHistoryModel,
  inflationExpectationsModel,
  meetingBiasModel,
  meetingLeanForIndicator,
  normalizeEconomicPoints,
  policyPathModel,
} from '../src/data/economicModels';
import type { EconomicOutlookPayload } from '../src/data/economicOutlook';

function payload(): EconomicOutlookPayload {
  const checkedAt = '2025-07-01T00:00:00.000Z';
  const sourceMeta = (frequency: 'monthly' | 'quarterly') => ({
    sourceUrl: 'https://www.rba.gov.au/statistics/tables/',
    checkedAt,
    frequency,
    status: 'current' as const,
  });
  const quarterly = [
    { date: '2024-03-31', value: 4.0 },
    { date: '2024-06-30', value: 3.8 },
    { date: '2024-09-30', value: 3.6 },
    { date: '2024-12-31', value: 3.4 },
    { date: '2025-03-31', value: 3.1 },
    { date: '2025-06-30', value: 2.9 },
  ];
  const monthlyJobs = Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.UTC(2024, index, 28)).toISOString().slice(0, 10),
    value: 3.8 + index * 0.05,
  }));
  return {
    schema_version: 2,
    fetchedAt: checkedAt,
    checkedAt,
    refreshStatus: 'current',
    indicators: [
      {
        id: 'underlying_inflation',
        label: 'Underlying inflation',
        shortLabel: 'Trimmed mean',
        publicationDate: '2025-07-01',
        points: quarterly,
        targetBand: [2, 3],
        signal: { direction: 'balanced', label: 'Inside band', explanation: 'Test' },
        ...sourceMeta('quarterly'),
      },
      {
        id: 'unemployment',
        label: 'Unemployment',
        shortLabel: 'Seasonally adjusted',
        publicationDate: '2025-03-01',
        points: monthlyJobs,
        signal: { direction: 'lower', label: 'Rising', explanation: 'Test' },
        ...sourceMeta('monthly'),
      },
      {
        id: 'wages',
        label: 'Wage growth',
        shortLabel: 'WPI',
        publicationDate: '2025-07-01',
        points: quarterly.map((point) => ({ ...point, value: point.value + 0.5 })),
        signal: { direction: 'balanced', label: 'Mixed', explanation: 'Test' },
        ...sourceMeta('quarterly'),
      },
      {
        id: 'inflation_expectations',
        label: 'Inflation expectations',
        shortLabel: 'One year ahead',
        publicationDate: '2025-07-01',
        points: quarterly.map((point) => ({ ...point, value: point.value - 0.2 })),
        targetBand: [2, 3],
        signal: { direction: 'balanced', label: 'Inside band', explanation: 'Test' },
        ...sourceMeta('quarterly'),
      },
    ],
    cashRateForecast: {
      surveyDate: '2025-06-15',
      publicationDate: '2025-06-20',
      points: [
        { date: '2025-09-01', value: 3.85 },
        { date: '2026-03-01', value: 3.6 },
      ],
    },
  };
}

describe('economic graph models', () => {
  it('sorts, validates and lets the final duplicate observation win', () => {
    expect(normalizeEconomicPoints([
      { date: 'bad', value: 2 },
      { date: '2025-02-01', value: 3 },
      { date: '2025-01-01', value: 2 },
      { date: '2025-02-01', value: 4 },
      { date: '2025-03-01', value: Number.NaN },
    ])).toEqual([
      { date: '2025-01-01', value: 2 },
      { date: '2025-02-01', value: 4 },
    ]);
  });

  it('keeps one observation before a time-window boundary for visual continuity', () => {
    const points = [
      { date: '2020-01-01', value: 1 },
      { date: '2023-12-31', value: 2 },
      { date: '2024-12-31', value: 3 },
      { date: '2025-12-31', value: 4 },
    ];
    expect(economicPointsInWindow(points, '1Y').map((point) => point.date)).toEqual([
      '2023-12-31',
      '2024-12-31',
      '2025-12-31',
    ]);
  });

  it('does not expose a series value before its first observation date', () => {
    const points = [
      { date: '2026-06-01', value: 4.1 },
      { date: '2026-12-01', value: 3.9 },
    ];
    expect(economicPointAtOrBefore(points, '2026-05-01')).toBeNull();
    expect(economicPointAtOrBefore(points, '2026-09-01')).toEqual({
      date: '2026-06-01',
      value: 4.1,
    });
  });

  it('builds a selected indicator history with latest change and target band', () => {
    const model = indicatorHistoryModel(payload(), 'underlying_inflation', 'All');
    expect(model?.latest).toEqual({ date: '2025-06-30', value: 2.9 });
    expect(model?.change).toBe(-0.2);
    expect(model?.targetBand).toEqual([2, 3]);
    expect(model?.summary).toContain('-0.20 percentage points');
  });

  it('compares inflation and expectations on their common percent scale', () => {
    const model = inflationExpectationsModel(payload(), 'All');
    expect(model?.inflation.at(-1)?.value).toBe(2.9);
    expect(model?.expectations.at(-1)?.value).toBeCloseTo(2.7);
    expect(model?.targetBand).toEqual([2, 3]);
  });

  it('uses series-appropriate observation periods for momentum', () => {
    const model = economicMomentumModel(payload());
    expect(model?.rows.find((row) => row.id === 'unemployment')?.periods).toBe(6);
    expect(model?.rows.find((row) => row.id === 'underlying_inflation')?.periods).toBe(4);
    expect(model?.rows.find((row) => row.id === 'unemployment')?.policyPressure).toBe('lower');
    expect(model?.summary).toContain('percentage points');
  });

  it('joins the future forecast to the last actual cash-rate point', () => {
    const model = policyPathModel(payload(), [
      { date: '2024-11-01', rate: 4.35 },
      { date: '2025-05-01', rate: 4.1 },
    ], 'All');
    expect(model?.actual.at(-1)).toEqual({ date: '2025-05-01', value: 4.1 });
    expect(model?.forecast).toEqual([
      { date: '2025-05-01', value: 4.1 },
      { date: '2025-09-01', value: 3.85 },
      { date: '2026-03-01', value: 3.6 },
    ]);
    expect(model?.forecastStart).toBe('2025-09-01');
    expect(model?.summary).toContain('reaches 3.60 percent by 2026-03-01');
  });

  it('does not plot forecast observations dated before the latest actual rate', () => {
    const data = payload();
    data.cashRateForecast!.points.unshift({ date: '2024-01-01', value: 4.5 });
    const model = policyPathModel(data, [{ date: '2025-05-01', rate: 4.1 }], 'All');
    expect(model?.forecast.some((point) => point.date === '2024-01-01')).toBe(false);
  });

  it('uses official cash-rate history so long policy windows are populated', () => {
    const data = payload();
    data.cashRateHistory = [
      { date: '2016-08-03', value: 1.5 },
      { date: '2019-07-03', value: 1.0 },
      { date: '2020-03-20', value: 0.25 },
      { date: '2022-05-04', value: 0.35 },
      { date: '2023-11-08', value: 4.35 },
      { date: '2025-05-01', value: 4.0 },
    ];
    const all = policyPathModel(data, [{ date: '2025-05-01', rate: 4.1 }], 'All');
    const fiveYear = policyPathModel(data, [{ date: '2025-05-01', rate: 4.1 }], '5Y');
    const oneYear = policyPathModel(data, [{ date: '2025-05-01', rate: 4.1 }], '1Y');
    expect(all?.actual.map((point) => point.date)).toEqual([
      '2016-08-03',
      '2019-07-03',
      '2020-03-20',
      '2022-05-04',
      '2023-11-08',
      '2025-05-01',
    ]);
    // core.rba wins on the shared date after merge+normalize.
    expect(all?.actual.at(-1)?.value).toBe(4.1);
    expect(fiveYear?.actual[0]?.date).toBe('2020-03-20');
    expect(fiveYear?.actual.at(-1)?.date).toBe('2025-05-01');
    expect(oneYear?.actual.map((point) => point.date)).toEqual([
      '2023-11-08',
      '2025-05-01',
    ]);
  });

  it('windows long indicator histories for every chart range', () => {
    const data = payload();
    const inflation = data.indicators.find((item) => item.id === 'underlying_inflation')!;
    inflation.points = Array.from({ length: 40 }, (_, index) => ({
      date: new Date(Date.UTC(2016, index * 3 + 2, 28)).toISOString().slice(0, 10),
      value: 2 + index * 0.05,
    }));
    const all = indicatorHistoryModel(data, 'underlying_inflation', 'All');
    const fiveYear = indicatorHistoryModel(data, 'underlying_inflation', '5Y');
    const threeYear = indicatorHistoryModel(data, 'underlying_inflation', '3Y');
    const oneYear = indicatorHistoryModel(data, 'underlying_inflation', '1Y');
    expect(all?.points).toHaveLength(40);
    expect(fiveYear?.points.length).toBeGreaterThan(oneYear!.points.length);
    expect(threeYear?.points.length).toBeGreaterThan(oneYear!.points.length);
    expect(fiveYear?.points.length).toBeGreaterThanOrEqual(threeYear!.points.length);
    expect(oneYear?.points.at(-1)).toEqual(all?.points.at(-1));
  });

  it('builds chronological release rows with vs-prior and tempered meeting lean', () => {
    expect(coverageLabelForDate('2026-06-30')).toBe('Jun 2026');
    const data = payload();
    data.indicators.push({
      id: 'headline_inflation',
      label: 'Headline CPI',
      shortLabel: 'All groups',
      publicationDate: '2026-07-29',
      observationDate: '2026-06-30',
      points: [
        { date: '2026-05-31', value: 4.0 },
        { date: '2026-06-30', value: 3.8 },
      ],
      targetBand: [2, 3],
      signal: {
        direction: 'higher',
        label: 'Above 2–3% band',
        explanation: 'Persistent inflation pressure can make cuts harder.',
      },
      sourceUrl: 'https://www.abs.gov.au/',
      checkedAt: '2026-07-29T00:00:00.000Z',
      frequency: 'monthly',
      status: 'current',
      sourceAgency: 'abs',
    });
    const headline = data.indicators.find((item) => item.id === 'headline_inflation')!;
    expect(meetingLeanForIndicator(headline).lean).toBe('hold');
    const row = economicReleaseRow(headline);
    expect(row?.coverageLabel).toBe('Jun 2026');
    expect(row?.updateDate).toBe('2026-07-29');
    expect(row?.vsPrior).toBe('below');
    expect(row?.delta).toBe(-0.2);
    expect(row?.meetingLean).toBe('hold');
    const rows = economicReleasesModel(data);
    expect(rows[0]?.id).toBe('headline_inflation');
    const bias = meetingBiasModel(data);
    expect(bias?.rows.length).toBeGreaterThan(0);
    expect(['cut', 'raise', 'hold']).toContain(bias!.lean);
    expect(bias?.rationale).toContain('interpretation');
  });
});
