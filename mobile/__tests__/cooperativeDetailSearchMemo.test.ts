import {
  DETAIL_SEARCH_MEMO_LIMIT, detailSearchMemoSize, prepareRowSearchQuery,
  prepareRowSearchQueryCooperatively, resetDetailSearchIndexCache, type SearchIndexPayload,
} from '../src/data/detailSearch';

const row = (key: string) => ({ product_key: key, provider: 'Bank', product_name: 'Account' });
const control = { yieldControl: async () => {}, now: () => 0 };

function observedIndex(values: Record<string, string>) {
  const reads = jest.fn();
  const products: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(products, key, { enumerable: true, get: () => { reads(key); return value; } });
  }
  const index: SearchIndexPayload = { schema_version: 1, run_date: '2026-10-15', products };
  return { index, reads };
}

afterEach(resetDetailSearchIndexCache);

test('preview and cooperative filtering share complete query hits without rescanning unchanged blobs', async () => {
  const { index, reads } = observedIndex({ a: 'amp saver', b: 'another bank', c: 'amp deposit' });
  expect(prepareRowSearchQuery(' AMP ', index)(row('a'))).toBe(true);
  expect(reads).toHaveBeenCalledTimes(3); reads.mockClear();
  const cached = await prepareRowSearchQueryCooperatively('amp', index, control);
  expect(cached?.(row('a'))).toBe(true); expect(cached?.(row('b'))).toBe(false);
  expect(reads).not.toHaveBeenCalled();
  resetDetailSearchIndexCache();
  const cold = await prepareRowSearchQueryCooperatively('amp', index, control);
  expect(cold?.(row('c'))).toBe(true); expect(reads).toHaveBeenCalledTimes(3); reads.mockClear();
  expect(prepareRowSearchQuery('amp', index)(row('c'))).toBe(true);
  expect((await prepareRowSearchQueryCooperatively('amp', index, control))?.(row('c'))).toBe(true);
  expect(reads).not.toHaveBeenCalled();
});

test('extended cooperative queries inspect only previously matching keys', async () => {
  const { index, reads } = observedIndex({ a: 'amp saver', b: 'another bank', c: 'amp deposit' });
  await prepareRowSearchQueryCooperatively('amp', index, control); reads.mockClear();
  const matches = await prepareRowSearchQueryCooperatively('amp sav', index, control);
  expect(matches?.(row('a'))).toBe(true); expect(matches?.(row('c'))).toBe(false);
  expect(reads.mock.calls).toEqual([['a'], ['c']]);
});

test('corrected same-date index identity replaces cooperative hits, including removed matches', async () => {
  const first = observedIndex({ a: 'amp saver', b: 'another bank' });
  await prepareRowSearchQueryCooperatively('amp', first.index, control);
  const corrected = observedIndex({ a: 'another bank', b: 'amp saver' });
  const matches = await prepareRowSearchQueryCooperatively('amp', corrected.index, control);
  expect(corrected.reads).toHaveBeenCalledTimes(2);
  expect(matches?.(row('a'))).toBe(false); expect(matches?.(row('b'))).toBe(true);
});

test('cancelled partial scans never enter the query cache', async () => {
  const { index, reads } = observedIndex(Object.fromEntries(Array.from({ length: 96 }, (_, i) => [`p${i}`, 'amp saver'])));
  let cancelled = false, clock = 0;
  expect(await prepareRowSearchQueryCooperatively('amp', index, {
    cancelled: () => cancelled, now: () => clock += 8, yieldControl: async () => { cancelled = true; },
  })).toBeNull();
  expect(reads).toHaveBeenCalledTimes(32); expect(detailSearchMemoSize()).toBe(0);
  reads.mockClear();
  const complete = await prepareRowSearchQueryCooperatively('amp', index, control);
  expect(reads).toHaveBeenCalledTimes(96); expect(complete?.(row('p95'))).toBe(true);
});

test('an older suspended scan cannot overwrite a newer publication cache', async () => {
  const old = observedIndex(Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`p${i}`, 'amp saver'])));
  let release!: () => void, clock = 0;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const scan = prepareRowSearchQueryCooperatively('amp', old.index, {
    now: () => clock += 8, yieldControl: () => hold,
  });
  expect(old.reads).toHaveBeenCalledTimes(32);
  const corrected = observedIndex({ current: 'amp saver' });
  await prepareRowSearchQueryCooperatively('amp', corrected.index, control);
  corrected.reads.mockClear(); release(); await scan;
  const current = await prepareRowSearchQueryCooperatively('amp', corrected.index, control);
  expect(current?.(row('current'))).toBe(true); expect(current?.(row('p0'))).toBe(false);
  expect(corrected.reads).not.toHaveBeenCalled();
});

test('cooperative memo remains bounded and a basic search never reads a detail index', async () => {
  const { index } = observedIndex({ a: 'amp saver' });
  for (let i = 0; i < DETAIL_SEARCH_MEMO_LIMIT + 5; i++) await prepareRowSearchQueryCooperatively(`q-${i}`, index, control);
  expect(detailSearchMemoSize()).toBe(DETAIL_SEARCH_MEMO_LIMIT);
  const nameOnly = await prepareRowSearchQueryCooperatively('amp', null, control);
  expect(nameOnly?.({ ...row('a'), provider: 'AMP Bank' })).toBe(true);
  expect(nameOnly?.(row('a'))).toBe(false);
});
