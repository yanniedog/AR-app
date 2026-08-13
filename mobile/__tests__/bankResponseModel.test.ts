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
    expect(cut?.rows[0]).toMatchObject({ movePp: -0.15, daysAfter: 0 });
    expect(windows.some((window) => window.decision.date === '2026-03-01')).toBe(false);
  });

  it('labels the cash target explicitly for holds and moves', () => {
    expect(bankResponseDecisionLabel(calendar.decisions[2])).toBe('RBA held at 4.35%');
    expect(bankResponseDecisionLabel(calendar.decisions[3])).toContain('to 4.10%');
  });
});
