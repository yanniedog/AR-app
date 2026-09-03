import * as SecureStore from 'expo-secure-store';

import { defineSecureStoreKey } from '../src/lib/secureStoreKey';
import {
  deleteSecureStoreValue,
  MAX_SECURE_STORE_VALUE_BYTES,
  readSecureStoreValue,
  writeSecureStoreValue,
} from '../src/lib/secureStoreValue';

describe('byte-bounded SecureStore values', () => {
  const key = defineSecureStoreKey('secure-value-test');
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (storageKey) => values.get(storageKey) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (storageKey, value) => {
      values.set(storageKey, value);
    });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });
  });

  it('round-trips large Unicode values without any write crossing the safe byte bound', async () => {
    const original = `${'financial-input-'.repeat(260)}${'🦘'.repeat(300)}`;
    await writeSecureStoreValue(key, original);

    for (const [, value] of jest.mocked(SecureStore.setItemAsync).mock.calls) {
      expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(MAX_SECURE_STORE_VALUE_BYTES);
    }
    await expect(readSecureStoreValue(key)).resolves.toBe(original);
  });

  it('keeps direct legacy values readable until the next atomic write', async () => {
    values.set(key, '{"legacy":true}');
    await expect(readSecureStoreValue(key)).resolves.toBe('{"legacy":true}');
  });

  it('rejects an incomplete committed generation', async () => {
    values.set(key, JSON.stringify({
      kind: 'ar.secure-value',
      schemaVersion: 1,
      generation: 'missing',
      chunks: 1,
    }));
    await expect(readSecureStoreValue(key)).rejects.toThrow('incomplete');
  });

  it('deletes the manifest and every referenced chunk', async () => {
    await writeSecureStoreValue(key, 'private-value'.repeat(400));
    await deleteSecureStoreValue(key);
    expect([...values.keys()].filter((item) => item === key || item.startsWith(`${key}.chunk.`)))
      .toEqual([]);
  });

  it('commits deletion before best-effort cleanup of encrypted chunks', async () => {
    await writeSecureStoreValue(key, 'private-value'.repeat(400));
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (storageKey) => {
      if (storageKey === key) values.delete(storageKey);
      else throw new Error('simulated cleanup interruption');
    });

    await expect(deleteSecureStoreValue(key)).resolves.toBeUndefined();
    await expect(readSecureStoreValue(key)).resolves.toBeNull();
  });
});
