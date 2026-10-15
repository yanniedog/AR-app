import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';

import Settings from '../app/settings';
import { AccountSecurityRows } from '../src/components/settings/AccountSecurityRows';
import { DEFAULT_PREFS, CURRENT_PRIVACY_CHOICE_VERSION, type Prefs } from '../src/data/storeTypes';
import { ensurePermissions } from '../src/data/notifications';
import { authenticateBiometric, biometricsAvailable } from '../src/lib/appLock';
import { setCrashReportsEnabled } from '../src/lib/observability';

const mockSetPref = jest.fn();
const mockSetPrefs = jest.fn();
const mockStoreListeners = new Set<() => void>();
const mockStore = { prefs: { ...DEFAULT_PREFS }, hydrated: true, core: null,
  source: 'cache', subscriptions: [], lastCheckedAt: null,
  setPref: mockSetPref, setPrefs: mockSetPrefs };
const mockRouter = { push: jest.fn(), setParams: jest.fn() };

jest.mock('../src/data/store', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useStore: (selector: (state: unknown) => unknown) => React.useSyncExternalStore(listener => {
    mockStoreListeners.add(listener);
    return () => { mockStoreListeners.delete(listener); };
  }, () => selector(mockStore)) };
});
jest.mock('../src/data/notifications', () => ({ ensurePermissions: jest.fn() }));
jest.mock('../src/lib/appLock', () => ({ authenticateBiometric: jest.fn(), biometricsAvailable: jest.fn() }));
jest.mock('../src/lib/observability', () => ({ setCrashReportsEnabled: jest.fn() }));
jest.mock('../src/lib/performanceAudit', () => ({ restorePerformanceAuditPreferences: jest.fn() }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useUndoSnackbar', () => ({ useUndoSnackbar: () => ({ snack: null, showUndo: jest.fn(), undo: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('../src/components/icons/AppIcon', () => 'AppIcon');
jest.mock('../src/components/controls', () => ({ SegmentedControl: 'SegmentedControl' }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen', ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/Snackbar', () => ({ UndoSnackbar: 'UndoSnackbar' }));
jest.mock('../src/components/SubscriptionRow', () => ({ SubscriptionRow: 'SubscriptionRow' }));
jest.mock('../src/components/settings/AppUpdateSection', () => ({ AppUpdateSection: 'AppUpdateSection' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Chip: 'Chip', Row: 'Row' }));
jest.mock('../src/components/settings/settingsUi', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { InfoRow: 'InfoRow', InterestOrderRow: 'InterestOrderRow', Label: 'Label',
    Section: 'Section', SettingsGap: 'SettingsGap', ToggleRow: 'ToggleRow',
    DisclosureGroup: ({ children, open, ...props }: any) => React.createElement('DisclosureGroup', { open, ...props }, open ? children : null) };
});

type Node = { props: Record<string, any>; findByProps: (props: Record<string, unknown>) => Node };
type Renderer = ReactTestRenderer & { root: Node; toJSON: () => unknown };
let tree: Renderer | undefined;
const row = (label: string) => tree!.root.findByProps({ label });
const button = (title: string) => tree!.root.findByProps({ title });
const mountSettings = () => act(() => { tree = TestRenderer.create(<Settings />) as Renderer; });
const openReporting = () => act(() => button('Optional reporting').props.onOpenChange(true));
const mountLock = (value: boolean, onChange: (value: boolean) => void) => act(() => {
  tree = TestRenderer.create(<AccountSecurityRows appLockEnabled={value} onAppLockChange={onChange} />) as Renderer;
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.prefs = { ...DEFAULT_PREFS, interests: [...DEFAULT_PREFS.interests] };
  mockSetPref.mockImplementation((key: keyof Prefs, value: Prefs[keyof Prefs]) => {
    mockStore.prefs = { ...mockStore.prefs, [key]: value };
    [...mockStoreListeners].forEach(listener => listener());
  });
  mockSetPrefs.mockImplementation((patch: Partial<Prefs>) => {
    mockStore.prefs = { ...mockStore.prefs, ...patch };
    [...mockStoreListeners].forEach(listener => listener());
  });
  jest.mocked(ensurePermissions).mockResolvedValue(true);
  jest.mocked(biometricsAvailable).mockResolvedValue(true);
  jest.mocked(authenticateBiometric).mockResolvedValue(true);
  jest.mocked(setCrashReportsEnabled).mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; jest.restoreAllMocks(); });

test('two immediate app-lock changes start one availability check and one authenticated write', async () => {
  const availability = deferred<boolean>();
  const authentication = deferred<boolean>();
  jest.mocked(biometricsAvailable).mockReturnValueOnce(availability.promise);
  jest.mocked(authenticateBiometric).mockReturnValueOnce(authentication.promise);
  const write = jest.fn();
  mountLock(false, write);
  const change = row('App lock').props.onChange;
  act(() => { change(true); change(false); });
  expect(biometricsAvailable).toHaveBeenCalledTimes(1);
  expect(authenticateBiometric).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(row('App lock').props).toMatchObject({ value: false, disabled: true });
  await act(async () => availability.resolve(true));
  expect(authenticateBiometric).toHaveBeenCalledTimes(1);
  expect(authenticateBiometric).toHaveBeenCalledWith('Confirm app lock');
  expect(write).not.toHaveBeenCalled();
  await act(async () => authentication.resolve(true));
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(true);
  expect(row('App lock').props.disabled).toBe(false);
});

test.each(['cancelled', 'failed'])('app-lock %s confirmation retains its value and releases the lock for retry', async outcome => {
  const write = jest.fn();
  if (outcome === 'cancelled') jest.mocked(authenticateBiometric).mockResolvedValueOnce(false);
  else jest.mocked(authenticateBiometric).mockRejectedValueOnce(new Error('private-native-error'));
  mountLock(true, write);
  await act(async () => row('App lock').props.onChange(false));
  expect(biometricsAvailable).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(row('App lock').props).toMatchObject({ value: true, disabled: false });
  expect(JSON.stringify(jest.mocked(Alert.alert).mock.calls)).not.toContain('private-native-error');
  await act(async () => row('App lock').props.onChange(false));
  expect(authenticateBiometric).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(false);
});

test('unavailable device credentials do not authenticate or change app lock and allow retry', async () => {
  jest.mocked(biometricsAvailable).mockResolvedValueOnce(false);
  const write = jest.fn();
  mountLock(false, write);
  await act(async () => row('App lock').props.onChange(true));
  expect(Alert.alert).toHaveBeenCalledWith('Device lock required', 'Device settings');
  expect(authenticateBiometric).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(row('App lock').props).toMatchObject({ value: false, disabled: false });
  await act(async () => row('App lock').props.onChange(true));
  expect(write).toHaveBeenCalledWith(true);
});

test.each(['denied', 'failed'])('notification permission %s remains unconfirmed and releases pending state for retry', async outcome => {
  const permission = deferred<boolean>();
  jest.mocked(ensurePermissions).mockReturnValueOnce(permission.promise);
  mountSettings();
  const change = row('Rate-change alerts').props.onChange;
  act(() => { void change(true); void change(false); });
  expect(ensurePermissions).toHaveBeenCalledTimes(1);
  expect(mockSetPref).not.toHaveBeenCalled();
  expect(row('Rate-change alerts').props).toMatchObject({ value: false, disabled: true });
  await act(async () => {
    if (outcome === 'denied') permission.resolve(false);
    else permission.reject(new Error('private-notification-error'));
  });
  expect(mockStore.prefs.notificationsEnabled).toBe(false);
  expect(mockSetPref).not.toHaveBeenCalled();
  expect(row('Rate-change alerts').props).toMatchObject({ value: false, disabled: false });
  expect(JSON.stringify(jest.mocked(Alert.alert).mock.calls)).not.toContain('private-notification-error');
  await act(async () => row('Rate-change alerts').props.onChange(true));
  expect(ensurePermissions).toHaveBeenCalledTimes(2);
  expect(mockSetPref).toHaveBeenCalledTimes(1);
  expect(mockSetPref).toHaveBeenCalledWith('notificationsEnabled', true);
  expect(row('Rate-change alerts').props).toMatchObject({ value: true, disabled: false });
});

test('two notification-off calls write once without requesting permission', async () => {
  mockStore.prefs.notificationsEnabled = true;
  mountSettings();
  const change = row('Rate-change alerts').props.onChange;
  await act(async () => { void change(false); void change(false); });
  expect(ensurePermissions).not.toHaveBeenCalled();
  expect(mockSetPref).toHaveBeenCalledTimes(1);
  expect(mockSetPref).toHaveBeenCalledWith('notificationsEnabled', false);
  expect(row('Rate-change alerts').props).toMatchObject({ value: false, disabled: false });
});

test('Allow, Decline and the crash toggle share one native-confirmation lock and failure leaves consent unchanged', async () => {
  const confirmation = deferred<void>();
  jest.mocked(setCrashReportsEnabled).mockReturnValueOnce(confirmation.promise);
  mountSettings(); openReporting();
  const allow = button('Allow').props.onPress;
  const decline = button('Decline').props.onPress;
  const toggle = row('Crash reports').props.onChange;
  act(() => { void allow(); void decline(); void toggle(false); });
  expect(setCrashReportsEnabled).toHaveBeenCalledTimes(1);
  expect(setCrashReportsEnabled).toHaveBeenCalledWith(true);
  expect(mockSetPrefs).not.toHaveBeenCalled();
  expect(mockStore.prefs.privacyChoiceVersion).toBe(0);
  expect(row('Crash reports').props).toMatchObject({ value: false, disabled: true });
  expect(button('Allow').props.disabled).toBe(true);
  expect(button('Decline').props.disabled).toBe(true);
  await act(async () => confirmation.reject(new Error('private-crash-native-error')));
  expect(mockSetPrefs).not.toHaveBeenCalled();
  expect(mockStore.prefs.privacyChoiceVersion).toBe(0);
  expect(mockStore.prefs.crashReportsEnabled).toBe(false);
  expect(row('Crash reports').props.disabled).toBe(false);
  expect(button('Allow').props.disabled).toBe(false);
  expect(button('Decline').props.disabled).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Crash reports unchanged', 'Native state unconfirmed');
  expect(JSON.stringify(jest.mocked(Alert.alert).mock.calls)).not.toContain('private-crash-native-error');
  await act(async () => button('Decline').props.onPress());
  expect(setCrashReportsEnabled).toHaveBeenCalledTimes(2);
  expect(setCrashReportsEnabled).toHaveBeenLastCalledWith(false);
  expect(mockSetPrefs).toHaveBeenCalledTimes(1);
  expect(mockSetPrefs).toHaveBeenCalledWith({ crashReportsEnabled: false, sessionReplayEnabled: false,
    privacyChoiceVersion: CURRENT_PRIVACY_CHOICE_VERSION });
  expect(row('Crash reports').props).toMatchObject({ value: false, disabled: false });
});

test('successful Allow records consent once only after the native result', async () => {
  const confirmation = deferred<void>();
  jest.mocked(setCrashReportsEnabled).mockReturnValueOnce(confirmation.promise);
  mountSettings(); openReporting();
  const allow = button('Allow').props.onPress;
  act(() => { void allow(); void allow(); });
  expect(mockStore.prefs.privacyChoiceVersion).toBe(0);
  expect(mockStore.prefs.crashReportsEnabled).toBe(false);
  expect(mockSetPrefs).not.toHaveBeenCalled();
  await act(async () => confirmation.resolve());
  expect(setCrashReportsEnabled).toHaveBeenCalledTimes(1);
  expect(mockSetPrefs).toHaveBeenCalledTimes(1);
  expect(mockStore.prefs).toMatchObject({ crashReportsEnabled: true, sessionReplayEnabled: false,
    privacyChoiceVersion: CURRENT_PRIVACY_CHOICE_VERSION });
  expect(row('Crash reports').props).toMatchObject({ value: true, disabled: false });
  expect(row('Audit log upload').props.value).toBe('Optional');
  expect(row('Paste visibility').props.value).toBe('Public');
});

test('a failed crash opt-out preserves the existing consent and can be retried', async () => {
  mockStore.prefs.crashReportsEnabled = true;
  mockStore.prefs.privacyChoiceVersion = CURRENT_PRIVACY_CHOICE_VERSION;
  jest.mocked(setCrashReportsEnabled).mockRejectedValueOnce(new Error('private-opt-out-error'));
  mountSettings(); openReporting();
  await act(async () => row('Crash reports').props.onChange(false));
  expect(mockSetPrefs).not.toHaveBeenCalled();
  expect(mockStore.prefs).toMatchObject({ crashReportsEnabled: true, privacyChoiceVersion: CURRENT_PRIVACY_CHOICE_VERSION });
  expect(row('Crash reports').props).toMatchObject({ value: true, disabled: false });
  await act(async () => row('Crash reports').props.onChange(false));
  expect(mockSetPrefs).toHaveBeenCalledTimes(1);
  expect(row('Crash reports').props).toMatchObject({ value: false, disabled: false });
});
