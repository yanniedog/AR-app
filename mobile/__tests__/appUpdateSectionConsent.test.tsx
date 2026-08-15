import React from 'react';
import { Alert, Platform } from 'react-native';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { AppUpdateSection } from '../src/components/settings/AppUpdateSection';
import {
  checkForAppUpdate,
  ensureApkBackgroundDownload,
  upgradeFromBackgroundDownload,
  type ApkManifest,
} from '../src/lib/appUpdate';

type TestNode = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

const mockSetPref = jest.fn();
let mockPrefs = { apkUpdatesWifiOnly: true, apkUpdatesAutoDownload: false };

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
  getInstalledAppInfo: jest.fn(() => ({ version: '1.0.199', buildNumber: '299' })),
  subscribeApkDownload: jest.fn(() => jest.fn()),
  upgradeFromBackgroundDownload: jest.fn(async () => undefined),
}));

jest.mock('../src/components/ExternalLinkConfirmation', () => ({
  useTrustedExternalUrl: () => ({ requestExternalUrl: jest.fn() }),
}));

jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Button: 'Button',
  Row: 'Row',
}));

jest.mock('../src/components/settings/settingsUi', () => ({
  DisclosureGroup: 'DisclosureGroup',
  InfoRow: 'InfoRow',
  Section: 'Section',
  SettingsGap: 'SettingsGap',
  ToggleRow: 'ToggleRow',
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

describe('AppUpdateSection consent and manual refresh', () => {
  let platformDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrefs = { apkUpdatesWifiOnly: true, apkUpdatesAutoDownload: false };
    platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(checkForAppUpdate).mockResolvedValue(availableResult);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
  });

  it('uses cache for the automatic check and bypasses it for the manual check', async () => {
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<AppUpdateSection />) as InspectableRenderer;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(checkForAppUpdate).toHaveBeenNthCalledWith(1, { force: false });
    expect(ensureApkBackgroundDownload).not.toHaveBeenCalled();

    await act(async () => {
      (tree.root.findByProps({ title: 'Check for update' }).props.onPress as () => void)();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(checkForAppUpdate).toHaveBeenNthCalledWith(2, { force: true });
    expect(ensureApkBackgroundDownload).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('asks before a per-release download when standing consent is off', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(<AppUpdateSection />) as InspectableRenderer;
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      (tree.root.findByProps({ title: 'Download & install' }).props.onPress as () => void)();
    });
    expect(upgradeFromBackgroundDownload).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] ?? [];
    await act(async () => {
      buttons.find((button) => button.text === 'Download')?.onPress?.();
      await Promise.resolve();
    });
    expect(upgradeFromBackgroundDownload).toHaveBeenCalledWith(remote, { wifiOnly: true });
    act(() => tree.unmount());
  });
});
