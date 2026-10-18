import * as SecureStore from 'expo-secure-store';
import type { DebugLogUploadReceipt } from './debugLog';
import { SECURE_STORE_KEYS } from './secureStoreKey';

const KEY = SECURE_STORE_KEYS.debugLogUploadRecoveryReceipt;
let writes: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation); writes = result.catch(() => {}); return result;
}
/** Separate small SecureStore slot: never put deletion capabilities in AsyncStorage or a plain file. */
export async function loadDebugLogUploadRecoveryReceipt(): Promise<DebugLogUploadReceipt | null> {
  await writes;
  const raw = await SecureStore.getItemAsync(KEY);
  if (raw == null) return null;
  const receipt = JSON.parse(raw) as DebugLogUploadReceipt;
  const url = new URL(receipt.url);
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || receipt.schemaVersion !== 1 || url.protocol !== 'https:' || url.username || url.password ||
    !['https://paste.rs', 'https://paste.c-net.org'].includes(url.origin) || receipt.provider !== url.hostname ||
    (typeof receipt.createdAt !== 'string' || !Number.isFinite(Date.parse(receipt.createdAt))) ||
    (receipt.provider === 'paste.c-net.org' && (typeof receipt.deleteKey !== 'string' || !receipt.deleteKey)) ||
    (receipt.deleteKey != null && typeof receipt.deleteKey !== 'string') ||
    (receipt.verified != null && typeof receipt.verified !== 'boolean') ||
    (receipt.contentSha256 != null && !/^[a-f0-9]{64}$/.test(receipt.contentSha256))) {
    throw new Error('The saved recovery deletion receipt is invalid.');
  }
  return receipt;
}
export async function saveDebugLogUploadRecoveryReceipt(receipt: DebugLogUploadReceipt): Promise<void> {
  return serialize(async () => {
    // One outstanding recovery must be deleted before another upload starts.
    const previous = await SecureStore.getItemAsync(KEY);
    if (previous && (JSON.parse(previous) as DebugLogUploadReceipt).url !== receipt.url) {
      throw new Error('An earlier recovery deletion receipt must be retained.');
    }
    const value = JSON.stringify(receipt);
    await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    if (await SecureStore.getItemAsync(KEY) !== value) throw new Error('The recovery deletion receipt could not be verified.');
  });
}
export async function removeDebugLogUploadRecoveryReceipt(url: string): Promise<void> {
  return serialize(async () => {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw && (JSON.parse(raw) as DebugLogUploadReceipt).url === url) await SecureStore.deleteItemAsync(KEY);
  });
}
