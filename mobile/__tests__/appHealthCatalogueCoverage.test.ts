import { makeHealthyDataFixture } from '../__fixtures__/appHealth';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { setSuitabilityAllowed } from '../src/data/suitabilityGate';
import type { AppState } from '../src/data/storeTypes';
import { appHealthCatalogueSnapshot, preparedAppHealthCatalogueSnapshot } from '../src/lib/performanceAuditCatalogueSnapshot';
import { appHealthDataSnapshot } from '../src/lib/performanceAuditDataSnapshot';
import { evaluateAppHealthCatalogueCoverage } from '../src/lib/appHealth/catalogueCoverage';
import { toPublicAppHealthReport, finalizeAppHealthReport } from '../src/lib/appHealth/report';
import type { CorePayload, RateRow } from '../src/types';
import * as selectors from '../src/data/selectors';

function stateFor(core: CorePayload): AppState {
  const products = Object.fromEntries(Object.values(core.sections).flatMap(section => section.rates)
    .map(row => [row.product_key, { product_name: row.product_name }]));
  return { core, prefs: { includeNonStandard: true, interests: ['Mortgage', 'Savings', 'TD'],
    depositRankMetric: 'max', mortgageRateMetric: 'comparison' },
    details: { run_date: core.run_date, products },
    searchIndex: { run_date: core.run_date, schema_version: 1,
      products: Object.fromEntries(Object.keys(products).map(key => [key, key])) },
  } as unknown as AppState;
}

function fixture() {
  const { snapshot } = makeHealthyDataFixture();
  const state = stateFor(snapshot.core!);
  snapshot.catalogue = appHealthCatalogueSnapshot(state);
  return { snapshot, state };
}

afterEach(() => {
  installMandatoryEligibility(selectMandatoryEligibility(null, null, null));
  setSuitabilityAllowed(null);
});

test('manual snapshots reuse passive catalogue evidence without rerunning any selectors', () => {
  const state = stateFor(makeHealthyDataFixture().snapshot.core!);
  const search = jest.spyOn(selectors, 'filterRows');
  const banks = jest.spyOn(selectors, 'groupByProvider');
  try {
    const passive = appHealthDataSnapshot(state, '1.0.0');
    expect(search).toHaveBeenCalledTimes(3);
    expect(banks).toHaveBeenCalledTimes(3);
    for (let run = 0; run < 200; run++) {
      const manual = appHealthDataSnapshot({ ...state, prefs: { ...state.prefs } }, '1.0.0');
      expect(manual.catalogue).toBe(passive.catalogue);
    }
    expect(search).toHaveBeenCalledTimes(3);
    expect(banks).toHaveBeenCalledTimes(3);
    expect(preparedAppHealthCatalogueSnapshot(state)).toEqual(appHealthCatalogueSnapshot(state));
  } finally { search.mockRestore(); banks.mockRestore(); }
});

test('prepared coverage invalidates on payloads, interests, rank settings and eligibility revisions', () => {
  let state = stateFor(makeHealthyDataFixture().snapshot.core!);
  let previous = preparedAppHealthCatalogueSnapshot(state);
  const expectNew = () => {
    const next = preparedAppHealthCatalogueSnapshot(state);
    expect(next).not.toBe(previous);
    expect(next).toEqual(appHealthCatalogueSnapshot(state));
    previous = next;
  };
  state = { ...state, core: { ...state.core! } };
  expectNew();
  state = { ...state, details: { ...state.details!, products: {} } };
  expectNew();
  expect(previous!.sections[0].missingDetails).toHaveLength(1);
  state = { ...state, searchIndex: { ...state.searchIndex!, products: {}, run_date: '2020-01-01' } };
  expectNew();
  expect(previous!.searchIndexRunMatches).toBe(false);
  state = { ...state, prefs: { ...state.prefs, interests: ['Mortgage'], depositRankMetric: 'base' } };
  expectNew();
  expect(previous!.sections[1].selectedInterest).toBe(false);
  state = { ...state, prefs: { ...state.prefs, mortgageRateMetric: 'headline' } };
  expectNew();
  state = { ...state, prefs: { ...state.prefs, includeNonStandard: false } };
  expectNew();
  setSuitabilityAllowed(new Set());
  expectNew();
  expect(previous!.sections.every(section => section.eligible?.rates === 0)).toBe(true);
  installMandatoryEligibility({ active: true, loading: true, rows: new WeakSet(), productKeys: new Set() });
  expectNew();
  expect(previous!.filterState).toBe('blocked');
  state = { ...state, core: null };
  expect(preparedAppHealthCatalogueSnapshot(state)).toBeNull();
});

test('reconciles every category and bank while separating full loaded coverage from sampled rendering', () => {
  const { snapshot } = fixture();
  const check = evaluateAppHealthCatalogueCoverage(snapshot);
  expect(check).toMatchObject({ status: 'pass', metrics: { publishedProducts: 3, publishedProviders: 3,
    eligibleProducts: 3, eligibleProviders: 3, identityMismatches: 0, missingDetails: 0,
    exhaustiveLoadedCatalogueScan: true, allProductsRendered: false, sourceIdentityInventoryAvailable: false,
    sourceProducts: null, sourceRates: null } });
  expect(snapshot.catalogue!.sections.map(section => section.providers.length)).toEqual([1, 1, 1]);
  expect(check.localEvidence?.sections).toHaveLength(3);
});

test('detects substituted exact tiers even when product and bank counts match', () => {
  const { snapshot } = fixture();
  const section = snapshot.catalogue!.sections[0];
  section.searchMissing = ['["Provider 1","mortgage-1",0]'];
  section.searchUnexpected = ['["Provider 1","mortgage-1",99]'];
  expect(section.eligible).toEqual(section.search);
  expect(evaluateAppHealthCatalogueCoverage(snapshot)).toMatchObject({ status: 'fail', metrics: { identityMismatches: 2 } });
});

test('independently detects a Banks selector returning a different tier at equal counts', () => {
  const { snapshot, state } = fixture();
  const original = selectors.groupByProvider;
  const spy = jest.spyOn(selectors, 'groupByProvider').mockImplementation((...args) =>
    original(...args).map(group => ({ ...group, rows: group.rows.map(row =>
      ({ ...row, rate_index: (row.rate_index ?? 0) + 100 })) })));
  try {
    snapshot.catalogue = appHealthCatalogueSnapshot(state);
    expect(snapshot.catalogue!.sections[0].directory).toEqual(snapshot.catalogue!.sections[0].eligible);
    expect(evaluateAppHealthCatalogueCoverage(snapshot)).toMatchObject({ status: 'fail', metrics: { identityMismatches: 6 } });
  } finally { spy.mockRestore(); }
});

test('accounts separately for mandatory profile, suitability and token-rate exclusions per provider', () => {
  const { snapshot } = makeHealthyDataFixture();
  const core = snapshot.core!;
  core.sections.Mortgage.rates[0].lvr_tier = 'LVR_60_70';
  const source = core.sections.Savings.rates[0];
  const excluded: RateRow = { ...source, product_key: 'profile-excluded' };
  const nonstandard: RateRow = { ...source, product_key: 'suitability-excluded' };
  const token: RateRow = { ...source, product_key: 'token-rate', rate: '0' };
  core.sections.Savings.rates.push(excluded, nonstandard, token);
  const allowedRows = Object.values(core.sections).flatMap(section => section.rates).filter(row => row !== excluded);
  installMandatoryEligibility({ active: true, loading: false, rows: new WeakSet(allowedRows),
    productKeys: new Set(allowedRows.map(row => row.product_key)) });
  setSuitabilityAllowed(new Set(allowedRows.filter(row => row !== nonstandard).map(row => row.product_key)));
  const state = stateFor(core);
  state.prefs.includeNonStandard = false;
  state.prefs.interests = ['Mortgage'];
  snapshot.catalogue = appHealthCatalogueSnapshot(state);
  expect(snapshot.catalogue!.sections[1]).toMatchObject({ selectedInterest: false,
    published: { products: 4 }, eligible: { products: 1 },
    excluded: { mandatoryProfile: 1, suitability: 1, tokenRate: 1 },
    providers: [{ provider: 'Provider 2', published: { products: 4 }, eligible: { products: 1 },
      excluded: { mandatoryProfile: 1, suitability: 1, tokenRate: 1 } }] });
  expect(evaluateAppHealthCatalogueCoverage(snapshot).metrics).toMatchObject({
    mandatoryProfileExcludedRates: 1, suitabilityExcludedRates: 1, tokenRateExcludedRates: 1,
  });
});

test('keeps blocked eligibility unknown even with full-catalogue opt-in', () => {
  const { snapshot, state } = fixture();
  installMandatoryEligibility({ active: true, loading: true, rows: new WeakSet(), productKeys: new Set() });
  snapshot.catalogue = appHealthCatalogueSnapshot(state);
  expect(snapshot.catalogue!.sections[0]).toMatchObject({ eligible: null, search: null, directory: null,
    excluded: { mandatoryProfile: null, suitability: null, tokenRate: null } });
  expect(evaluateAppHealthCatalogueCoverage(snapshot)).toMatchObject({ status: 'unavailable', metrics: {
    filterReady: false, eligibleProducts: null, eligibleProviders: null, identityMismatches: null } });
});

test('compares detail and search product identities, not matching record counts', () => {
  const { snapshot, state } = fixture();
  const removed = state.core!.sections.Mortgage.rates[0].product_key;
  delete state.details!.products[removed];
  state.details!.products['unrelated-detail'] = {};
  delete state.searchIndex!.products[removed];
  state.searchIndex!.products['unrelated-search'] = '';
  snapshot.catalogue = appHealthCatalogueSnapshot(state);
  expect(evaluateAppHealthCatalogueCoverage(snapshot)).toMatchObject({ status: 'warn', metrics: {
    missingDetails: 1, missingSearchIndex: 1 } });
  expect(snapshot.catalogue!.sections[0].missingDetails).toEqual([removed]);
  expect(snapshot.catalogue!.sections[0].missingSearchIndex).toEqual([removed]);
});

test('missing assets and absent catalogue evidence do not become zero missing products', () => {
  const { snapshot, state } = fixture();
  state.details = null;
  state.searchIndex = null;
  snapshot.catalogue = appHealthCatalogueSnapshot(state);
  expect(evaluateAppHealthCatalogueCoverage(snapshot)).toMatchObject({ status: 'unavailable', metrics: {
    missingDetails: null, missingSearchIndex: null, searchIndexRunMatches: null } });
  snapshot.catalogue = null;
  expect(evaluateAppHealthCatalogueCoverage(snapshot).status).toBe('unavailable');
});

test('rejects a search index from another publication even when all keys match', () => {
  const { snapshot, state } = fixture();
  state.searchIndex!.run_date = '2020-01-01';
  snapshot.catalogue = appHealthCatalogueSnapshot(state);
  expect(evaluateAppHealthCatalogueCoverage(snapshot)).toMatchObject({ status: 'fail', metrics: { searchIndexRunMatches: false } });
});

test('keeps provider and exact product evidence out of public diagnostics', () => {
  const { snapshot } = fixture();
  const check = evaluateAppHealthCatalogueCoverage(snapshot);
  const report = finalizeAppHealthReport({ sessionId: 'catalogue-test', mode: 'local',
    startedAt: '2026-10-12T00:00:00Z', finishedAt: '2026-10-12T00:00:01Z', checks: [check], plannedCheckIds: [check.id] });
  expect(JSON.stringify(toPublicAppHealthReport(report))).not.toContain('Provider 1');
  expect(JSON.stringify(toPublicAppHealthReport(report))).not.toContain('mortgage-1');
});
