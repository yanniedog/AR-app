import { FIXTURE_NOW_MS, makeHealthyDataFixture } from '../__fixtures__/appHealth';
import { newPassiveAuditRecord, serializePassiveAuditRecord } from '../src/lib/passiveAuditCache';
import { BACKGROUND_TASK, PASSIVE_AUDIT_TASK } from '../src/background/taskNames';

let tasks: Map<string, () => Promise<number>>;
let order: string[];
let storage: Map<string, string>;
let storeImports: number;
let passiveImports: number;
const dailyRefresh = jest.fn(async () => 1);

beforeEach(() => {
  jest.resetModules();
  tasks = new Map(); order = []; storage = new Map();
  storeImports = 0; passiveImports = 0; dailyRefresh.mockReset().mockResolvedValue(1);
  jest.doMock('@expo/metro-runtime', () => { order.push('metro'); return {}; });
  jest.doMock('expo-task-manager', () => ({
    isTaskDefined: (name: string) => tasks.has(name),
    defineTask: (name: string, task: () => Promise<number>) => { order.push(name); tasks.set(name, task); },
  }));
  jest.doMock('expo-router/entry', () => {
    // The real Router only registers App in a cold JS host; no route is mounted.
    order.push('router');
    expect([...tasks.keys()]).toEqual([PASSIVE_AUDIT_TASK, BACKGROUND_TASK]);
    return {};
  });
  jest.doMock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { storage.set(key, value); }),
  }));
  jest.doMock('../src/data/store', () => {
    storeImports++;
    return { runScheduledBackgroundRefresh: dailyRefresh };
  });
  jest.doMock('../src/lib/passiveAudit', () => {
    passiveImports++;
    return jest.requireActual('../src/lib/passiveAudit');
  });
});

function enterProductionBundle() {
  const { main } = jest.requireActual('../package.json');
  expect(main).toBe('index.ts');
  jest.requireActual(`../${main}`);
}

it('defines both production tasks before Router without mounting React or loading either worker', () => {
  enterProductionBundle();
  expect(order).toEqual(['metro', PASSIVE_AUDIT_TASK, BACKGROUND_TASK, 'router']);
  expect(storeImports).toBe(0);
  expect(passiveImports).toBe(0);
  expect(dailyRefresh).not.toHaveBeenCalled();
});

it('preserves an existing task definition when entry registration is repeated', () => {
  const existing = jest.fn(async () => 1);
  tasks.set(PASSIVE_AUDIT_TASK, existing);
  enterProductionBundle();
  expect(tasks.get(PASSIVE_AUDIT_TASK)).toBe(existing);
  expect(order).toEqual(['metro', BACKGROUND_TASK, 'router']);
  expect(storeImports).toBe(0);
  expect(passiveImports).toBe(0);
});

it('runs the real cold passive callback from persisted metadata without store hydration or network', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(FIXTURE_NOW_MS);
  const network = jest.spyOn(globalThis, 'fetch');
  try {
    const application = jest.requireMock('expo-application');
    const build = `${application.nativeApplicationVersion ?? 'unknown'}:${application.nativeBuildVersion ?? 'unknown'}`;
    const record = newPassiveAuditRecord(makeHealthyDataFixture().snapshot, build, FIXTURE_NOW_MS)!;
    storage.set('ar-passive-audit-v1', serializePassiveAuditRecord(record)!);
    enterProductionBundle();
    expect(await tasks.get(PASSIVE_AUDIT_TASK)!()).toBe(1);
    expect(passiveImports).toBe(1);
    expect(storeImports).toBe(0);
    expect(dailyRefresh).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(Object.keys(JSON.parse(storage.get('ar-passive-audit-v1')!).entries)).toHaveLength(8);
  } finally { now.mockRestore(); network.mockRestore(); }
});

it('loads scheduled refresh only for its own callback and returns Failed if runtime execution rejects', async () => {
  enterProductionBundle();
  expect(storeImports).toBe(0);
  expect(await tasks.get(BACKGROUND_TASK)!()).toBe(1);
  expect(storeImports).toBe(1);
  expect(passiveImports).toBe(0);
  expect(dailyRefresh).toHaveBeenCalledTimes(1);
  dailyRefresh.mockRejectedValueOnce(new Error('Runtime initialization failed'));
  expect(await tasks.get(BACKGROUND_TASK)!()).toBe(2);
});
