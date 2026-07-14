import {
  bankTrendChartModel,
  marketPulse,
  normalizeBankInsightsPayload,
  rbaPassThrough,
  rbaPassThroughDecisionList,
  recentBankEvents,
  topMovers,
  type BankInsightsPayload,
} from '../src/data/bankInsights';
import type { RbaCalendar } from '../src/data/rbaCalendar';
import type { RbaEntry } from '../src/types';

const payload: BankInsightsPayload = {
  schema_version: 1,
  run_date: '2026-06-01',
  run_dates: ['2026-05-01', '2026-05-15', '2026-06-01'],
  banks: {
    AlphaBank: {
      Mortgage: {
        median: [0.06, 0.0595, 0.057],
        best: [0.055, 0.0545, 0.052],
        count: [10, 10, 10],
      },
    },
    BetaBank: {
      Mortgage: {
        median: [0.062, null, 0.062],
        best: [0.058, null, 0.058],
        count: [5, null, 5],
      },
    },
    GammaBank: {
      Savings: {
        median: [0.045, 0.046, 0.047],
        best: [0.05, 0.051, 0.052],
        count: [3, 3, 3],
      },
    },
  },
  events: [
    { date: '2026-05-15', provider: 'AlphaBank', section: 'Mortgage', dir: 'cut', moved: 4, total: 10, avg_bps: -25 },
    { date: '2026-06-01', provider: 'AlphaBank', section: 'Mortgage', dir: 'cut', moved: 8, total: 10, avg_bps: -10 },
    { date: '2026-06-01', provider: 'GammaBank', section: 'Savings', dir: 'hike', moved: 1, total: 3, avg_bps: 10 },
  ],
};

// RBA series is in PERCENT (dashboard parity); a 4.35 -> 4.10 step is a 25 bps cut.
const rba: RbaEntry[] = [
  { date: '2026-04-01', rate: 4.35 },
  { date: '2026-05-10', rate: 4.1 },
];

const calendar: RbaCalendar = {
  timezone: 'Australia/Sydney',
  decisions: [
    {
      date: '2026-05-10',
      effective: '2026-05-11',
      rate: 4.1,
      delta_bps: -25,
      outcome: 'cut',
    },
  ],
  schedule: [],
};

describe('normalizeBankInsightsPayload', () => {
  test('accepts a valid payload and keeps series aligned to run_dates', () => {
    const normalized = normalizeBankInsightsPayload(JSON.parse(JSON.stringify(payload)));
    expect(normalized).not.toBeNull();
    expect(normalized!.run_dates).toEqual(payload.run_dates);
    expect(normalized!.banks.BetaBank.Mortgage!.median).toEqual([0.062, null, 0.062]);
    expect(normalized!.events).toHaveLength(3);
  });

  test('pads short series and drops invalid events', () => {
    const normalized = normalizeBankInsightsPayload({
      schema_version: 1,
      run_date: '2026-06-01',
      run_dates: ['2026-05-01', '2026-06-01'],
      banks: { AlphaBank: { Mortgage: { median: [0.06], best: [0.055], count: [1] } } },
      events: [
        { date: '2026-06-01', provider: 'AlphaBank', section: 'NotASection', dir: 'cut', moved: 1, total: 1, avg_bps: -10 },
        { date: 'garbage', provider: 'AlphaBank', section: 'Mortgage', dir: 'cut', moved: 1, total: 1, avg_bps: -10 },
        { date: '2026-06-01', provider: 'AlphaBank', section: 'Mortgage', dir: 'sideways', moved: 1, total: 1, avg_bps: -10 },
      ],
    });
    expect(normalized!.banks.AlphaBank.Mortgage!.median).toEqual([0.06, null]);
    expect(normalized!.events).toEqual([]);
  });

  test('rejects payloads without usable bank series', () => {
    expect(normalizeBankInsightsPayload(null)).toBeNull();
    expect(normalizeBankInsightsPayload({ run_date: '2026-06-01', run_dates: [], banks: {} })).toBeNull();
    expect(
      normalizeBankInsightsPayload({
        run_date: '2026-06-01',
        run_dates: ['2026-06-01'],
        banks: { AlphaBank: { Mortgage: { median: [null], best: [null], count: [null] } } },
      }),
    ).toBeNull();
  });

  test('keeps behaviour summaries when present', () => {
    const normalized = normalizeBankInsightsPayload({
      ...payload,
      behaviour: {
        Mortgage: {
          section: 'Mortgage',
          window_days: 60,
          providers: {
            AlphaBank: {
              hike: { n: 0, days_median: null, bps_median: null, ratio_median: null, confidence: 'insufficient' },
              cut: { n: 2, days_median: 5, bps_median: 25, ratio_median: 1, confidence: 'insufficient' },
            },
          },
        },
      },
    });
    expect(normalized!.behaviour?.Mortgage?.providers.AlphaBank.cut).toMatchObject({
      n: 2,
      days_median: 5,
      ratio_median: 1,
    });
  });
});

describe('recentBankEvents', () => {
  test('sorts newest first, then provider', () => {
    const events = recentBankEvents(payload);
    expect(events.map((e) => `${e.date}:${e.provider}`)).toEqual([
      '2026-06-01:AlphaBank',
      '2026-06-01:GammaBank',
      '2026-05-15:AlphaBank',
    ]);
  });

  test('filters by section, provider, and limit', () => {
    expect(recentBankEvents(payload, { sections: ['Savings'] })).toHaveLength(1);
    expect(recentBankEvents(payload, { provider: 'AlphaBank' })).toHaveLength(2);
    expect(recentBankEvents(payload, { limit: 1 })[0].provider).toBe('AlphaBank');
    expect(recentBankEvents(null)).toEqual([]);
  });
});

describe('topMovers', () => {
  test('computes net median change over the window, cuts first', () => {
    const movers = topMovers(payload, 'Mortgage', 30);
    expect(movers[0]).toEqual({ provider: 'AlphaBank', netBps: -25, current: 0.057 });
    expect(movers[1]).toEqual({ provider: 'BetaBank', netBps: 0, current: 0.062 });
  });

  test('skips sections with no series', () => {
    expect(topMovers(payload, 'TD', 30)).toEqual([]);
    expect(topMovers(null, 'Mortgage', 30)).toEqual([]);
  });
});

describe('bankTrendChartModel', () => {
  test('band spans best to median with correct ordering for loans', () => {
    const model = bankTrendChartModel(payload, 'AlphaBank', 'Mortgage');
    expect(model!.dates).toEqual(payload.run_dates);
    expect(model!.points[0]).toMatchObject({ min: 0.055, max: 0.06, mean: 0.06 });
  });

  test('orders band correctly when best is above median (deposits)', () => {
    const model = bankTrendChartModel(payload, 'GammaBank', 'Savings');
    expect(model!.points[0]).toMatchObject({ min: 0.045, max: 0.05 });
  });

  test('drops all-null days but keeps the full timeline for window slicing', () => {
    const model = bankTrendChartModel(payload, 'BetaBank', 'Mortgage');
    expect(model!.dates).toEqual(['2026-05-01', '2026-06-01']);
    expect(model!.allDates).toEqual(payload.run_dates);
  });

  test('returns null for unknown providers', () => {
    expect(bankTrendChartModel(payload, 'NoSuchBank', 'Mortgage')).toBeNull();
  });
});

describe('rbaPassThrough', () => {
  test('scores first same-direction move after the latest scorable decision', () => {
    const model = rbaPassThrough(payload, rba, { calendar });
    expect(model!.decision).toEqual({
      date: '2026-05-10',
      bps: -25,
      outcome: 'cut',
      rate: 4.1,
      partialObservation: false,
    });
    expect(model!.rows[0]).toEqual({
      provider: 'AlphaBank',
      passedBps: -25,
      daysToFirstMove: 5,
      ratio: 1,
      passStatus: 'full',
    });
    expect(model!.rows[1]).toEqual({
      provider: 'BetaBank',
      passedBps: 0,
      daysToFirstMove: null,
      ratio: null,
      passStatus: 'none',
    });
  });

  test('includes decisions that predate the ledger when the response window overlaps', () => {
    // Live-data shape: ledger starts 2026-05-13, May 5 hike responses land on May 15.
    const ledgerPayload: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-06-01',
      run_dates: ['2026-05-13', '2026-05-15', '2026-06-01'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.0625, 0.0625],
            best: [0.055, 0.0575, 0.0575],
            count: [10, 10, 10],
          },
        },
        QuietBank: {
          Mortgage: {
            median: [0.06, 0.06, 0.06],
            best: [0.055, 0.055, 0.055],
            count: [4, 4, 4],
          },
        },
      },
      events: [
        {
          date: '2026-05-15',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'hike',
          moved: 3,
          total: 3,
          avg_bps: 25,
        },
      ],
    };
    const cal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-05', effective: '2026-05-06', rate: 4.35, delta_bps: 25, outcome: 'hike' },
        { date: '2026-06-16', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' },
      ],
      schedule: [],
    };
    // Series-only effective date sits before ledger start with no calendar → null.
    expect(rbaPassThrough(ledgerPayload, [{ date: '2026-05-06', rate: 4.35 }])).toBeNull();
    const model = rbaPassThrough(ledgerPayload, [{ date: '2026-05-06', rate: 4.35 }], { calendar: cal });
    expect(model!.decision).toMatchObject({
      date: '2026-05-05',
      bps: 25,
      outcome: 'hike',
      partialObservation: true,
    });
    expect(model!.rows[0]).toMatchObject({
      provider: 'AlphaBank',
      passedBps: 25,
      daysToFirstMove: 10,
      ratio: 1,
      passStatus: 'full',
    });
    expect(model!.rows[1]).toMatchObject({ provider: 'QuietBank', passStatus: 'none' });
  });

  test('lists multiple past decisions and scores a selected date', () => {
    const multi: BankInsightsPayload = {
      ...payload,
      run_date: '2026-07-01',
      run_dates: ['2026-05-01', '2026-05-15', '2026-06-01', '2026-07-01'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.0595, 0.057, 0.0545],
            best: [0.055, 0.0545, 0.052, 0.0495],
            count: [10, 10, 10, 10],
          },
        },
      },
      events: [
        ...payload.events.filter((e) => e.provider === 'AlphaBank'),
        {
          date: '2026-06-20',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'cut',
          moved: 5,
          total: 10,
          avg_bps: -25,
        },
      ],
    };
    const cal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-10', effective: '2026-05-11', rate: 4.1, delta_bps: -25, outcome: 'cut' },
        { date: '2026-06-16', effective: '2026-06-17', rate: 3.85, delta_bps: -25, outcome: 'cut' },
      ],
      schedule: [],
    };
    const list = rbaPassThroughDecisionList(multi, rba, { calendar: cal });
    expect(list.map((d) => d.date)).toEqual(['2026-06-16', '2026-05-10']);
    const june = rbaPassThrough(multi, rba, { calendar: cal, decisionDate: '2026-06-16' });
    expect(june!.rows[0]).toMatchObject({
      provider: 'AlphaBank',
      passedBps: -25,
      daysToFirstMove: 4,
      passStatus: 'full',
    });
  });

  test('returns null when no decision response window overlaps the ledger', () => {
    expect(rbaPassThrough(payload, [{ date: '2026-04-01', rate: 4.35 }])).toBeNull();
    expect(
      rbaPassThrough(payload, [
        { date: '2026-01-01', rate: 4.35 },
        { date: '2026-02-01', rate: 4.1 },
      ]),
    ).toBeNull();
  });

  test('attributes a move to only one decision when windows would overlap', () => {
    const cal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-05', effective: '2026-05-06', rate: 4.35, delta_bps: 25, outcome: 'hike' },
        { date: '2026-05-20', effective: '2026-05-21', rate: 4.6, delta_bps: 25, outcome: 'hike' },
      ],
      schedule: [],
    };
    const eventsPayload: BankInsightsPayload = {
      ...payload,
      events: [
        {
          date: '2026-05-22',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'hike',
          moved: 2,
          total: 2,
          avg_bps: 25,
        },
      ],
    };
    const first = rbaPassThrough(eventsPayload, rba, { calendar: cal, decisionDate: '2026-05-05' });
    const second = rbaPassThrough(eventsPayload, rba, { calendar: cal, decisionDate: '2026-05-20' });
    // Cap at day before next decision: May 5 window ends May 19, so May 22 is not counted there.
    expect(first!.rows.find((r) => r.provider === 'AlphaBank')?.daysToFirstMove).toBeNull();
    expect(second!.rows.find((r) => r.provider === 'AlphaBank')).toMatchObject({
      daysToFirstMove: 2,
      passStatus: 'full',
    });
  });

  test('classifies over, partial, and none pass statuses with ratios', () => {
    const statusPayload: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-06-01',
      run_dates: ['2026-05-01', '2026-05-15', '2026-06-01'],
      banks: {
        OverBank: {
          Mortgage: {
            median: [0.06, 0.0635, 0.0635],
            best: [0.055, 0.0585, 0.0585],
            count: [8, 8, 8],
          },
        },
        PartialBank: {
          Mortgage: {
            median: [0.06, 0.0612, 0.0612],
            best: [0.055, 0.0562, 0.0562],
            count: [8, 8, 8],
          },
        },
        QuietBank: {
          Mortgage: {
            median: [0.06, 0.06, 0.06],
            best: [0.055, 0.055, 0.055],
            count: [4, 4, 4],
          },
        },
      },
      events: [
        {
          date: '2026-05-15',
          provider: 'OverBank',
          section: 'Mortgage',
          dir: 'hike',
          moved: 4,
          total: 4,
          avg_bps: 35,
        },
        {
          date: '2026-05-16',
          provider: 'PartialBank',
          section: 'Mortgage',
          dir: 'hike',
          moved: 2,
          total: 4,
          avg_bps: 12,
        },
      ],
    };
    const cal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-05', effective: '2026-05-06', rate: 4.35, delta_bps: 25, outcome: 'hike' },
      ],
      schedule: [],
    };
    const model = rbaPassThrough(statusPayload, [{ date: '2026-05-06', rate: 4.35 }], {
      calendar: cal,
    });
    expect(model!.windowDays).toBe(60);
    expect(model!.rows.find((r) => r.provider === 'OverBank')).toMatchObject({
      passedBps: 35,
      ratio: 1.4,
      passStatus: 'over',
    });
    expect(model!.rows.find((r) => r.provider === 'PartialBank')).toMatchObject({
      passedBps: 12,
      ratio: 0.48,
      passStatus: 'partial',
    });
    expect(model!.rows.find((r) => r.provider === 'QuietBank')).toMatchObject({
      passedBps: 0,
      ratio: null,
      passStatus: 'none',
    });
  });
});

describe('marketPulse', () => {
  test('counts distinct movers, cuts, and hikes in the window', () => {
    const pulse = marketPulse(payload, 7);
    expect(pulse).toMatchObject({ banksMoved: 2, cuts: 1, hikes: 1 });
  });

  test('handles a quiet window', () => {
    const pulse = marketPulse({ ...payload, events: [] }, 7);
    expect(pulse).toMatchObject({ banksMoved: 0, cuts: 0, hikes: 0 });
  });
});
