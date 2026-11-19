const mockPush = jest.fn();
const mockOpenURL = jest.fn();
let mockIosInstallUrl: string | null;
let mockPlatformOS: string;

function loadStartAppUpdate(iosInstallUrl: string | null) {
  jest.resetModules();
  mockIosInstallUrl = iosInstallUrl;
  mockPlatformOS = 'ios';
  jest.doMock('react-native', () => {
    const native = jest.requireActual('react-native');
    return Object.defineProperties(Object.create(native), {
      Platform: { value: { ...native.Platform, OS: mockPlatformOS } },
      Linking: { value: { ...native.Linking, openURL: mockOpenURL } },
    });
  });
  jest.doMock('expo-router', () => ({ router: { push: mockPush } }));
  jest.doMock('../src/config', () => ({
    IOS_INSTALL_URL: mockIosInstallUrl,
    PLAY_STORE_URL: 'https://play.google.com/',
    SELF_UPDATE_ENABLED: false,
  }));
  jest.doMock('../src/data/store', () => ({ useStore: { getState: jest.fn() } }));
  jest.doMock('../src/lib/appUpdate', () => ({
    checkForAppUpdate: jest.fn(),
    upgradeFromBackgroundDownload: jest.fn(),
  }));
  return jest.requireActual('../src/lib/startAppUpdate').startAppUpdate as () => Promise<void>;
}

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

it('opens the configured iOS install destination', async () => {
  mockOpenURL.mockResolvedValue(undefined);
  const startAppUpdate = loadStartAppUpdate('https://apps.apple.com/app/example');

  await startAppUpdate();

  expect(mockOpenURL).toHaveBeenCalledWith('https://apps.apple.com/app/example');
  expect(mockPush).not.toHaveBeenCalled();
});

it('routes to Settings when no iOS install destination is configured', async () => {
  const startAppUpdate = loadStartAppUpdate(null);

  await startAppUpdate();

  expect(mockOpenURL).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith('/settings');
});
