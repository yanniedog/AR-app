import { Platform } from 'react-native';

import {
  checkForAppUpdate,
  resetAppUpdateCheckCacheForTests,
} from '../src/lib/appUpdate';
import { checkForAppUpdateAcrossChannels } from '../src/lib/appUpdateLogic';

jest.mock('../src/lib/appUpdateLogic', () => {
  const actual = jest.requireActual('../src/lib/appUpdateLogic');
  return {
    ...actual,
    checkForAppUpdateAcrossChannels: jest.fn(),
  };
});

const currentResult = {
  status: 'current' as const,
  installed: { version: '1.0.0', buildNumber: '1' },
  remote: {
    schema_version: 1,
    version: '1.0.0',
    build_number: '1',
    download_url: 'https://github.com/yanniedog/AR-app/releases/download/app-v1.0.0/app.apk',
  },
};

describe('checkForAppUpdate cache control', () => {
  let platformDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    resetAppUpdateCheckCacheForTests();
    jest.mocked(checkForAppUpdateAcrossChannels).mockReset().mockResolvedValue(currentResult);
  });

  afterEach(() => {
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
  });

  it('coalesces automatic checks but bypasses the TTL for a manual check', async () => {
    await checkForAppUpdate();
    await checkForAppUpdate();
    expect(checkForAppUpdateAcrossChannels).toHaveBeenCalledTimes(1);

    await checkForAppUpdate({ force: true });
    expect(checkForAppUpdateAcrossChannels).toHaveBeenCalledTimes(2);
  });
});
