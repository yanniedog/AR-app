import { Platform } from 'react-native';
import { loadNativeDeps } from '../src/lib/observabilityLoader';
import { loadNativeDeps as loadWebDeps } from '../src/lib/observabilityLoader.web';

const mockInstance = { isCrashlyticsCollectionEnabled: false };
const mockGet = jest.fn(() => mockInstance);
const mockEnabled = jest.fn(async (_instance: unknown, enabled: boolean) => {
  mockInstance.isCrashlyticsCollectionEnabled = enabled;
});
const mockLog = jest.fn();
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: mockGet, setCrashlyticsCollectionEnabled: mockEnabled,
  log: mockLog, recordError: jest.fn(), setAttribute: jest.fn(async () => {}),
}));

const originalOS = Platform.OS;
afterEach(() => { Platform.OS = originalOS; jest.clearAllMocks(); });

it('keeps the web entry unavailable without initializing the native SDK', () => {
  expect(loadWebDeps()).toBeNull();
  expect(mockGet).not.toHaveBeenCalled();
});

it('preserves lazy native instance binding and live consent readback', async () => {
  Platform.OS = 'android';
  const api = loadNativeDeps()!.crashlytics();
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(api.isCrashlyticsCollectionEnabled).toBe(false);
  await api.setCrashlyticsCollectionEnabled(true);
  expect(api.isCrashlyticsCollectionEnabled).toBe(true);
  expect(mockEnabled).toHaveBeenCalledWith(mockInstance, true);
  api.log('category only');
  expect(mockLog).toHaveBeenCalledWith(mockInstance, 'category only');
});

it('retains fail-closed behavior when the native bridge cannot initialize', () => {
  Platform.OS = 'ios';
  mockGet.mockImplementationOnce(() => { throw new Error('unavailable'); });
  expect(loadNativeDeps()).toBeNull();
});
