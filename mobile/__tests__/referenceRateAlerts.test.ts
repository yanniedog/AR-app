import { Platform } from 'react-native';
import { referenceRateChanges, checkPublicReferenceChanges } from '../src/data/referenceRateAlerts';
import { ensurePublicRateCatalogueLoaded } from '../src/data/publicRateCatalogue';
import { notify } from '../src/data/notifications';
import { loadUserRateScenario, normalizeUserRateScenario, saveUserRateScenario } from '../src/data/userRateScenario';
import { readSecureStoreValue, writeSecureStoreValue } from '../src/lib/secureStoreValue';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';
import type { Manifest } from '../src/types';
import { AS_OF, catalogue, reference } from '../testUtils/publicRateJourney';

jest.mock('../src/data/publicRateCatalogue', () => ({ ensurePublicRateCatalogueLoaded: jest.fn() }));
jest.mock('../src/data/notifications', () => ({ notify: jest.fn(async () => undefined) }));
jest.mock('../src/lib/secureStoreValue', () => ({ readSecureStoreValue: jest.fn(async () => null), writeSecureStoreValue: jest.fn(async () => undefined) }));
jest.mock('../src/data/userRateScenario', () => ({ ...jest.requireActual('../src/data/userRateScenario'), loadUserRateScenario: jest.fn(), saveUserRateScenario: jest.fn() }));

const originalOS = Platform.OS;
const scenario = () => normalizeUserRateScenario({ mortgage: { currentRate: '6.271', loanBalance: '487321' }, localRates: { mortgage: {
  mode: 'reference', referenceId: 'unit-reference', totalAdjustment: '-2.619', referenceChangeAlerts: true } } });
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(new Date(AS_OF));
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' }); });
afterEach(() => { jest.useRealTimers(); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });

it('notifies only public reference movements with distinct scope and never includes private adjustments, balances or entered rates', () => {
  const input = scenario(), before = JSON.stringify(input);
  const result = referenceRateChanges(input, [reference({ value: '9.14', conditions: [{ conditionId: 'purpose', field: 'purpose', operator: 'eq', value: 'OWNER_OCCUPIED', evidenceIds: [] }] })],
    { 'unit-reference': { fraction: '0.0889' } }, 1, AS_OF);
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0].body).toContain('8.89% → 9.14%');
  expect(result.messages[0].body).toContain('Purpose: OWNER_OCCUPIED');
  expect(result.messages[0].body).toMatch(/charged rate: unverified/i);
  for (const privateValue of ['487321', '6.271', '-2.619']) expect(JSON.stringify(result.messages)).not.toContain(privateValue);
  expect(JSON.stringify(input)).toBe(before);
});

it.each(['failed', 'stale', 'deferred'] as const)('retains the baseline without an alert when the source is %s', state => {
  const previous = { 'unit-reference': { fraction: '0.0889' } };
  expect(referenceRateChanges(scenario(), [reference({ value: '10', freshness: { state, checkedAt: AS_OF, lastSuccessAt: AS_OF, reasonCodes: [] } })], previous, 1, AS_OF))
    .toEqual({ messages: [], baseline: previous });
});

it('does not apply future-effective or conflicting references, create a first-observation alert, or alert after opt-out', () => {
  const previous = { 'unit-reference': { fraction: '0.0889' } };
  expect(referenceRateChanges(scenario(), [reference({ value: '10', effectiveFrom: '2026-11-01' })], previous, 1, AS_OF).messages).toEqual([]);
  expect(referenceRateChanges(scenario(), [reference(), reference({ value: '10' })], previous, 1, AS_OF).messages).toEqual([]);
  expect(referenceRateChanges(scenario(), [reference()], {}, 1, AS_OF).messages).toEqual([]);
  const optedOut = scenario(); optedOut.localRates.mortgage.referenceChangeAlerts = false;
  expect(referenceRateChanges(optedOut, [reference({ value: '10' })], previous, 1, AS_OF).messages).toEqual([]);
});

it('uses a separate protected baseline and respects generation changes and an opt-out during acquisition', async () => {
  const input = scenario();
  jest.mocked(loadUserRateScenario).mockResolvedValue(input);
  jest.mocked(ensurePublicRateCatalogueLoaded).mockResolvedValue(catalogue([], [], [reference()]) as Awaited<ReturnType<typeof ensurePublicRateCatalogueLoaded>>);
  const manifest = { public_rate_catalogue: {} } as Manifest;
  await checkPublicReferenceChanges(manifest, 1);
  expect(writeSecureStoreValue).toHaveBeenCalledWith(SECURE_STORE_KEYS.referenceRateAlertBaseline, expect.any(String));
  expect(saveUserRateScenario).not.toHaveBeenCalled();
  expect(readSecureStoreValue).toHaveBeenCalledWith(SECURE_STORE_KEYS.referenceRateAlertBaseline);
  const before = JSON.stringify(input);
  jest.mocked(writeSecureStoreValue).mockClear(); jest.mocked(notify).mockClear();
  await checkPublicReferenceChanges(manifest, 1, () => false);
  expect(writeSecureStoreValue).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  const optedOut = normalizeUserRateScenario({ ...input, localRates: {} });
  jest.mocked(loadUserRateScenario).mockResolvedValueOnce(input).mockResolvedValueOnce(optedOut);
  await checkPublicReferenceChanges(manifest, 1);
  expect(notify).toHaveBeenLastCalledWith([], expect.any(Function));
  expect(JSON.stringify(input)).toBe(before);
  expect(saveUserRateScenario).not.toHaveBeenCalled();
});

it('rechecks the active reference watch at delivery after permission or transport waits', async () => {
  const input = scenario(), optedOut = scenario();
  optedOut.localRates.mortgage.referenceChangeAlerts = false;
  jest.mocked(loadUserRateScenario).mockResolvedValue(input);
  jest.mocked(ensurePublicRateCatalogueLoaded).mockResolvedValue(catalogue([], [], [reference({ value: '9.14' })]) as Awaited<ReturnType<typeof ensurePublicRateCatalogueLoaded>>);
  jest.mocked(readSecureStoreValue).mockResolvedValue(JSON.stringify({ 'unit-reference': { fraction: '0.0889' } }));
  const decisions: boolean[] = [];
  jest.mocked(notify).mockImplementationOnce(async (messages, canDeliver) => {
    expect(messages).toHaveLength(1);
    jest.mocked(loadUserRateScenario).mockResolvedValue(optedOut);
    decisions.push(await canDeliver!(messages[0]));
  });
  await checkPublicReferenceChanges({ public_rate_catalogue: {} } as Manifest, 1);
  expect(decisions).toEqual([false]);
  expect(writeSecureStoreValue).toHaveBeenLastCalledWith(SECURE_STORE_KEYS.referenceRateAlertBaseline, '{}');
});
