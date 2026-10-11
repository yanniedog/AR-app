import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { FIXTURE_NOW_MS, makeHealthyDataFixture } from '../__fixtures__/appHealth';
import { newPassiveAuditRecord, serializePassiveAuditRecord } from '../src/lib/passiveAuditCache';
import {
  PASSIVE_AUDIT_TASK, getPassiveAuditStatus, passiveAuditAppBuild,
  registerPassiveAuditBackground, setPassiveAuditPaused,
} from '../src/lib/passiveAudit';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
}));

it('registers a globally defined native worker and resumes cached metadata on a delayed headless wake without network', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(FIXTURE_NOW_MS + 8 * 60 * 60 * 1000);
  const network = jest.spyOn(globalThis, 'fetch');
  const { snapshot } = makeHealthyDataFixture();
  const record = newPassiveAuditRecord(snapshot, passiveAuditAppBuild(), FIXTURE_NOW_MS)!;
  mockStorage.set('ar-passive-audit-v1', serializePassiveAuditRecord(record)!);
  const define = (TaskManager.defineTask as jest.Mock).mock.calls.find(([name]) => name === PASSIVE_AUDIT_TASK);
  expect(define).toBeDefined();
  const result = await define![1]();
  expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
  expect(network).not.toHaveBeenCalled();
  expect(getPassiveAuditStatus().completed).toBe(8);
  expect(JSON.parse(mockStorage.get('ar-passive-audit-v1')!).entries['rate-values']).toBeUndefined();
  expect(await registerPassiveAuditBackground()).toBe(true);
  expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(PASSIVE_AUDIT_TASK, { minimumInterval: 360 });
  expect(getPassiveAuditStatus().nativeStatus).toBe('registered');
  const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
  setPassiveAuditPaused(true);
  await define![1]();
  expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(writes);
  setPassiveAuditPaused(false);
  now.mockRestore(); network.mockRestore();
});
