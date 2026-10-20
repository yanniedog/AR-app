import { countItemsCooperatively } from '../src/lib/cooperativeCount';

test('unlisted counts yield before and during scanning and stop obsolete work', async () => {
  const items = Array.from({ length: 1000 }, (_, index) => ({ provider: index % 2 ? 'A' : 'B' }));
  let processed = 0, ticks = 0;
  const yields: number[] = [];
  expect(await countItemsCooperatively(items, item => { processed++; return item.provider === 'A'; }, {
    now: () => ++ticks * 7, yieldControl: async () => { yields.push(processed); },
  })).toBe(500);
  expect(yields[0]).toBe(0);
  expect(yields.some(count => count > 0 && count < items.length)).toBe(true);
  let cancelled = false;
  processed = 0;
  expect(await countItemsCooperatively(items, () => { processed++; return true; }, {
    now: () => ++ticks * 7, cancelled: () => cancelled,
    yieldControl: async () => { if (processed > 0) cancelled = true; },
  })).toBeNull();
  expect(processed).toBeLessThan(items.length);
});
