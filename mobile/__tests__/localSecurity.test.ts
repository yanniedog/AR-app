import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

import { authenticateBiometric, biometricsAvailable } from '../src/lib/appLock';
import {
  clearKeyCacheForTests,
  resolvePayloadKeyHex,
} from '../src/lib/keyVault';

describe('appLock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires hardware AND enrolment', async () => {
    expect(await biometricsAvailable()).toBe(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await biometricsAvailable()).toBe(false);
  });

  it('maps the OS prompt result and fails closed on errors', async () => {
    expect(await authenticateBiometric('test')).toBe(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });
    expect(await authenticateBiometric('test')).toBe(false);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    expect(await authenticateBiometric('test')).toBe(false);
  });
});

describe('keyVault', () => {
  beforeEach(() => {
    clearKeyCacheForTests();
    jest.clearAllMocks();
  });

  it('falls back to the (empty) config key when SecureStore is empty', async () => {
    expect(await resolvePayloadKeyHex()).toBe('');
  });

  it('prefers a retained legacy SecureStore key and caches it', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('ab'.repeat(32));
    expect(await resolvePayloadKeyHex()).toBe('ab'.repeat(32));
    (SecureStore.getItemAsync as jest.Mock).mockClear();
    expect(await resolvePayloadKeyHex()).toBe('ab'.repeat(32));
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('fails open to the config key when SecureStore read throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore gone'));
    expect(await resolvePayloadKeyHex()).toBe('');
  });
});
