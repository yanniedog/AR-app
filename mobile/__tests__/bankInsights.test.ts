import {
  bankEventMedianContext,
  bankTrendChartModel,
  comparePassThroughRows,
  filterBankInsightsForSuitability,
  marketPulse,
  normalizeBankInsightsPayload,
  passThroughDaysLabel,
  rbaPassThrough,
  rbaPassThroughDecisionList,
  rbaPassThroughMultiSection,
  recentBankEvents,
  topMovers,
  type BankInsightsPayload,
  type PassThroughRow,
} from '../src/data/bankInsights';
import type { RbaCalendar } from '../src/data/rbaCalendar';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import { lenderRaceModel, marketActivityModel } from '../src/data/vizModels';
import type { CorePayload, RbaEntry } from '../src/types';

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

function emptySection() {
  return {
    rates: [],
    ribbon: {
      counts: { rates: 0, products: 0, providers: 0 },
      range: { min: null, max: null, mean: null, median: null },
      providers: [],
    },
  };
}

describe('filterBankInsightsForSuitability', () => {
  afterEach(() => setSuitabilityAllowed(null));

  const filterCore: CorePayload = {
    schema_version: 1,
    run_date: payload.run_date,
    brands: {},
    rba: [],
    sections: {
      Mortgage: {
        ...emptySection(),
        rates: [
          {
            provider: 'AlphaBank',
            product_key: 'alpha-standard',
            product_name: 'Alpha Variable',
            rate: '0.057',
            account_class: 'standard',
          },
          {
            provider: 'BetaBank',
            product_key: 'beta-standard',
            product_name: 'Beta Variable',
            rate: '0.062',
            account_class: 'standard',
          },
          {
            provider: 'BetaBank',
            product_key: 'beta-non-standard',
            product_name: 'Beta Specialist',
            rate: '0.05',
            account_class: 'non_standard',
          },
        ],
      },
      Savings: {
        ...emptySection(),
        rates: [
          {
            provider: 'GammaBank',
            product_key: 'gamma-standard',
            product_name: 'Gamma Saver',
            rate: '0.052',
            account_class: 'standard',
          },
        ],
      },
      TD: emptySection(),
    },
  };

  const behaviourSummary = {
    hike: {
      n: 1,
      days_median: 2,
      bps_median: 10,
      ratio_median: 0.4,
      confidence: 'insufficient' as const,
    },
    cut: {
      n: 0,
      days_median: null,
      bps_median: null,
      ratio_median: null,
      confidence: 'insufficient' as const,
    },
  };

  test('rebuilds a current snapshot instead of dropping a mixed provider', () => {
    const withAmbiguousBeta: BankInsightsPayload = {
      ...payload,
      events: [
        ...payload.events,
        {
          date: '2026-06-01',
          provider: 'BetaBank',
          section: 'Mortgage',
          dir: 'cut',
          moved: 1,
          total: 2,
          avg_bps: -5,
        },
      ],
      behaviour: {
        Mortgage: {
          section: 'Mortgage',
          window_days: 60,
          providers: {
            AlphaBank: behaviourSummary,
            BetaBank: behaviourSummary,
          },
        },
      },
    };

    const filtered = filterBankInsightsForSuitability(
      withAmbiguousBeta,
      filterCore,
      false,
    );

    expect(Object.keys(filtered!.banks)).toEqual(['AlphaBank', 'BetaBank', 'GammaBank']);
    expect(filtered!.banks.BetaBank.Mortgage).toEqual({
      median: [null, null, 0.062],
      best: [null, null, 0.062],
      count: [null, null, 1],
    });
    expect(filtered!.events.some((event) => event.provider === 'BetaBank')).toBe(false);
    expect(filtered!.behaviour?.Mortgage?.providers).toEqual({
      AlphaBank: behaviourSummary,
    });
    expect(lenderRaceModel(filtered, 'Mortgage', true, 'All')).not.toBeNull();
    expect(marketActivityModel(filtered, 'Mortgage', 'All')).not.toBeNull();
  });

  test('returns the complete feed when non-standard products are enabled', () => {
    expect(filterBankInsightsForSuitability(payload, filterCore, true)).toBe(payload);
  });

  test('reuses the filtered feed for identical mounted-screen inputs', () => {
    const first = filterBankInsightsForSuitability(payload, filterCore, false);
    const second = filterBankInsightsForSuitability(payload, filterCore, false);
    expect(second).toBe(first);

    setSuitabilityAllowed(new Set(['alpha-standard']));
    const afterRevision = filterBankInsightsForSuitability(payload, filterCore, false);
    expect(afterRevision).not.toBe(first);
  });

  test('fails closed while the post-ingest suitability gate is warming', () => {
    setSuitabilityAllowed(new Set());

    const filtered = filterBankInsightsForSuitability(payload, filterCore, false);

    expect(filtered).toBeNull();
  });
});

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

describe('bankEventMedianContext', () => {
  test('returns before→after median rates for a move date', () => {
    expect(
      bankEventMedianContext(payload, {
        provider: 'AlphaBank',
        section: 'Mortgage',
        date: '2026-06-01',
      }),
    ).toEqual({
      before: 0.0595,
      after: 0.057,
      medianBps: -25,
    });
  });

  test('returns null when prior median is missing', () => {
    expect(
      bankEventMedianContext(payload, {
        provider: 'BetaBank',
        section: 'Mortgage',
        date: '2026-05-01',
      }),
    ).toBeNull();
  });
});

describe('topMovers', () => {
  test('computes net median change over the window, cuts first', () => {
    const movers = topMovers(payload, 'Mortgage', 30);
    expect(movers[0]).toEqual({
      provider: 'AlphaBank',
      netBps: -25,
      current: 0.057,
      movedOn: '2026-06-01',
    });
    expect(movers[1]).toEqual({
      provider: 'BetaBank',
      netBps: 0,
      current: 0.062,
      movedOn: null,
    });
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
    expect(model!.windowEnd).toBe('2026-07-09');
    expect(model!.observedThrough).toBe('2026-06-01');
    expect(model!.windowOpen).toBe(true);
    // Size comes from the provider median, not a sum of event averages.
    expect(model!.rows[0]).toEqual({
      provider: 'AlphaBank',
      passedBps: -30,
      netChangeBps: -30,
      daysToFirstMove: 5,
      ratio: 1.2,
      baselineComplete: true,
      passStatus: 'over',
    });
    expect(model!.rows[1]).toEqual({
      provider: 'BetaBank',
      passedBps: 0,
      netChangeBps: 0,
      daysToFirstMove: null,
      ratio: null,
      baselineComplete: true,
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
      ratio: null,
      baselineComplete: false,
      passStatus: 'unscored',
    });
    expect(model!.rows[1]).toMatchObject({ provider: 'QuietBank', passStatus: 'unscored' });
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
      // The event moved with the RBA, but the provider median finished the
      // window unchanged. Timing is suppressed so those facts cannot conflict.
      daysToFirstMove: null,
      passedBps: 0,
      passStatus: 'none',
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

  test('signs calendar cut deltas from outcome even when magnitude is positive', () => {
    const cal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-10', effective: '2026-05-11', rate: 4.1, delta_bps: 25, outcome: 'cut' },
      ],
      schedule: [],
    };
    const model = rbaPassThrough(payload, rba, { calendar: cal });
    expect(model!.decision).toMatchObject({
      date: '2026-05-10',
      bps: -25,
      outcome: 'cut',
    });
    expect(model!.rows[0]).toMatchObject({
      provider: 'AlphaBank',
      passedBps: -30,
      passStatus: 'over',
    });
  });

  test('falls back to core RBA series when calendar decisions miss the ledger', () => {
    const staleCal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        // Far outside the May–June test ledger / response window.
        { date: '2025-01-01', effective: '2025-01-02', rate: 4.35, delta_bps: 25, outcome: 'hike' },
      ],
      schedule: [],
    };
    const series: RbaEntry[] = [
      { date: '2026-05-01', rate: 4.35 },
      { date: '2026-05-11', rate: 4.1 },
    ];
    expect(rbaPassThrough(payload, series, { calendar: staleCal })).toMatchObject({
      decision: { date: '2026-05-11', bps: -25, outcome: 'cut' },
    });
  });

  test('merges a newer core RBA decision when the calendar is stale but still overlaps', () => {
    const staleButOverlapping: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-10', effective: '2026-05-11', rate: 4.1, delta_bps: -25, outcome: 'cut' },
      ],
      schedule: [],
    };
    const series: RbaEntry[] = [
      { date: '2026-05-01', rate: 4.35 },
      { date: '2026-05-10', rate: 4.1 },
      { date: '2026-06-01', rate: 3.85 },
    ];
    const dates = rbaPassThroughDecisionList(payload, series, { calendar: staleButOverlapping }).map(
      (d) => d.date,
    );
    expect(dates).toEqual(expect.arrayContaining(['2026-05-10', '2026-06-01']));
    expect(rbaPassThrough(payload, series, { calendar: staleButOverlapping })!.decision.date).toBe(
      '2026-06-01',
    );
  });

  test('does not treat a core.rba effective-date twin as a second decision', () => {
    // Live shape: calendar keys announcement day; core.rba steps on effective day.
    const ledgerPayload: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-07-15',
      run_dates: ['2026-05-13', '2026-05-15', '2026-07-15'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.0625, 0.0625],
            best: [0.055, 0.0575, 0.0575],
            count: [10, 10, 10],
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
      ],
      schedule: [],
    };
    const series: RbaEntry[] = [
      { date: '2026-03-18', rate: 4.1 },
      { date: '2026-05-06', rate: 4.35 },
    ];
    const dates = rbaPassThroughDecisionList(ledgerPayload, series, { calendar: cal }).map(
      (d) => d.date,
    );
    expect(dates).toEqual(['2026-05-05']);
    expect(rbaPassThrough(ledgerPayload, series, { calendar: cal })!.decision.date).toBe(
      '2026-05-05',
    );
  });

  test('caps an earlier calendar window using a later merged series-only decision', () => {
    const cal: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-05-05', effective: '2026-05-06', rate: 4.35, delta_bps: 25, outcome: 'hike' },
      ],
      schedule: [],
    };
    const series: RbaEntry[] = [
      { date: '2026-03-18', rate: 4.1 },
      { date: '2026-05-06', rate: 4.35 },
      { date: '2026-06-01', rate: 4.1 },
    ];
    const eventsPayload: BankInsightsPayload = {
      ...payload,
      run_date: '2026-07-01',
      run_dates: ['2026-05-13', '2026-05-20', '2026-06-05', '2026-07-01'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.0625, 0.06, 0.06],
            best: [0.055, 0.0575, 0.055, 0.055],
            count: [10, 10, 10, 10],
          },
        },
      },
      events: [
        {
          date: '2026-05-20',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'hike',
          moved: 3,
          total: 3,
          avg_bps: 25,
        },
        {
          date: '2026-06-05',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'cut',
          moved: 3,
          total: 3,
          avg_bps: -25,
        },
      ],
    };
    const list = rbaPassThroughDecisionList(eventsPayload, series, { calendar: cal }).map(
      (d) => d.date,
    );
    expect(list).toEqual(['2026-06-01', '2026-05-05']);
    const may = rbaPassThrough(eventsPayload, series, {
      calendar: cal,
      decisionDate: '2026-05-05',
    });
    // Window ends day before the merged June 1 series cut — May 20 hike still counts.
    expect(may!.rows.find((r) => r.provider === 'AlphaBank')).toMatchObject({
      daysToFirstMove: 15,
      passStatus: 'unscored',
    });
  });

  test('skips lenders with no observable rate at or before the decision', () => {
    const lateJoin: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-06-01',
      run_dates: ['2026-05-01', '2026-05-15', '2026-06-01'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.057, 0.057],
            best: [0.055, 0.052, 0.052],
            count: [10, 10, 10],
          },
        },
        NewBank: {
          Mortgage: {
            median: [null, null, 0.06],
            best: [null, null, 0.055],
            count: [null, null, 2],
          },
        },
      },
      events: [
        {
          date: '2026-05-15',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'cut',
          moved: 4,
          total: 10,
          avg_bps: -25,
        },
      ],
    };
    const model = rbaPassThrough(lateJoin, rba, { calendar });
    expect(model!.rows.map((r) => r.provider)).toEqual(['AlphaBank']);
  });

  test('uses mixed events for timing while median movement determines pass size', () => {
    const mixedPayload: BankInsightsPayload = {
      ...payload,
      events: [
        {
          date: '2026-05-15',
          provider: 'AlphaBank',
          section: 'Mortgage',
          dir: 'mixed',
          moved: 4,
          total: 10,
          avg_bps: -25,
        },
      ],
    };
    const model = rbaPassThrough(mixedPayload, rba, { calendar });
    expect(model!.rows[0]).toMatchObject({
      provider: 'AlphaBank',
      passedBps: -30,
      passStatus: 'over',
    });
  });

  test('uses net provider-median movement for size while timing uses the first event', () => {
    const splitPayload: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-07-01',
      run_dates: ['2026-05-01', '2026-05-15', '2026-05-22', '2026-07-01'],
      banks: {
        SplitBank: {
          Mortgage: {
            median: [0.06, 0.059, 0.0575, 0.0575],
            best: [0.055, 0.054, 0.0525, 0.0525],
            count: [8, 8, 8, 8],
          },
        },
        SlowFull: {
          Mortgage: {
            median: [0.06, 0.06, 0.0575, 0.0575],
            best: [0.055, 0.055, 0.0525, 0.0525],
            count: [8, 8, 8, 8],
          },
        },
      },
      events: [
        {
          date: '2026-05-15',
          provider: 'SplitBank',
          section: 'Mortgage',
          dir: 'cut',
          moved: 2,
          total: 8,
          avg_bps: -10,
        },
        {
          date: '2026-05-22',
          provider: 'SplitBank',
          section: 'Mortgage',
          dir: 'cut',
          moved: 3,
          total: 8,
          avg_bps: -15,
        },
        {
          date: '2026-05-22',
          provider: 'SlowFull',
          section: 'Mortgage',
          dir: 'cut',
          moved: 4,
          total: 8,
          avg_bps: -25,
        },
      ],
    };
    const model = rbaPassThrough(splitPayload, rba, { calendar });
    expect(model!.rows.find((r) => r.provider === 'SplitBank')).toMatchObject({
      passedBps: -25,
      daysToFirstMove: 5,
      passStatus: 'full',
    });
    // Full+faster ranks above full+slower.
    expect(model!.rows.map((r) => r.provider)).toEqual(['SplitBank', 'SlowFull']);
  });

  test('derives series decisions after sorting shuffled core.rba dates', () => {
    const shuffled: RbaEntry[] = [
      { date: '2026-05-11', rate: 4.1 },
      { date: '2026-05-01', rate: 4.35 },
    ];
    const model = rbaPassThrough(payload, shuffled);
    expect(model!.decision).toMatchObject({ date: '2026-05-11', bps: -25, outcome: 'cut' });
  });

  test('marks the response window closed once observedThrough passes windowEnd', () => {
    const closedLedger: BankInsightsPayload = {
      ...payload,
      run_date: '2026-08-01',
      run_dates: ['2026-05-01', '2026-05-15', '2026-08-01'],
      banks: {
        AlphaBank: {
          Mortgage: {
            median: [0.06, 0.057, 0.057],
            best: [0.055, 0.052, 0.052],
            count: [10, 10, 10],
          },
        },
      },
    };
    const model = rbaPassThrough(closedLedger, rba, { calendar });
    expect(model!.windowEnd).toBe('2026-07-09');
    expect(model!.observedThrough).toBe('2026-08-01');
    expect(model!.windowOpen).toBe(false);
  });

  test('passThroughDaysLabel encodes partial and open-window trust cues', () => {
    expect(passThroughDaysLabel(5, { partialObservation: false, windowOpen: false })).toBe(
      'moved after 5 days',
    );
    expect(passThroughDaysLabel(1, { partialObservation: true, windowOpen: false })).toBe(
      'moved after ≤1 day',
    );
    expect(passThroughDaysLabel(null, { partialObservation: false, windowOpen: true })).toBe(
      'no matching move yet — window still open',
    );
    expect(passThroughDaysLabel(null, { partialObservation: false, windowOpen: false })).toBe(
      'no matching move in the tracking window',
    );
  });

  test('comparePassThroughRows prefers full/fast over partial/holdout', () => {
    const rows: PassThroughRow[] = [
      { provider: 'Hold', passedBps: 0, daysToFirstMove: null, ratio: null, passStatus: 'none' },
      { provider: 'Partial', passedBps: 10, daysToFirstMove: 3, ratio: 0.4, passStatus: 'partial' },
      { provider: 'SlowFull', passedBps: 25, daysToFirstMove: 20, ratio: 1, passStatus: 'full' },
      { provider: 'FastFull', passedBps: 25, daysToFirstMove: 4, ratio: 1, passStatus: 'full' },
    ];
    expect([...rows].sort(comparePassThroughRows).map((r) => r.provider)).toEqual([
      'FastFull',
      'SlowFull',
      'Partial',
      'Hold',
    ]);
  });

  test('rbaPassThroughMultiSection unions providers across Mortgage, Savings, and TD', () => {
    const multiPayload: BankInsightsPayload = {
      ...payload,
      events: [
        ...payload.events.filter((e) => !(e.provider === 'GammaBank' && e.section === 'Savings')),
        {
          date: '2026-05-15',
          provider: 'GammaBank',
          section: 'Savings',
          dir: 'cut',
          moved: 1,
          total: 3,
          avg_bps: -10,
        },
      ],
    };
    const model = rbaPassThroughMultiSection(multiPayload, rba, { calendar });
    expect(model).not.toBeNull();
    expect(model!.rows.map((r) => r.provider)).toEqual(['AlphaBank', 'BetaBank', 'GammaBank']);
    expect(model!.rows[0].sections.Mortgage).toMatchObject({
      provider: 'AlphaBank',
      passedBps: -30,
      passStatus: 'over',
    });
    expect(model!.rows[1].sections.Mortgage).toMatchObject({
      provider: 'BetaBank',
      passStatus: 'none',
    });
    expect(model!.rows[1].sections.Savings).toBeUndefined();
    expect(model!.rows[2].sections.Savings).toMatchObject({
      provider: 'GammaBank',
      passedBps: 0,
      netChangeBps: 20,
      passStatus: 'none',
    });
    expect(model!.rows[2].sections.Mortgage).toBeUndefined();
  });

  test('rbaPassThroughMultiSection shares decision picker with single-section scoring', () => {
    const list = rbaPassThroughDecisionList(payload, rba, { calendar });
    const model = rbaPassThroughMultiSection(payload, rba, {
      calendar,
      decisionDate: list[0]?.date,
    });
    expect(model!.decision.date).toBe(list[0]?.date);
    expect(rbaPassThrough(payload, rba, { calendar, decisionDate: list[0]?.date })!.decision.date).toBe(
      list[0]?.date,
    );
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
