import * as SecureStore from 'expo-secure-store';

import { payloadKeyId, transportKeyId } from './payloadCrypto';
import { defineSecureStoreKey, SECURE_STORE_KEYS } from './secureStoreKey';

const STORE_KEY = SECURE_STORE_KEYS.payloadDecryptionKey;
const KEY = /^[a-fA-F0-9]{64}$/;
const ID = /^(?:[a-f0-9]{8}|[a-f0-9]{32})$/;
let importTail: Promise<unknown> = Promise.resolve();

function checkedKey(value: unknown): string {
  if (typeof value !== 'string' || !KEY.test(value)) throw new Error('Invalid data key.');
  return value.toLowerCase();
}

function retainedKey(id: string) {
  if (!ID.test(id)) throw new Error('Invalid data key ID.');
  return defineSecureStoreKey(`${STORE_KEY}.${id}`);
}

function matchesId(key: string, id: string): boolean {
  return id === transportKeyId(key) || id === payloadKeyId(key);
}

/** Never consult Expo config or bundled values. Keystore failures fail closed. */
export async function resolvePayloadKeyHex(expectedId?: string): Promise<string> {
  try {
    if (expectedId !== undefined) {
      const retained = await SecureStore.getItemAsync(retainedKey(expectedId));
      if (retained !== null) {
        const key = checkedKey(retained);
        if (!matchesId(key, expectedId)) throw new Error('Data key ID mismatch.');
        return key;
      }
    }
    const value = await SecureStore.getItemAsync(STORE_KEY);
    if (value === null) throw new Error('Data key missing.');
    const key = checkedKey(value);
    if (expectedId !== undefined && !matchesId(key, expectedId)) throw new Error('Data key missing.');
    return key;
  } catch {
    // Native exceptions and input values must never reach logs or crash reports.
    throw new Error('Data key unavailable. Import the matching setup key in Settings.');
  }
}

async function retain(key: string): Promise<void> {
  for (const id of [transportKeyId(key), payloadKeyId(key)]) await retainAtId(key, id);
}

async function retainAtId(key: string, id: string): Promise<void> {
  const slot = retainedKey(id);
  const existing = await SecureStore.getItemAsync(slot);
  if (existing !== null && checkedKey(existing) !== key) throw new Error('Data key ID collision.');
  await SecureStore.setItemAsync(slot, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (await SecureStore.getItemAsync(slot) !== key) throw new Error('Data key storage verification failed.');
}

/** One private setup document at a time; historical keys are never discarded. */
export function importPayloadSetupKey(text: string): Promise<string> {
  const work = importTail.then(async () => {
    try {
      if (text.length > 1024) throw new Error('Setup key too large.');
      const doc: unknown = JSON.parse(text);
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('Invalid setup key.');
      const item = doc as Record<string, unknown>;
      if (Object.keys(item).sort().join(',') !== 'key_hex,key_id,schema_version' || item.schema_version !== 1) {
        throw new Error('Unsupported setup key.');
      }
      const key = checkedKey(item.key_hex);
      const id = item.key_id;
      if (typeof id !== 'string' || !matchesId(key, id)) throw new Error('Data key ID mismatch.');
      const previous = await SecureStore.getItemAsync(STORE_KEY);
      if (previous !== null) await retain(checkedKey(previous));
      await retain(key);
      await SecureStore.setItemAsync(STORE_KEY, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (await SecureStore.getItemAsync(STORE_KEY) !== key) throw new Error('Data key storage verification failed.');
      return id;
    } catch {
      throw new Error('Setup key could not be imported. Check the document and device secure storage.');
    }
  });
  importTail = work.catch(() => undefined);
  return work;
}
