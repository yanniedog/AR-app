import {
  APP_LOCK_SCREEN_CAPTURE_KEY,
  AppLockScreenProtectionController,
} from '../src/lib/appLockScreenProtection';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));

describe('app lock Android screen protection', () => {
  it('binds the lock preference to Android FLAG_SECURE through Expo', async () => {
    const screenCapture = {
      preventScreenCaptureAsync: jest.fn(async () => {}),
      allowScreenCaptureAsync: jest.fn(async () => {}),
    };
    const controller = new AppLockScreenProtectionController('android', screenCapture);

    await controller.setEnabled(true);
    await controller.setEnabled(false);

    expect(screenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith(
      APP_LOCK_SCREEN_CAPTURE_KEY,
    );
    expect(screenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith(
      APP_LOCK_SCREEN_CAPTURE_KEY,
    );
  });

  it('serializes rapid enable/disable changes in requested order', async () => {
    let releasePrevent!: () => void;
    const preventPending = new Promise<void>((resolve) => {
      releasePrevent = resolve;
    });
    const calls: string[] = [];
    const screenCapture = {
      preventScreenCaptureAsync: jest.fn(async () => {
        calls.push('prevent:start');
        await preventPending;
        calls.push('prevent:end');
      }),
      allowScreenCaptureAsync: jest.fn(async () => {
        calls.push('allow');
      }),
    };
    const controller = new AppLockScreenProtectionController('android', screenCapture);

    const enabling = controller.setEnabled(true);
    const disabling = controller.setEnabled(false);
    await Promise.resolve();
    expect(calls).toEqual(['prevent:start']);

    releasePrevent();
    await Promise.all([enabling, disabling]);
    expect(calls).toEqual(['prevent:start', 'prevent:end', 'allow']);
  });

  it('does not invoke native screen protection on unsupported platforms', async () => {
    const screenCapture = {
      preventScreenCaptureAsync: jest.fn(async () => {}),
      allowScreenCaptureAsync: jest.fn(async () => {}),
    };
    const controller = new AppLockScreenProtectionController('web', screenCapture);

    await controller.setEnabled(true);

    expect(screenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();
    expect(screenCapture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });
});
