import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { makeSavedRateRef } from '../src/data/savedRates';
import { legacyPublicOfferRefId } from '../src/data/publicOfferIdentity';
import { loadTrackedRatesSecureResult, makeTrackedRate, saveTrackedRatesSecure, TRACKED_RATE_SECURE_STORAGE_KEY } from '../src/data/trackedRates';

const originalOs = Platform.OS;
const secure = new Map<string, string>();
const refs = [makeSavedRateRef({ product_key: 'UNIT:offer:A', public_offer_id: 'B', rate_index: 0, provider: 'Unit', product_name: 'Loan A', rate: '0.05' }),
  makeSavedRateRef({ product_key: 'UNIT', public_offer_id: 'A:offer:B', rate_index: 1, provider: 'Unit', product_name: 'Loan B', rate: '0.05' }),
  makeSavedRateRef({ product_key: 'UNIQUE', public_offer_id: 'UNIQUE', rate_index: 2, provider: 'Unit', product_name: 'Loan C', rate: '0.05' })];
const oldDates = refs.map(ref => ({ id: legacyPublicOfferRefId('rate', ref.productKey, ref.offerId!),
  relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' }));

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  secure.clear(); jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => secure.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { secure.set(key, value); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { secure.delete(key); });
});
afterAll(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs }));

function install(chunked: boolean) {
  if (!chunked) secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, JSON.stringify(oldDates));
  else {
    secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, generation: 'old-generation', chunks: 1 }));
    secure.set(`${TRACKED_RATE_SECURE_STORAGE_KEY}.chunk.old-generation.0`, JSON.stringify(oldDates));
  }
}

test.each([false, true])('ambiguous %s legacy storage is retained across a reduced saved set and later write', async chunked => {
  install(chunked); const before = new Map(secure);
  await expect(loadTrackedRatesSecureResult(refs)).resolves.toMatchObject({ status: 'unavailable', reason: 'ambiguous-legacy-identity' });
  // Removing a reference cannot make an inherently ambiguous old date safe to assign.
  await expect(loadTrackedRatesSecureResult([refs[0]])).resolves.toMatchObject({ status: 'unavailable', reason: 'ambiguous-legacy-identity' });
  await expect(saveTrackedRatesSecure(refs.map(ref => makeTrackedRate(ref)))).rejects.toThrow(/Ambiguous legacy/);
  expect(secure).toEqual(before);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

test('a write cannot replace ambiguous private evidence even before a loader has run', async () => {
  install(true); const before = new Map(secure);
  await expect(saveTrackedRatesSecure([])).rejects.toThrow(/Ambiguous legacy/);
  expect(secure).toEqual(before);
});

test('incoming old semantic dates are refused before creating a new ambiguous secure record', async () => {
  const ref = refs[0], old = { ...ref, id: legacyPublicOfferRefId('rate', ref.productKey, ref.offerId!) };
  await expect(saveTrackedRatesSecure([{ ...makeTrackedRate(old), relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' }]))
    .rejects.toThrow(/Ambiguous legacy/);
  expect(secure.size).toBe(0);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('a current structured legacy rate with delimiter text retains its date through a tagged private key', async () => {
  const ref = makeSavedRateRef({ product_key: 'UNIT:offer:A', rate_index: 0, provider: 'Unit', product_name: 'Legacy Loan', rate: '0.05' });
  const tracked = { ...makeTrackedRate(ref), relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' as const };
  await saveTrackedRatesSecure([tracked]);
  await expect(loadTrackedRatesSecureResult([ref])).resolves.toMatchObject({ status: 'ready', trackedRates: [expect.objectContaining({ id: ref.id, relevantDate: tracked.relevantDate })] });
  const manifest = JSON.parse(secure.get(TRACKED_RATE_SECURE_STORAGE_KEY)!);
  const records = JSON.parse(secure.get(`${TRACKED_RATE_SECURE_STORAGE_KEY}.chunk.${manifest.generation}.0`)!);
  expect(records[0].id).toMatch(/^legacy-rate-date-v2:/);
});

test.each(['rate:UNIT:offer:offer:B', 'rate:UNIT:offer:A:0', 'rate:UNIT:offer:A:-1', 'rate:UNIT:offer:A:1e+21'])
('overlapping or canonical legacy aliases remain unavailable: %s', async id => {
  const raw = JSON.stringify([{ id, relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' }]);
  secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, raw);
  await expect(loadTrackedRatesSecureResult([])).resolves.toMatchObject({ status: 'unavailable', reason: 'ambiguous-legacy-identity' });
  await expect(saveTrackedRatesSecure([])).rejects.toThrow(/Ambiguous legacy/);
  expect(secure.get(TRACKED_RATE_SECURE_STORAGE_KEY)).toBe(raw);
});

test.each(['unreadable', 'malformed', 'missing-chunk', 'empty'])('a %s existing private record cannot be overwritten as an absent record', async mode => {
  if (mode === 'unreadable') jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('locked'));
  if (mode === 'malformed') secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, '{broken');
  if (mode === 'empty') secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, '');
  if (mode === 'missing-chunk') secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, generation: 'old-generation', chunks: 1 }));
  const before = new Map(secure);
  await expect(saveTrackedRatesSecure([])).rejects.toThrow();
  expect(secure).toEqual(before);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

test.each([
  ['null entry', null],
  ['numeric id', { id: 123, relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end' }],
  ['invalid date', { id: 'rate:UNIT:0', relevantDate: '2027-02-30', relevantDateKind: 'fixed-rate-end' }],
  ['invalid kind', { id: 'rate:UNIT:0', relevantDate: '2027-01-31', relevantDateKind: 'unknown' }],
  ['unknown fields', { id: 'rate:UNIT:0', relevantDate: '2027-01-31', relevantDateKind: 'fixed-rate-end', unknown: 'retained evidence' }],
])('valid JSON with %s remains unavailable and cannot be overwritten in either storage format', async (_name, record) => {
  for (const chunked of [false, true]) {
    secure.clear(); jest.mocked(SecureStore.setItemAsync).mockClear(); jest.mocked(SecureStore.deleteItemAsync).mockClear();
    const raw = JSON.stringify([record]);
    if (!chunked) secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, raw);
    else {
      secure.set(TRACKED_RATE_SECURE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, generation: 'old-generation', chunks: 1 }));
      secure.set(`${TRACKED_RATE_SECURE_STORAGE_KEY}.chunk.old-generation.0`, raw);
    }
    const before = new Map(secure);
    await expect(loadTrackedRatesSecureResult([])).resolves.toMatchObject({ status: 'unavailable' });
    await expect(saveTrackedRatesSecure([])).rejects.toThrow();
    expect(secure).toEqual(before);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  }
});
