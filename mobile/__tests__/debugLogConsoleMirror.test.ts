import { debugLog, resetConsoleMirrorForTests } from '../src/lib/debugLog';

const globals = globalThis as typeof globalThis & { __DEV__?: boolean };
let previousDev: boolean | undefined;
let error: jest.SpyInstance;
let warn: jest.SpyInstance;

beforeEach(() => {
  previousDev = globals.__DEV__;
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  resetConsoleMirrorForTests();
});
afterEach(() => {
  globals.__DEV__ = previousDev;
  error.mockRestore();
  warn.mockRestore();
});

test('release builds mirror warn and error lines to the console, bounded', () => {
  globals.__DEV__ = false;
  debugLog.info('store', 'not mirrored');
  debugLog.warn('store', 'refresh held');
  debugLog.error('store', `refresh failed: ${'x'.repeat(5_000)}`);
  expect(warn).toHaveBeenCalledWith('[AR warn] store: refresh held');
  expect(error).toHaveBeenCalledTimes(1);
  expect((error.mock.calls[0][0] as string).length).toBeLessThan(1_100);
  for (let i = 0; i < 1_000; i++) debugLog.warn('store', `line ${i}`);
  expect(warn.mock.calls.length + error.mock.calls.length).toBe(400);
});

test('development builds do not mirror', () => {
  globals.__DEV__ = true;
  debugLog.error('store', 'refresh failed');
  expect(error).not.toHaveBeenCalled();
});
