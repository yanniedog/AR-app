import type { BankInsightsPayload } from '../src/data/bankInsights';
import { bankResponseDecisionLabel, buildCompactBankResponseWindows } from '../src/data/bankResponseModel';
import type { RbaCalendar } from '../src/data/rbaCalendar';

const payload = {
  schema_version: 1,
  run_date: '2026-05-20',
  run_dates: ['2026-05-01', '2026-05-10', '2026-05-20'],
  banks: {
    Zeta: { Mortgage: { median: [0.06, 0.06, 0.059], best: [0.055, 0.055, 0.054], count: [2, 2, 2] } },
    Alpha: { Mortgage: { median: [0.061, 0.061, 0.06], best: [0.056, 0.056, 0.055], count: [3, 3, 3] } },
    Snapshot: { Mortgage: { median: [null, null, 0.07], best: [null, null, 0.065], count: [null, null, 1] } },
  },
  events: [
    { date: '2026-05-06', provider: 'Zeta', section: 'Mortgage', dir: 'hike', moved: 1, total: 2, avg_bps: 10 },
    { date: '2026-05-10', provider: 'Alpha', section: 'Mortgage', dir: 'cut', moved: 2, total: 3, avg_bps: -15 },
    { date: '2026-05-12', provider: 'Alpha', section: 'Mortgage', dir: 'cut', moved: 2, total: 3, avg_bps: -25 },
  ],
} as BankInsightsPayload;

const calendar: RbaCalendar = {
  timezone: 'Australia/Sydney', schedule: [],
  decisions: [
    { date: '2026-03-01', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' },
    { date: '2026-04-01', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' },
    { date: '2026-05-05', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' },
    { date: '2026-05-10', effective: '2026-05-11', rate: 4.1, delta_bps: -25, outcome: 'cut' },
  ],
};

describe('compact bank response windows', () => {
  it('includes holds, sorts banks A-Z and uses the first move before the next decision', () => {
    const windows = buildCompactBankResponseWindows(payload, calendar, 'Mortgage');
    const hold = windows.find((window) => window.decision.outcome === 'hold');
    const cut = windows.find((window) => window.decision.outcome === 'cut');
    expect(hold?.rows.map((row) => row.provider)).toEqual(['Alpha', 'Zeta']);
    expect(hold?.rows[1]).toMatchObject({ movePp: 0.1, daysAfter: 1 });
    expect(hold?.windowEnd).toBe('2026-05-09');
    expect(hold).toMatchObject({ partialHistory: false, observationStart: '2026-05-05' });
    expect(cut?.rows[0]).toMatchObject({ movePp: -0.15, daysAfter: 0 });
    expect(cut?.rows.map((row) => row.provider)).toContain('Snapshot');
    expect(windows.some((window) => window.decision.date === '2026-03-01')).toBe(false);
  });

  it('marks an overlapping decision window as partial and searches only observed dates', () => {
    const windows = buildCompactBankResponseWindows(payload, calendar, 'Mortgage');
    const partial = windows.find((window) => window.decision.date === '2026-04-01');
    expect(partial).toMatchObject({
      observationStart: '2026-05-01',
      partialHistory: true,
      windowEnd: '2026-05-04',
    });
    expect(partial?.rows.every((row) => row.movePp === null)).toBe(true);
  });

  it('labels the cash target explicitly for holds and moves', () => {
    expect(bankResponseDecisionLabel(calendar.decisions[2])).toBe('RBA held at 4.35%');
    expect(bankResponseDecisionLabel(calendar.decisions[3])).toContain('to 4.10%');
  });

  it('reads the event ledger once across banks and decision windows', () => {
    let ledgerReads = 0;
    const events = new Proxy(payload.events, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) ledgerReads++;
        return Reflect.get(target, property, receiver);
      },
    });
    const windows = buildCompactBankResponseWindows({ ...payload, events }, calendar, 'Mortgage');
    expect(windows).toEqual(buildCompactBankResponseWindows(payload, calendar, 'Mortgage'));
    expect(ledgerReads).toBe(payload.events.length);
  });

  it('retains first same-day evidence and section boundaries without mutating the ledger', () => {
    const first = payload.events[1];
    const events = [payload.events[2], first, { ...first, avg_bps: -50 },
      { ...payload.events[0], date: '2026-05-05', section: 'Savings' as const }, payload.events[0]];
    const original = events.slice();
    const windows = buildCompactBankResponseWindows({ ...payload, events }, calendar, 'Mortgage');
    expect(windows.find(window => window.decision.date === '2026-05-10')?.rows[0])
      .toMatchObject({ provider: 'Alpha', movePp: -0.15, daysAfter: 0 });
    expect(windows.find(window => window.decision.date === '2026-05-05')?.rows[1])
      .toMatchObject({ provider: 'Zeta', movePp: 0.1, daysAfter: 1 });
    expect(events).toEqual(original);
  });

  it('keeps absent series observations blank and admits a measured zero count', () => {
    const banks = { ...payload.banks,
      Empty: { Mortgage: { median: [null, null, null], best: [null, null, null], count: [null, null, null] } },
      Zero: { Mortgage: { median: [null, null, null], best: [null, null, null], count: [null, null, 0] } },
    };
    const windows = buildCompactBankResponseWindows({ ...payload, banks }, calendar, 'Mortgage');
    expect(windows.every(window => window.rows.every(row => row.provider !== 'Empty'))).toBe(true);
    expect(windows.find(window => window.decision.date === '2026-05-10')?.rows)
      .toContainEqual(expect.objectContaining({ provider: 'Zero', movePp: null, daysAfter: null, direction: null }));
    expect(windows.find(window => window.decision.date === '2026-05-05')?.rows.some(row => row.provider === 'Zero')).toBe(false);
  });

  it('builds large multi-year decision windows with a distinct source quickly', () => {
    const startMs = Date.parse('2023-01-01T00:00:00Z');
    const dayCount = 900;
    const runDates = Array.from({ length: dayCount }, (_, i) =>
      new Date(startMs + i * 86_400_000).toISOString().slice(0, 10));
    const zeros = Array.from({ length: dayCount }, () => 0.06);
    const counts = Array.from({ length: dayCount }, () => 3);
    const banks: BankInsightsPayload['banks'] = {};
    for (let b = 0; b < 80; b++) {
      banks[`Bank ${String(b).padStart(2, '0')}`] = {
        Mortgage: { median: zeros, best: zeros, count: counts },
      };
    }
    const events: BankInsightsPayload['events'] = Array.from({ length: 24 }, (_, d) => ({
      date: runDates[d * 35 + 3],
      provider: `Bank ${String(d % 80).padStart(2, '0')}`,
      section: 'Mortgage' as const,
      dir: 'hike' as const,
      moved: 1,
      total: 3,
      avg_bps: 25,
    }));
    const largeSource = {
      schema_version: 1,
      run_date: runDates[dayCount - 1],
      run_dates: runDates,
      banks,
      events,
      eventLedgerComplete: true,
    } as BankInsightsPayload;
    const largeFiltered = {
      ...largeSource,
      events: events.slice(0, 20),
    } as BankInsightsPayload;
    const largeCalendar: RbaCalendar = {
      timezone: 'Australia/Sydney',
      schedule: [],
      decisions: Array.from({ length: 24 }, (_, d) => ({
        date: runDates[d * 35 + 1],
        effective: null,
        rate: 4.35,
        delta_bps: 25,
        outcome: 'hike' as const,
      })),
    };
    const t0 = performance.now();
    const activeOnly = buildCompactBankResponseWindows(largeFiltered, largeCalendar, 'Mortgage', largeSource, { activeIndex: 0 });
    const activeElapsedMs = performance.now() - t0;
    expect(activeOnly).toHaveLength(24);
    expect(activeOnly[0].rows).toHaveLength(80);
    expect(activeOnly[1].rows).toHaveLength(0);
    expect(activeElapsedMs).toBeLessThan(100);

    const t1 = performance.now();
    const windows = buildCompactBankResponseWindows(largeFiltered, largeCalendar, 'Mortgage', largeSource);
    const fullElapsedMs = performance.now() - t1;
    expect(windows).toHaveLength(24);
    expect(windows[0].rows).toHaveLength(80);
    expect(windows[0]).toEqual(activeOnly[0]);
    expect(fullElapsedMs).toBeLessThan(1000);
  });
});
