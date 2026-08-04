import { bankSnapshotAt, eventsOnDate, type BankInsightsPayload } from '../src/data/bankInsights';

const payload: BankInsightsPayload = {
  schema_version: 1,
  run_date: '2026-06-03',
  run_dates: ['2026-06-01', '2026-06-02', '2026-06-03'],
  banks: {
    'Alpha Bank': {
      Mortgage: {
        best: [0.0599, 0.0574, 0.0574],
        median: [0.062, 0.06, 0.06],
        count: [10, 10, 10],
      },
    },
    'Beta Bank': {
      Mortgage: {
        best: [0.061, null, 0.061],
        median: [0.063, null, 0.063],
        count: [5, null, 5],
      },
    },
    'Gamma Bank': {
      Savings: {
        best: [0.05, 0.051, null],
        median: [0.045, 0.046, null],
        count: [3, 3, null],
      },
    },
  },
  events: [
    { date: '2026-06-02', provider: 'Alpha Bank', section: 'Mortgage', dir: 'cut', moved: 4, total: 10, avg_bps: -25 },
    { date: '2026-06-02', provider: 'Gamma Bank', section: 'Savings', dir: 'hike', moved: 1, total: 3, avg_bps: 10 },
  ],
};

describe('bankSnapshotAt', () => {
  it('returns lender rates as of the scrubbed date with their latest move', () => {
    const rows = bankSnapshotAt(payload, 'Mortgage', '2026-06-03', true);
    expect(rows.map((r) => r.provider)).toEqual(['Alpha Bank', 'Beta Bank']);
    expect(rows[0]).toMatchObject({
      best: 0.0574,
      changeBps: -25,
      changedOn: '2026-06-02',
    });
    expect(rows[1]).toMatchObject({ best: 0.061, changeBps: null, changedOn: null });
  });

  it('rewinds to earlier dates without later data leaking in', () => {
    const rows = bankSnapshotAt(payload, 'Mortgage', '2026-06-01', true);
    expect(rows[0]).toMatchObject({ provider: 'Alpha Bank', best: 0.0599, changeBps: null });
  });

  it('carries deposit values forward and sorts higher-is-better first', () => {
    const rows = bankSnapshotAt(payload, 'Savings', '2026-06-03', false);
    expect(rows[0]).toMatchObject({
      provider: 'Gamma Bank',
      best: 0.051,
      changeBps: 10,
      changedOn: '2026-06-02',
    });
  });

  it('returns nothing before the first run date or without a payload', () => {
    expect(bankSnapshotAt(payload, 'Mortgage', '2026-05-31', true)).toEqual([]);
    expect(bankSnapshotAt(null, 'Mortgage', '2026-06-03', true)).toEqual([]);
  });
});

describe('eventsOnDate', () => {
  it('returns only selected-section movers, largest magnitude first', () => {
    expect(eventsOnDate(payload, 'Mortgage', '2026-06-02').map((event) => event.provider)).toEqual(['Alpha Bank']);
    expect(eventsOnDate(payload, 'Savings', '2026-06-02').map((event) => event.provider)).toEqual(['Gamma Bank']);
    expect(eventsOnDate(payload, 'Savings', '2026-06-03')).toEqual([]);
  });
});
