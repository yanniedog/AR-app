import React from 'react';
import { Alert, AppState, Platform, type AppStateStatus } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import {
  AppUpdateBanner,
  useAppUpdateBanner,
} from '../src/components/AppUpdateBanner';
import {
  checkForAppUpdate,
  ensureApkBackgroundDownload,
  upgradeFromBackgroundDownload,
  type ApkManifest,
} from '../src/lib/appUpdate';
import { IDLE_APK_DOWNLOAD } from '../src/lib/appUpdateDownloadLogic';

type TestNode = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const mockSetPref = jest.fn();
let mockPrefs = {
  dismissedUpdateBuild: null as string | null,
  apkUpdatesWifiOnly: true,
  apkUpdatesAutoDownload: false,
};

jest.mock('../src/data/store', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    prefs: mockPrefs,
    setPref: mockSetPref,
  }),
}));

jest.mock('../src/lib/appUpdate', () => ({
  checkForAppUpdate: jest.fn(),
  ensureApkBackgroundDownload: jest.fn(async () => undefined),
  getApkDownloadPercent: jest.fn(() => null),
  subscribeApkDownload: jest.fn(() => jest.fn()),
  upgradeFromBackgroundDownload: jest.fn(async () => undefined),
}));

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surfaceAlt: '#fff',
      border: '#ddd',
      primary: '#06c',
      textFaint: '#777',
      textMuted: '#555',
    },
  }),
}));

jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Row: 'Row',
}));

const remote: ApkManifest = {
  schema_version: 1,
  version: '1.0.200',
  build_number: '300',
  download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.200/app.apk',
};
const availableResult = {
  status: 'available' as const,
  installed: { version: '1.0.199', buildNumber: '299' },
  remote,
  changelogs: [],
};

function HookProbe() {
  const value = useAppUpdateBanner(true);
  return React.createElement('HookProbe', { visible: value.visible });
}

describe('AppUpdateBanner download consent', () => {
  let appStateListener: ((state: AppStateStatus) => void) | null;
  let platformDescriptor: PropertyDescriptor | undefined;
  let appStateDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    appStateListener = null;
    mockPrefs = {
      dismissedUpdateBuild: null,
      apkUpdatesWifiOnly: true,
      apkUpdatesAutoDownload: false,
    };
    jest.clearAllMocks();
    platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    appStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() } as never;
    });
    jest.mocked(checkForAppUpdate).mockResolvedValue(availableResult);
    jest.mocked(ensureApkBackgroundDownload).mockResolvedValue({ ...IDLE_APK_DOWNLOAD });
    jest.mocked(upgradeFromBackgroundDownload).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    if (appStateDescriptor) Object.defineProperty(AppState, 'currentState', appStateDescriptor);
  });

  it('keeps automatic checks but does not download without standing consent', async () => {
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HookProbe />) as InspectableRenderer;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(checkForAppUpdate).toHaveBeenCalledTimes(1);
    expect(ensureApkBackgroundDownload).not.toHaveBeenCalled();

    await act(async () => {
      appStateListener?.('active');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(checkForAppUpdate).toHaveBeenCalledTimes(2);
    expect(ensureApkBackgroundDownload).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('downloads after an explicitly enabled standing preference', async () => {
    mockPrefs.apkUpdatesAutoDownload = true;
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<HookProbe />) as InspectableRenderer;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ensureApkBackgroundDownload).toHaveBeenCalledWith(remote, { wifiOnly: true });
    act(() => tree.unmount());
  });

  it('requires per-download approval but installs an already verified APK directly', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <AppUpdateBanner
          remote={remote}
          download={{ ...IDLE_APK_DOWNLOAD }}
          onDismiss={jest.fn()}
        />,
      ) as InspectableRenderer;
    });

    act(() => {
      (tree.root.findByProps({ accessibilityLabel: 'Download & install' }).props.onPress as () => void)();
    });
    expect(upgradeFromBackgroundDownload).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] ?? [];
    await act(async () => {
      buttons.find((button) => button.text === 'Download')?.onPress?.();
      await Promise.resolve();
    });
    expect(upgradeFromBackgroundDownload).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.update(
        <AppUpdateBanner
          remote={remote}
          download={{
            ...IDLE_APK_DOWNLOAD,
            phase: 'ready',
            buildNumber: remote.build_number,
            localUri: 'file:///verified.apk',
          }}
          onDismiss={jest.fn()}
        />,
      );
    });
    await act(async () => {
      (tree.root.findByProps({ accessibilityLabel: 'Install verified update' }).props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(upgradeFromBackgroundDownload).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });
});
