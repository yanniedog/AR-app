import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { EMPTY_FILTERS } from '../src/data/selectors';
import { captureRatesSession, restoreRatesSession, initializeRatesSession, syncRatesPreferences, changeRatesSection, updateRatesSection, recordRatesScroll, useRatesSession } from '../src/data/ratesSession';
import { resolveRatesIntent, ratesIntentKey } from '../src/lib/ratesIntent';
import { rowsForSearchScope } from '../src/data/taxonomy';
import type { RateRow } from '../src/types';
const original = captureRatesSession();
beforeEach(() => restoreRatesSession(original));

test('changing page size clears saved offsets and pages while preserving temporary choices and selections', () => {
  initializeRatesSession({ ...DEFAULT_PREFS, ratesPageSize: 20 }, 'Mortgage');
  updateRatesSection('Mortgage', { page: 2, query: 'retained', selected: ['7#x'], filters: { ...EMPTY_FILTERS, providers: ['Bank A'] } });
  recordRatesScroll('Mortgage', 600);
  syncRatesPreferences({ ...DEFAULT_PREFS, ratesPageSize: 10 });
  expect(useRatesSession.getState().sections.Mortgage).toMatchObject({ page: 1, scrollOffset: 0,
    query: 'retained', selected: ['7#x'], filters: { providers: ['Bank A'] } });
});
test('per-family query/filter/sort/selection and offset survive switching and exact snapshot restoration', () => {
  initializeRatesSession(DEFAULT_PREFS, 'Savings');
  updateRatesSection('Savings', { query: 'Bank A', sort: 'bank', filters: { ...EMPTY_FILTERS, providers: ['Bank A'] }, selectMode: true, selected: ['7#x'] });
  recordRatesScroll('Savings', 420);
  changeRatesSection('TD'); updateRatesSection('TD', { query: 'Term 12', path: ['12M'] });
  changeRatesSection('Savings');
  expect(useRatesSession.getState().sections.Savings).toMatchObject({ query: 'Bank A', sort: 'bank', scrollOffset: 420, selected: ['7#x'] });
  const saved = captureRatesSession(); updateRatesSection('Savings', { query: 'temporary' });
  let notifications = 0; const stop = useRatesSession.subscribe(() => notifications++);
  restoreRatesSession(saved); stop();
  expect(notifications).toBe(1);
  expect(useRatesSession.getState().sections.Savings.query).toBe('Bank A');
  saved.sections.Savings.filters.providers.push('mutated outside');
  expect(useRatesSession.getState().sections.Savings.filters.providers).toEqual(['Bank A']);
});
test('scroll recording avoids a result rerender, while a changed result scope resets its offset', () => {
  initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
  const listener = jest.fn(); const stop = useRatesSession.subscribe(listener);
  recordRatesScroll('Mortgage', 600); expect(listener).not.toHaveBeenCalled();
  updateRatesSection('Mortgage', { query: 'new' }, true); stop();
  expect(useRatesSession.getState().sections.Mortgage.scrollOffset).toBe(0);
});
test('initialization is once and an optional interest never prevents selecting another family', () => {
  initializeRatesSession({ ...DEFAULT_PREFS, interests: ['Mortgage'] }, 'TD');
  expect(useRatesSession.getState().section).toBe('TD');
  updateRatesSection('TD', { query: 'retained' }); initializeRatesSession(DEFAULT_PREFS, 'Mortgage');
  expect(useRatesSession.getState().sections.TD.query).toBe('retained');
});
test('explicit repeated route values, empty scopes and saved search snapshots are retained precisely', () => {
  const intent = resolveRatesIntent({ section: ['term-deposits', 'Mortgage'], query: '', path: '', scope: '', compare: '1' }, 'Savings', []);
  expect(intent).toMatchObject({ section: 'TD', patch: { query: '', path: [], hierarchyScoped: false, selectMode: true, selected: [] } });
  const sub = { id: 'saved', kind: 'search' as const, section: 'Savings' as const, path: ['BONUS'], hierarchyScoped: true, query: 'real', sort: 'bank' as const,
    filters: { ...EMPTY_FILTERS, includeNonStandard: false, providers: ['Exact Bank'] }, label: 'Saved', createdAt: 'today' };
  expect(resolveRatesIntent({ sub: 'saved' }, 'Mortgage', [sub])).toMatchObject({ section: 'Savings', patch: { query: 'real', path: ['BONUS'],
    includeNonStandardOverride: false, filters: { providers: ['Exact Bank'] }, sort: 'bank' } });
});
test('invalid explicit identities do not broaden a stale or unknown request', () => {
  expect(resolveRatesIntent({ section: 'unknown' }, 'Mortgage', []).patch.intentError).toBeTruthy();
  expect(resolveRatesIntent({ providers: 'bad json' }, 'Mortgage', []).patch.intentError).toBeTruthy();
  expect(resolveRatesIntent({ sub: 'deleted' }, 'Mortgage', []).patch.intentError).toBeTruthy();
  const scope = resolveRatesIntent({ path: 'OO.UNKNOWN', scope: 'hierarchy' }, 'Mortgage', []);
  const row = { product_key: 'p', provider: 'A', product_name: 'Loan', rate: '0.05', taxonomy_path: 'HOME_LOAN.OO.PI' } as RateRow;
  expect(rowsForSearchScope([row], 'Mortgage', scope.patch.path!, true)).toEqual([]);
  expect(ratesIntentKey({})).toBeNull();
  expect(ratesIntentKey({ request: 'new', path: '' })).not.toBe(ratesIntentKey({ request: 'old', path: '' }));
});
