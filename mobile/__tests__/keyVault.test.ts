import * as SecureStore from 'expo-secure-store';

import { importPayloadSetupKey, resolvePayloadKeyHex } from '../src/lib/keyVault';
import { payloadKeyId } from '../src/lib/payloadCrypto';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';

const KEY_A = '01'.repeat(32);
const KEY_B = '02'.repeat(32);
const ACTIVE = SECURE_STORE_KEYS.payloadDecryptionKey;
const slot = (key: string) => `${ACTIVE}.${payloadKeyId(key)}`;
const setup = (key: string) => JSON.stringify({ schema_version: 1, key_id: payloadKeyId(key), key_hex: key });
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  jest.clearAllMocks();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => store.get(key) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => { store.set(key, value); });
});

it('requires a device key and never uses bundled config', async () => {
  await expect(resolvePayloadKeyHex()).rejects.toThrow('Data key unavailable');
});

it('preserves the legacy key before rotating and resolves both historical IDs', async () => {
  store.set(ACTIVE, KEY_A);
  await expect(importPayloadSetupKey(setup(KEY_B))).resolves.toBe(payloadKeyId(KEY_B));
  await expect(resolvePayloadKeyHex(payloadKeyId(KEY_A))).resolves.toBe(KEY_A);
  await expect(resolvePayloadKeyHex(payloadKeyId(KEY_B))).resolves.toBe(KEY_B);
  await expect(resolvePayloadKeyHex()).resolves.toBe(KEY_B);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(slot(KEY_B), KEY_B, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
});

it('serializes simultaneous imports without losing either historical key', async () => {
  await Promise.all([importPayloadSetupKey(setup(KEY_A)), importPayloadSetupKey(setup(KEY_B))]);
  await expect(resolvePayloadKeyHex(payloadKeyId(KEY_A))).resolves.toBe(KEY_A);
  await expect(resolvePayloadKeyHex(payloadKeyId(KEY_B))).resolves.toBe(KEY_B);
});

it.each(['{}', '[]', 'null', 'not json', 'x'.repeat(1025),
  JSON.stringify({ schema_version: 2, key_id: payloadKeyId(KEY_A), key_hex: KEY_A }),
  JSON.stringify({ schema_version: 1, key_id: payloadKeyId(KEY_B), key_hex: KEY_A }),
  JSON.stringify({ schema_version: 1, key_id: payloadKeyId(KEY_A), key_hex: KEY_A, extra: true }),
])('rejects invalid setup before storage mutation (%#)', async text => {
  await expect(importPayloadSetupKey(text)).rejects.toThrow('Setup key could not be imported');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

it('does not fall back to the current key when a requested historical key is missing', async () => {
  store.set(ACTIVE, KEY_A);
  await expect(resolvePayloadKeyHex(payloadKeyId(KEY_B))).rejects.toThrow('Data key unavailable');
});

it('rejects a corrupted retained entry rather than trying the active key', async () => {
  store.set(ACTIVE, KEY_A);
  store.set(slot(KEY_A), KEY_B);
  await expect(resolvePayloadKeyHex(payloadKeyId(KEY_A))).rejects.toThrow('Data key unavailable');
});

it('rejects a key-ID collision without overwriting retained material', async () => {
  store.set(slot(KEY_A), KEY_B);
  await expect(importPayloadSetupKey(setup(KEY_A))).rejects.toThrow('Setup key could not be imported');
  expect(store.get(slot(KEY_A))).toBe(KEY_B);
  expect(store.has(ACTIVE)).toBe(false);
});

it('keeps the previous active key when interrupted before new key retention completes', async () => {
  store.set(ACTIVE, KEY_A);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name: string, value: string) => {
    if (name === slot(KEY_B)) throw new Error(`native failure ${KEY_B}`);
    store.set(name, value);
  });
  await expect(importPayloadSetupKey(setup(KEY_B))).rejects.toThrow(/^Setup key could not be imported\./);
  expect(store.get(ACTIVE)).toBe(KEY_A);
  expect(store.get(slot(KEY_A))).toBe(KEY_A);
});

it('detects silent storage failures and does not promote the unverified key', async () => {
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  await expect(importPayloadSetupKey(setup(KEY_A))).rejects.toThrow('Setup key could not be imported');
  expect(store.has(ACTIVE)).toBe(false);
});

it('does not expose native exceptions containing key material', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error(KEY_A));
  await expect(resolvePayloadKeyHex()).rejects.toThrow(/^Data key unavailable\./);
  await expect(importPayloadSetupKey(setup(KEY_A))).rejects.toThrow(/^Setup key could not be imported\./);
});
