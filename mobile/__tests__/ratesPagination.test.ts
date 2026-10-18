import { ratesPageWindow, ratesPageIndex, normalizeRatesPageSize } from '../src/data/ratesPagination';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, updateRatesSection, syncRatesPreferences, useRatesSession } from '../src/data/ratesSession';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { EMPTY_FILTERS } from '../src/data/selectors';

test.each([10, 20] as const)('%i-row pages cover empty, single, exact-multiple and partial datasets once without gaps', size => {
  for (const total of [0, 1, size, size * 2, size * 2 + 3, 6000]) {
    const all = Array.from({ length: total }, (_, id) => id), seen: number[] = [];
    const first = ratesPageWindow(total, 1, size);
    expect(first.from).toBe(total ? 1 : 0); expect(first.previous).toBe(false);
    for (let page = 1; page <= first.pages; page++) {
      const window = ratesPageWindow(total, page, size), slice = all.slice(window.offset, window.to);
      expect(slice.length).toBeGreaterThan(0); expect(slice.length).toBeLessThanOrEqual(size); seen.push(...slice);
      expect(window.next).toBe(page < first.pages);
    }
    expect(seen).toEqual(all);
    expect(ratesPageWindow(total, 99999, size).to).toBe(total);
  }
});
test('clamps invalid pages, shrinking datasets and page-size changes before slicing', () => {
  expect(ratesPageWindow(21, 3, 10)).toMatchObject({ page: 3, from: 21, to: 21 });
  expect(ratesPageWindow(21, 3, 20)).toMatchObject({ page: 2, from: 21, to: 21 });
  expect(ratesPageWindow(0, 99, 20)).toMatchObject({ page: 1, pages: 0, from: 0, to: 0, next: false, previous: false });
  for (const page of [0, -3, NaN, Infinity]) expect(ratesPageWindow(30, page, 10).page).toBe(1);
  expect(normalizeRatesPageSize(10)).toBe(10);
  for (const value of [20, undefined, null, 500, '10']) expect(normalizeRatesPageSize(value)).toBe(20);
});
test('the numbered index is bounded, contains the current/first/last pages, and uses distinct gap tokens', () => {
  expect(ratesPageIndex(1, 0)).toEqual([]);
  expect(ratesPageIndex(1, 1)).toEqual([1]);
  for (const pages of [8, 300, 6000]) for (const page of [1, 2, Math.floor(pages / 2), pages - 1, pages]) {
    const items = ratesPageIndex(page, pages);
    expect(items.length).toBeLessThanOrEqual(7); expect(new Set(items).size).toBe(items.length);
    expect(items).toContain(1); expect(items).toContain(page); expect(items).toContain(pages);
    expect(items.filter(item => typeof item === 'number')).toEqual([...items.filter(item => typeof item === 'number')].sort((a, b) => Number(a) - Number(b)));
  }
});
test('meaningful filter/search/sort changes reset page one; selection and idempotent actions retain it', () => {
  const original = captureRatesSession();
  try {
    initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
    for (const patch of [{ query: 'A' }, { sort: 'bank' as const }, { filters: { ...EMPTY_FILTERS, providers: ['A'] } }, { path: ['OO'] }]) {
      updateRatesSection('Mortgage', { page: 4 }); updateRatesSection('Mortgage', patch);
      expect(useRatesSession.getState().sections.Mortgage.page).toBe(1);
    }
    updateRatesSection('Mortgage', { page: 3 }); updateRatesSection('Mortgage', { selected: ['0#a'], selectMode: true });
    updateRatesSection('Mortgage', { query: 'A' });
    expect(useRatesSession.getState().sections.Mortgage.page).toBe(3);
    updateRatesSection('Savings', { page: 2 });
    syncRatesPreferences({ ...DEFAULT_PREFS, profileFilters: { ...DEFAULT_PREFS.profileFilters, rateTypes: ['FIXED'] } });
    expect(useRatesSession.getState().sections.Mortgage.page).toBe(1);
    expect(useRatesSession.getState().sections.Mortgage.selected).toEqual(['0#a']);
    expect(useRatesSession.getState().sections.Savings.page).toBe(2);
  } finally { restoreRatesSession(original); }
});
