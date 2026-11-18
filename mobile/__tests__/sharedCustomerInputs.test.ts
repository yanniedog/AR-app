import { loadCustomerProfile, updateCustomerProfile } from '../src/data/customerProfileStorage';
import { comparisonInputs, withInput } from '../src/data/customerInputState';
import { mortgageComparisonValues } from '../src/data/mortgageComparison';
import { computeLvr } from '../src/data/calc';
import { Decimal } from '../src/data/publicRateDecimal';
import { loadUserRateScenario, normalizeUserRateScenario, saveUserRateScenario, mergeScenarioChanges } from '../src/data/userRateScenario';
import { openMortgageComparisonProfile, saveMortgageComparisonInputs, saveMortgageComparisonFacets, resetMortgageComparisonProfileForTests } from '../src/data/mortgageComparisonProfile';
import { ensureUserRateScenarioLoaded, flushUserRateScenario, getUserRateScenarioSnapshotForTests, resetUserRateScenarioStoreForTests, updateUserRateScenario } from '../src/hooks/useUserRateScenario';
import { readSecureStoreValue, writeSecureStoreValue } from '../src/lib/secureStoreValue';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';
import { createUserActions } from '../src/data/storeUser';
import type { AppState } from '../src/data/storeTypes';

jest.mock('../src/lib/secureStoreValue', () => ({ readSecureStoreValue: jest.fn(), writeSecureStoreValue: jest.fn() }));
const values = new Map<string, string>();
beforeEach(() => {
  resetUserRateScenarioStoreForTests(); resetMortgageComparisonProfileForTests(); values.clear(); jest.clearAllMocks();
  jest.mocked(readSecureStoreValue).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(writeSecureStoreValue).mockImplementation(async (key, value) => { values.set(key, value); });
});

test('v4 calculator values migrate once, preserving exact original source and sharing Rates inputs', async () => {
  const raw = JSON.stringify(normalizeUserRateScenario({ mortgage: { mode: 'refi', propertyValue: '775000', loanBalance: '650000', currentRate: '6.74', years: '25' }, projections: { mortgage: { offsetBalance: '50000' } } }));
  values.set(SECURE_STORE_KEYS.userRateScenario, raw);
  const profile = await loadCustomerProfile();
  expect(comparisonInputs(profile.inputState!)).toMatchObject({ loanAmount: '650000', propertyValue: '775000', fundsAvailable: '50000' });
  expect(profile.inputState!.scenario.mortgage.currentRate).toBe('6.74');
  expect(values.get(SECURE_STORE_KEYS.userRateScenario)).toBe(raw);
  await saveUserRateScenario({ ...profile.inputState!.scenario, mortgage: { ...profile.inputState!.scenario.mortgage, currentRate: '6.25' } });
  expect((await loadCustomerProfile()).answers['legacy.mortgage.currentRate']).toMatchObject({ state: 'known', fact: { value: '6.25' } });
  expect(values.get(SECURE_STORE_KEYS.userRateScenario)).toBe(raw);
});

test('Rates edits repopulate calculator and projection inputs without a second financial record', async () => {
  await openMortgageComparisonProfile();
  saveMortgageComparisonInputs({ loanAmount: '650000', lvr: '', lvrMode: 'funds', fundsType: 'offset', propertyValue: '775000', fundsAvailable: '75000' });
  await openMortgageComparisonProfile();
  const scenario = await loadUserRateScenario();
  expect(scenario.mortgage).toMatchObject({ mode: 'refi', loanBalance: '650000', propertyValue: '775000' });
  expect(scenario.projections.mortgage.offsetBalance).toBe('75000');
  expect((await loadCustomerProfile()).inputState!.comparison).not.toHaveProperty('loanAmount');
  expect(values.has(SECURE_STORE_KEYS.mortgageComparisonProfile)).toBe(false);
});

test('concurrent Rates and calculator edits preserve both latest fields', async () => {
  await ensureUserRateScenarioLoaded();
  updateUserRateScenario(current => ({ ...current, mortgage: { ...current.mortgage, currentRate: '6.74' } }));
  saveMortgageComparisonInputs({ loanAmount: '650000', lvr: '', lvrMode: 'funds', fundsType: 'offset', propertyValue: '775000', fundsAvailable: '50000' });
  await Promise.all([openMortgageComparisonProfile(), flushUserRateScenario()]);
  const saved = await loadUserRateScenario();
  expect(saved.mortgage).toMatchObject({ loanBalance: '650000', propertyValue: '775000', currentRate: '6.74' });
  expect(getUserRateScenarioSnapshotForTests().scenario.mortgage).toMatchObject(saved.mortgage);
});

test('legacy disagreements require selection, equivalent amount spellings do not', async () => {
  values.set(SECURE_STORE_KEYS.userRateScenario, JSON.stringify(normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '650000', propertyValue: '775000' } })));
  values.set(SECURE_STORE_KEYS.mortgageComparisonProfile, JSON.stringify({ version: 1, inputs: { loanAmount: '$650k', lvr: '', lvrMode: 'funds', fundsType: 'offset', propertyValue: '$800k', fundsAvailable: '0' }, facets: { loanPurposes: [], repaymentTypes: [] } }));
  const profile = await loadCustomerProfile();
  expect(profile.inputState!.conflicts).toEqual([{ path: 'mortgage.propertyValue', current: '775000', incoming: '$800k' }]);
  await updateCustomerProfile(current => ({ ...current, inputState: { ...current.inputState!, scenario: withInput(current.inputState!.scenario, 'mortgage.propertyValue', '$800k'), conflicts: [] } }));
  expect((await loadUserRateScenario()).mortgage.propertyValue).toBe('$800k');
  expect((await loadCustomerProfile()).inputState!.conflicts).toEqual([]);
});

test('changing purpose/repayment never switches calculator buying/refinancing mode', async () => {
  const scenario = normalizeUserRateScenario({ mortgage: { mode: 'buy', propertyValue: '800000', deposit: '150000', years: '30' } });
  await saveUserRateScenario(scenario);
  saveMortgageComparisonFacets({ loanPurposes: ['INVESTMENT'], repaymentTypes: ['PRINCIPAL_AND_INTEREST'] });
  await openMortgageComparisonProfile();
  expect((await loadUserRateScenario()).mortgage).toEqual(scenario.mortgage);
});

test('a calculator-only entry creates reusable profile facts and Rates derives the same actual LVR', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'refi', propertyValue: '775000', loanBalance: '650000', currentRate: '6.74', years: '25' }, projections: { mortgage: { offsetBalance: '0' } } }));
  const profile = await loadCustomerProfile();
  expect(profile.answers['legacy.mortgage.currentRate']).toMatchObject({ state: 'known', fact: { value: '6.74' } });
  expect(profile.answers['legacy.projections.mortgage.offsetBalance']).toMatchObject({ state: 'known', fact: { value: '0', unit: 'AUD' } });
  expect(comparisonInputs(profile.inputState!)).toMatchObject({ loanAmount: '650000', lvrMode: 'funds', fundsType: 'offset', propertyValue: '775000', fundsAvailable: '0' });
});

test('valid fractional/percent rate entry becomes the same profile fact without retyping', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ savings: { balance: '1000', currentRate: '.5%' } }));
  expect((await loadCustomerProfile()).answers['legacy.savings.currentRate']).toMatchObject({ state: 'known', fact: { value: '0.5', unit: 'percent' } });
});

test('leading-zero rate and term remain valid saved task drafts with canonical profile facts', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { currentRate: '06.74', years: '025' } }));
  const profile = await loadCustomerProfile();
  expect(profile.inputState!.scenario.mortgage).toMatchObject({ currentRate: '06.74', years: '025' });
  expect(profile.answers['legacy.mortgage.currentRate']).toMatchObject({ state: 'known', fact: { value: '6.74' } });
  expect(profile.answers['legacy.mortgage.years']).toMatchObject({ state: 'known', fact: { value: '25' } });
});

test('buying funds exclude upfront costs exactly once in the shared Rates LVR', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' } }));
  await updateCustomerProfile(profile => ({ ...profile, inputState: { ...profile.inputState!, comparison: { ...profile.inputState!.comparison, lvrMode: 'funds', fundsType: 'deposit' } } }));
  const inputs = comparisonInputs((await loadCustomerProfile()).inputState!);
  expect(mortgageComparisonValues(inputs)).toMatchObject({ amount: 670000, propertyValue: 800000, lvr: 83.75 });
});

test('editing buying net deposit restores gross savings and keeps Rates and Calculate on the same exact LVR', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' } }));
  await updateCustomerProfile(profile => ({ ...profile, inputState: { ...profile.inputState!, comparison: { ...profile.inputState!.comparison, lvrMode: 'funds', fundsType: 'deposit' } } }));
  const before = comparisonInputs((await loadCustomerProfile()).inputState!);
  expect(mortgageComparisonValues(before)).toMatchObject({ amount: 670000, propertyValue: 800000 });
  saveMortgageComparisonInputs({ ...before, fundsAvailable: '150000' });
  await openMortgageComparisonProfile();
  const saved = (await loadCustomerProfile()).inputState!;
  expect(saved.scenario.mortgage).toMatchObject({ mode: 'buy', propertyValue: '820000.00', deposit: '170000.00', costs: '20000' });
  expect(computeLvr(saved.scenario.mortgage).loan).toBe(670000);
  const rates = comparisonInputs(saved), parsed = mortgageComparisonValues(rates);
  expect(rates.loanAmount).toBe('670000');
  expect(parsed).toMatchObject({ amount: 670000, propertyValue: 820000 });
  const exact = Decimal.parse('670000').div(Decimal.parse('820000')).mul(Decimal.parse('100'));
  expect(parsed.exactLvr?.compare(exact)).toBe(0);
  expect(computeLvr(saved.scenario.mortgage).lvr).toBeCloseTo(parsed.lvr!, 12);
});

test('a funds-type-only toggle persists the displayed money and preserves the saved buying property', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' } }));
  await updateCustomerProfile(profile => ({ ...profile, inputState: { ...profile.inputState!, comparison: { ...profile.inputState!.comparison, lvrMode: 'funds', fundsType: 'deposit' } } }));
  const deposit = comparisonInputs((await loadCustomerProfile()).inputState!);
  saveMortgageComparisonInputs({ ...deposit, fundsType: 'offset' });
  await openMortgageComparisonProfile();
  let saved = (await loadCustomerProfile()).inputState!;
  expect(saved.scenario.mortgage).toMatchObject({ mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' });
  expect(comparisonInputs(saved)).toMatchObject({ fundsType: 'offset', fundsAvailable: '130000.00', loanAmount: '670000' });
  saveMortgageComparisonInputs({ ...comparisonInputs(saved), fundsType: 'deposit' });
  await openMortgageComparisonProfile();
  saved = (await loadCustomerProfile()).inputState!;
  expect(computeLvr(saved.scenario.mortgage).loan).toBe(670000);
  expect(comparisonInputs(saved)).toMatchObject({ fundsType: 'deposit', fundsAvailable: '130000.00', loanAmount: '670000' });
  expect(saved.scenario.mortgage).toMatchObject({ mode: 'buy', propertyValue: '800000.00', deposit: '150000.00', costs: '20000' });
});

test('toggling an empty offset to deposit never deletes known buying savings or property', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' } }));
  const before = comparisonInputs((await loadCustomerProfile()).inputState!);
  expect(before.fundsAvailable).toBe('');
  saveMortgageComparisonInputs({ ...before, fundsType: 'deposit' });
  await openMortgageComparisonProfile();
  expect((await loadUserRateScenario()).mortgage).toMatchObject({ mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' });
});

test('rebasing a selected product removes omitted semantic identities while preserving concurrent edits', () => {
  const previous = normalizeUserRateScenario({ currentProducts: { mortgage: { provider: 'Bank', productKey: 'old', rateIndex: 1, offerId: 'old-offer', programmeId: 'old-programme' } },
    localRates: { mortgage: { referenceScenario: { package: 'OLD', channel: 'ONLINE' } } } });
  const current = normalizeUserRateScenario({ ...previous, mortgage: { ...previous.mortgage, currentRate: '6.74' } });
  const next = normalizeUserRateScenario({ ...previous, currentProducts: { ...previous.currentProducts, mortgage: { provider: 'Bank', productKey: 'new', rateIndex: 2 } },
    localRates: { ...previous.localRates, mortgage: { ...previous.localRates.mortgage, referenceScenario: { channel: 'ONLINE' } } } });
  const merged = mergeScenarioChanges(current, previous, next);
  expect(merged.currentProducts.mortgage).toEqual({ provider: 'Bank', productKey: 'new', rateIndex: 2 });
  expect(merged.localRates.mortgage.referenceScenario).toEqual({ channel: 'ONLINE' });
  expect(merged.mortgage.currentRate).toBe('6.74');
});

test('a queued comparison edit then revert preserves the final explicit value', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'refi', propertyValue: '775000', loanBalance: '650000' }, projections: { mortgage: { offsetBalance: '50000' } } }));
  const before = comparisonInputs((await loadCustomerProfile()).inputState!);
  saveMortgageComparisonInputs({ ...before, loanAmount: '700000' });
  saveMortgageComparisonInputs(before);
  await openMortgageComparisonProfile();
  expect((await loadUserRateScenario()).mortgage.loanBalance).toBe('650000');
});

test('a revert made during an encrypted write supersedes the submitted comparison field', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'refi', propertyValue: '775000', loanBalance: '650000' }, projections: { mortgage: { offsetBalance: '50000' } } }));
  const before = comparisonInputs((await loadCustomerProfile()).inputState!);
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const writing = new Promise<void>(resolve => { started = resolve; });
  jest.mocked(writeSecureStoreValue).mockImplementationOnce(async (key, value) => {
    started(); await gate; values.set(key, value);
  });
  saveMortgageComparisonInputs({ ...before, loanAmount: '700000' });
  const saving = openMortgageComparisonProfile();
  await writing;
  saveMortgageComparisonInputs(before);
  release(); await saving;
  expect((await loadUserRateScenario()).mortgage.loanBalance).toBe('650000');
});

test('switching comparison display to direct LVR preserves the buying scenario and money', async () => {
  const initial = normalizeUserRateScenario({ mortgage: { mode: 'buy', propertyValue: '800000', deposit: '150000', costs: '20000' } });
  await saveUserRateScenario(initial);
  const before = comparisonInputs((await loadCustomerProfile()).inputState!);
  saveMortgageComparisonInputs({ loanAmount: before.loanAmount, lvr: '80', lvrMode: 'lvr' });
  await openMortgageComparisonProfile();
  expect((await loadUserRateScenario()).mortgage).toEqual(initial.mortgage);
});

test('Settings cache clear and an active comparison reset leave encrypted customer inputs untouched', async () => {
  await saveUserRateScenario(normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '650000', currentRate: '6.74' } }));
  const saved = values.get(SECURE_STORE_KEYS.customerProfile);
  await createUserActions(jest.fn(), () => ({ bootstrap: async () => undefined }) as unknown as AppState).clearCache();
  // Downloaded caches and active Rates scope have no authority over this key.
  const { clearMortgageComparison } = jest.requireActual('../src/data/mortgageComparison');
  clearMortgageComparison();
  expect(values.get(SECURE_STORE_KEYS.customerProfile)).toBe(saved);
  expect((await loadUserRateScenario()).mortgage.loanBalance).toBe('650000');
});

test('future or malformed canonical scenario is rejected without replacing originals', async () => {
  const profile = await loadCustomerProfile();
  const damaged = JSON.stringify({ ...profile, inputState: { ...profile.inputState!, scenario: { ...profile.inputState!.scenario, version: 99 } } });
  values.set(SECURE_STORE_KEYS.customerProfile, damaged);
  await expect(loadUserRateScenario()).rejects.toThrow('Invalid shared');
  expect(values.get(SECURE_STORE_KEYS.customerProfile)).toBe(damaged);
});


test('a loan-only Rates edit cannot replay stale property and offset values over a queued calculator edit', async () => {
  const initial = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '650000', propertyValue: '775000', currentRate: '6.74', years: '25' },
    projections: { mortgage: { offsetBalance: '50000' } } });
  await saveUserRateScenario(initial);
  const rates = comparisonInputs((await loadCustomerProfile()).inputState!);
  const calculatorWrite = saveUserRateScenario({ ...initial, mortgage: { ...initial.mortgage, propertyValue: '800000' },
    projections: { ...initial.projections, mortgage: { ...initial.projections.mortgage, offsetBalance: '75000' } } }, initial);
  saveMortgageComparisonInputs({ ...rates, loanAmount: '700000' });
  await Promise.all([calculatorWrite, openMortgageComparisonProfile()]);
  expect((await loadUserRateScenario()).mortgage).toMatchObject({ loanBalance: '700000', propertyValue: '800000' });
  expect((await loadUserRateScenario()).projections.mortgage.offsetBalance).toBe('75000');
});

test('the stored v4 scenario shape is idempotent under normalisation (bump the version and migrate before changing it)', () => {
  const stored = {
    version: 4,
    mortgage: { mode: 'refi', propertyValue: '', deposit: '', costs: '', loanBalance: '', currentRate: '', years: '', savingsBalance: '' },
    savings: { balance: '', currentRate: '' },
    termDeposit: { balance: '', currentRate: '' },
    projections: JSON.parse(JSON.stringify(normalizeUserRateScenario({}).projections)),
    currentProducts: { mortgage: { provider: '', productKey: '', rateIndex: null }, savings: { provider: '', productKey: '', rateIndex: null }, termDeposit: { provider: '', productKey: '', rateIndex: null } },
    mortgageSwitch: { currentBankExitFees: '', applicationFees: '', valuationFees: '', settlementFees: '', governmentAndLegalFees: '', otherUpfrontFees: '', cashback: '', fundingMethod: 'cash-or-offset', targetOffsetAvailable: 'auto' },
    localRates: Object.fromEntries(['mortgage', 'savings', 'termDeposit'].map(key => [key, { mode: 'entered', referenceId: '', totalAdjustment: '', allowHistorical: false, referenceChangeAlerts: false, referenceScenario: {} }])),
  };
  expect(JSON.parse(JSON.stringify(normalizeUserRateScenario({ ...stored, mortgage: { ...stored.mortgage, mode: 'refi' } })))).toEqual(stored);
});
