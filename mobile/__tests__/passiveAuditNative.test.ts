import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import type { AppState } from '../src/data/storeTypes';
import '../src/background/tasks';
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

it('reports native read/write failures and retries dirty completed work without exposing storage details', async () => {
  jest.resetModules();
  mockStorage.clear();
  const now = jest.spyOn(Date, 'now').mockReturnValue(FIXTURE_NOW_MS);
  const runtime = jest.requireActual<typeof import('../src/lib/passiveAudit')>('../src/lib/passiveAudit');
  jest.requireActual('../src/background/tasks');
  const storage = jest.requireMock('@react-native-async-storage/async-storage') as { getItem: jest.Mock; setItem: jest.Mock };
  const native = jest.requireMock('expo-task-manager') as { defineTask: jest.Mock };
  const task = native.defineTask.mock.calls.find(([name]) => name === PASSIVE_AUDIT_TASK)![1];
  const record = newPassiveAuditRecord(makeHealthyDataFixture().snapshot, runtime.passiveAuditAppBuild(), FIXTURE_NOW_MS)!;
  mockStorage.set('ar-passive-audit-v1', serializePassiveAuditRecord(record)!);
  try {
    storage.getItem.mockRejectedValueOnce(new Error('Private filesystem location'));
    expect(await task()).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    expect(runtime.getPassiveAuditStatus()).toMatchObject({ completed: 0, busy: false,
      lastError: expect.stringContaining('Automatic retry is pending') });
    expect(runtime.getPassiveAuditStatus().lastError).not.toContain('Private');

    storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
    expect(await task()).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    expect(runtime.getPassiveAuditStatus().completed).toBe(8);
    expect(JSON.parse(mockStorage.get('ar-passive-audit-v1')!).entries).toEqual({});

    // All headless checks are already complete; retry must still persist them.
    expect(await task()).toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(runtime.getPassiveAuditStatus()).toMatchObject({ completed: 8, busy: false, lastError: null });
    expect(Object.keys(JSON.parse(mockStorage.get('ar-passive-audit-v1')!).entries)).toHaveLength(8);
    expect(storage.getItem.mock.calls.filter(([key]) => key === 'ar-passive-audit-v1')).toHaveLength(2);

    const links = jest.requireActual<typeof import('../src/lib/passiveAuditLinks')>('../src/lib/passiveAuditLinks');
    const flush = jest.spyOn(links, 'flushPassiveLinks').mockRejectedValueOnce(new Error('Checkpoint unavailable'));
    expect(await task()).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    expect(runtime.getPassiveAuditStatus().lastError).toContain('Automatic retry is pending');
    flush.mockRestore();
    expect(await task()).toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(runtime.getPassiveAuditStatus().lastError).toBeNull();
  } finally { now.mockRestore(); }
});

it.each([false, true])('keeps compact native work independent of a refresh starting during storage load (native=%s)', async native => {
  jest.resetModules(); mockStorage.clear();
  const now = jest.spyOn(Date, 'now').mockReturnValue(FIXTURE_NOW_MS);
  const network = jest.spyOn(globalThis, 'fetch');
  const handler = jest.spyOn(jest.requireActual('react-native').Linking, 'canOpenURL').mockResolvedValue(true);
  const runtime = jest.requireActual<typeof import('../src/lib/passiveAudit')>('../src/lib/passiveAudit');
  const storage = jest.requireMock('@react-native-async-storage/async-storage') as { getItem: jest.Mock; setItem: jest.Mock };
  const appBuild = runtime.passiveAuditAppBuild();
  const record = newPassiveAuditRecord(makeHealthyDataFixture().snapshot, appBuild, FIXTURE_NOW_MS)!;
  const serialized = serializePassiveAuditRecord(record)!;
  mockStorage.set('ar-passive-audit-v1', serialized);
  mockStorage.set('ar-passive-links-v1', JSON.stringify({ schema: 1, appBuild, revision: 'verified-prior-publication',
    createdAt: FIXTURE_NOW_MS, cursor: 0, entries: [], inventoryComplete: true,
    pending: [{ url: 'https://bank.com.au/product/0', purpose: 'lender_source', label: 'Product overview' }] }));
  let releaseRead!: (value: string) => void;
  storage.getItem.mockImplementationOnce(() => new Promise<string>(resolve => { releaseRead = resolve; }));
  try {
    const completion = runtime.runPassiveAuditSlice(native);
    // Expo dispatches the daily callback while passive AsyncStorage is pending.
    // Its lazy store import installs the getter; refresh can then stay busy or
    // fail without reaching the daily callback's success-only passive retry.
    const busy = Object.defineProperties({ refreshing: true }, Object.fromEntries(
      ['core', 'manifest', 'details'].map(key => [key, { get() { throw new Error('Busy live inputs must not be scanned'); } }]),
    )) as AppState;
    runtime.configurePassiveAuditState(() => busy);
    releaseRead(serialized);
    expect(await completion).toBe(true);
    expect(Object.keys(JSON.parse(mockStorage.get('ar-passive-audit-v1')!).entries)).toHaveLength(native ? 8 : 0);
    expect(JSON.parse(mockStorage.get('ar-passive-links-v1')!).cursor).toBe(native ? 1 : 0);
    expect(runtime.getPassiveAuditStatus().lastError).toBeNull();
    expect(network).not.toHaveBeenCalled();
  } finally { now.mockRestore(); network.mockRestore(); handler.mockRestore(); }
});
