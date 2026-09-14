import { Platform } from 'react-native';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';
import { readSecureStoreValue, writeSecureStoreValue } from '../src/lib/secureStoreValue';
import { loadCustomerProfile, updateCustomerProfile } from '../src/data/customerProfileStorage';
jest.mock('../src/lib/secureStoreValue', () => ({ readSecureStoreValue: jest.fn(), writeSecureStoreValue: jest.fn() }));
const values = new Map<string, string>();
const originalOS = Platform.OS;
beforeEach(() => {
  values.clear(); jest.clearAllMocks(); Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.mocked(readSecureStoreValue).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(writeSecureStoreValue).mockImplementation(async (key, value) => { values.set(key, value); });
});
afterAll(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }));
test('migrates with verified destination write while preserving exact original scenario', async () => {
  const raw = '{"version":3,"savings":{"balance":"0"},"extra":[false,0]}';
  values.set(SECURE_STORE_KEYS.userRateScenario, raw);
  const p = await loadCustomerProfile();
  expect(p.answers['legacy.savings.balance']).toMatchObject({ state: 'known', fact: { value: '0' } });
  expect(values.get(SECURE_STORE_KEYS.userRateScenario)).toBe(raw);
  expect(writeSecureStoreValue).toHaveBeenCalledTimes(1);
  expect(await loadCustomerProfile()).toEqual(p);
});
test('failed legacy read never creates a replacement', async () => {
  jest.mocked(readSecureStoreValue).mockImplementation(async key => { if (key === SECURE_STORE_KEYS.userRateScenario) throw new Error('locked'); return null; });
  await expect(loadCustomerProfile()).rejects.toThrow(); expect(writeSecureStoreValue).not.toHaveBeenCalled();
});
test('interrupted migration retains original and retries safely', async () => {
  const raw = '{"version":3,"savings":{"balance":"12"}}'; values.set(SECURE_STORE_KEYS.userRateScenario, raw);
  jest.mocked(writeSecureStoreValue).mockRejectedValueOnce(new Error('interrupted'));
  await expect(loadCustomerProfile()).rejects.toThrow('interrupted');
  expect(values.get(SECURE_STORE_KEYS.userRateScenario)).toBe(raw);
  expect((await loadCustomerProfile()).legacyScenario).toEqual(JSON.parse(raw));
});
test('future profile and corrupt profile are never overwritten', async () => {
  for (const raw of ['{"version":99}', '{corrupt']) {
    values.set(SECURE_STORE_KEYS.customerProfile, raw);
    await expect(loadCustomerProfile()).rejects.toThrow(); expect(values.get(SECURE_STORE_KEYS.customerProfile)).toBe(raw);
  }
  expect(writeSecureStoreValue).not.toHaveBeenCalled();
});
test('failed readback is not reported as migrated', async () => {
  jest.mocked(writeSecureStoreValue).mockResolvedValue(undefined);
  await expect(loadCustomerProfile()).rejects.toThrow('verified');
});
test('incomplete committed profile remains blocked on retry and never remigrates legacy', async () => {
  values.set(SECURE_STORE_KEYS.userRateScenario, '{"version":3}');
  jest.mocked(readSecureStoreValue).mockImplementation(async (key, options) => {
    if (key === SECURE_STORE_KEYS.customerProfile) {
      expect(options).toEqual({ preserveIncomplete: true });
      throw new Error('Incomplete encrypted value retained unchanged.');
    }
    return values.get(key) ?? null;
  });
  await expect(loadCustomerProfile()).rejects.toThrow('retained unchanged');
  await expect(loadCustomerProfile()).rejects.toThrow('retained unchanged');
  expect(writeSecureStoreValue).not.toHaveBeenCalled();
});
test('concurrent edits read latest profile and preserve both changes', async () => {
  await loadCustomerProfile();
  await Promise.all([updateCustomerProfile(p => ({ ...p, legacyScenario: { keep: 1 } })), updateCustomerProfile(p => ({ ...p, definitions: { ...p.definitions } }))]);
  expect(await loadCustomerProfile()).toMatchObject({ revision: 2, legacyScenario: { keep: 1 } });
});
test('web never reads or writes customer data', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  await expect(loadCustomerProfile()).rejects.toThrow('installed app');
  expect(readSecureStoreValue).not.toHaveBeenCalled(); expect(writeSecureStoreValue).not.toHaveBeenCalled();
});
