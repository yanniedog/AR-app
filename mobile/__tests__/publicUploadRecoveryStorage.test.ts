import * as SecureStore from 'expo-secure-store';
const mockSecureValues = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'locked-device-only',
  getItemAsync: jest.fn(async (key: string) => mockSecureValues.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecureValues.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecureValues.delete(key); }),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SECURE_STORE_KEYS } from '../src/lib/secureStoreKey';
import { saveDebugLogUploadRecoveryReceipt } from '../src/lib/debugLogUploadRecovery';
import { beginPublicReportUploadAttemptsClear, clearPublicReportUploadAttempts, publicReportUploadAttempt, publicReportUploadUncertain, recordPublicReportUploadAttempt, publicReportUploadAttemptEpoch } from '../src/lib/publicReportUploadAttempt';

it('reopens securely stored deletion access through the actual Debug log receipt loader and removes it after host deletion', async () => {
  const receipt = { schemaVersion: 1 as const, url: 'https://paste.c-net.org/recovery', provider: 'paste.c-net.org' as const,
    deleteKey: 'private-delete-capability', createdAt: '2026-10-18T00:00:00Z', contentSha256: 'd'.repeat(64) };
  await saveDebugLogUploadRecoveryReceipt(receipt);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_STORE_KEYS.debugLogUploadRecoveryReceipt, JSON.stringify(receipt),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  jest.resetModules();
  const log = require('../src/lib/debugLog') as typeof import('../src/lib/debugLog');
  const journal = require('../src/lib/publicReportUploadAttempt') as typeof import('../src/lib/publicReportUploadAttempt');
  await journal.recordPublicReportUploadAttempt(receipt.contentSha256, 'pending');
  expect(await log.loadDebugLogUploadReceipts()).toContainEqual(receipt);
  const fetcher = jest.fn(async () => ({ ok: true, status: 204 })) as unknown as typeof fetch;
  await log.deleteDebugLogUploadAndReceipt(receipt, fetcher);
  expect(await log.loadDebugLogUploadReceipts()).toEqual([]);
  expect(await SecureStore.getItemAsync(SECURE_STORE_KEYS.debugLogUploadRecoveryReceipt)).toBeNull();
  expect(await journal.publicReportUploadAttempt(receipt.contentSha256)).toBeNull();
});

it('Clear recovers an unreadable intent journal without allowing an uncertain upload before reset', async () => {
  const hash = 'e'.repeat(64);
  await AsyncStorage.setItem('@ar/public-report-upload-attempts-v1', '{invalid');
  await expect(publicReportUploadAttempt(hash)).rejects.toThrow();
  await clearPublicReportUploadAttempts();
  await recordPublicReportUploadAttempt(hash, 'pending');
  expect(await publicReportUploadAttempt(hash)).toBe('pending');
  await clearPublicReportUploadAttempts();
});
it('Clear removes pending and failed hashes after queued writes and permits a fresh attempt', async () => {
  const one = 'a'.repeat(64), two = 'b'.repeat(64);
  await recordPublicReportUploadAttempt(one, 'pending');
  const stale = recordPublicReportUploadAttempt(two, 'failed');
  await clearPublicReportUploadAttempts(); await stale;
  expect(await publicReportUploadAttempt(one)).toBeNull();
  expect(await publicReportUploadAttempt(two)).toBeNull();
  expect(await publicReportUploadUncertain(one)).toBe(false);
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@ar/public-report-upload-attempts-v1');
  await recordPublicReportUploadAttempt(one, 'pending');
  expect(await publicReportUploadUncertain(one)).toBe(true);
  await clearPublicReportUploadAttempts();
});

it('whole Clear blocks overlapping writes and invalidates late callbacks from an older upload', async () => {
  const hash = 'c'.repeat(64), before = publicReportUploadAttemptEpoch();
  await recordPublicReportUploadAttempt(hash, 'pending', before);
  const finish = beginPublicReportUploadAttemptsClear();
  await recordPublicReportUploadAttempt(hash, 'failed');
  await finish();
  await recordPublicReportUploadAttempt(hash, 'failed', before);
  expect(await publicReportUploadAttempt(hash)).toBeNull();
  await recordPublicReportUploadAttempt(hash, 'pending');
  expect(await publicReportUploadAttempt(hash)).toBe('pending');
  await clearPublicReportUploadAttempts();
});
