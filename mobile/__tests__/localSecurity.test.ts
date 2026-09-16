import * as LocalAuthentication from 'expo-local-authentication';

import { authenticateBiometric, biometricsAvailable } from '../src/lib/appLock';


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
