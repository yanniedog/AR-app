import { isBigFourProvider, orderProviders, savedProviders } from '../src/data/bankGroups';
import { bankRateSnapshotsInRange } from '../src/data/bankRateChartView';
import { bankResponseStatus, type CompactBankResponseRow } from '../src/data/bankResponseModel';
import { marketPulse } from '../src/data/bankInsightsQuery';

test('big four matches the major brands only', () => {
  expect(['CommBank', 'Westpac', 'NATIONAL AUSTRALIA BANK', 'ANZ'].every(isBigFourProvider)).toBe(true);
  expect(['ANZ Plus', 'St.George Bank', 'ING BANK (Australia) Ltd'].some(isBigFourProvider)).toBe(false);
});

test('saved providers come first, then A–Z, narrowed by the query', () => {
  const names = ['Gamma', 'alpha', 'Beta'];
  expect(orderProviders(names, n => n, new Set(['Gamma']))).toEqual(['Gamma', 'alpha', 'Beta']);
  expect(orderProviders(names, n => n, new Set(), 'ET')).toEqual(['Beta']);
});

test('saved providers resolve through current product keys', () => {
  const core = { sections: {
    Mortgage: { rates: [{ provider: 'Alpha', product_key: 'a1' }, { provider: 'Beta', product_key: 'b1' }] },
    Savings: { rates: [] }, TD: { rates: [] },
  } } as any;
  expect([...savedProviders(core, [{ productKey: 'b1' } as any])]).toEqual(['Beta']);
  expect(savedProviders(null, undefined).size).toBe(0);
});

test('the 1Y range keeps the trailing year ending at the newest snapshot', () => {
  const snapshots = { '2025-01-01': 1, '2025-06-01': 2, '2026-06-01': 3 };
  expect(Object.keys(bankRateSnapshotsInRange(snapshots, '1Y'))).toEqual(['2025-06-01', '2026-06-01']);
  expect(bankRateSnapshotsInRange(snapshots, 'All')).toBe(snapshots);
});

test('pass-through status compares the first move with the RBA change', () => {
  const row = (movePp: number | null, reason = 'recorded-move'): CompactBankResponseRow => ({
    provider: 'A', movePp, daysAfter: 1, direction: null,
    evidence: { reason, observedDays: 1, missingDays: 0, baselineAvailable: true, firstMoveVerified: true } as any,
  });
  expect(bankResponseStatus(row(-0.25), -25)).toBe('full');
  expect(bankResponseStatus(row(-0.3), -25)).toBe('full');
  expect(bankResponseStatus(row(-0.1), -25)).toBe('partial');
  expect(bankResponseStatus(row(0.1), -25)).toBe('opposite');
  expect(bankResponseStatus(row(null, 'no-recorded-move'), -25)).toBe('none');
  expect(bankResponseStatus(row(null, 'history-gap'), -25)).toBeNull();
  expect(bankResponseStatus(row(-0.25), 0)).toBeNull();
  expect(bankResponseStatus(row(0), -25)).toBe('none');
});

test('market pulse counts banks by direction so the totals agree', () => {
  const event = (provider: string, dir: 'hike' | 'cut' | 'mixed') => ({ provider, dir, date: '2026-08-19', section: 'Mortgage' });
  const pulse = marketPulse({ run_dates: ['2026-08-20'], events: [
    event('A', 'hike'), event('A', 'hike'), event('B', 'cut'), event('C', 'hike'), event('C', 'cut'), event('D', 'mixed'),
  ] } as any)!;
  expect(pulse).toMatchObject({ banksMoved: 4, banksUp: 1, banksDown: 1, banksMixed: 2, hikes: 3, cuts: 2, mixed: 1 });
});
