import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

export const APP_LOCK_SCREEN_CAPTURE_KEY = 'australian-rates-app-lock';

type ScreenCaptureApi = Pick<
  typeof ScreenCapture,
  'preventScreenCaptureAsync' | 'allowScreenCaptureAsync'
>;

/**
 * Serializes FLAG_SECURE changes so rapid preference changes cannot leave an
 * older async "allow" call winning after a newer "prevent" call.
 */
export class AppLockScreenProtectionController {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly platform: string,
    private readonly screenCapture: ScreenCaptureApi,
  ) {}

  setEnabled(enabled: boolean): Promise<void> {
    if (this.platform !== 'android') return Promise.resolve();

    const apply = () =>
      enabled
        ? this.screenCapture.preventScreenCaptureAsync(APP_LOCK_SCREEN_CAPTURE_KEY)
        : this.screenCapture.allowScreenCaptureAsync(APP_LOCK_SCREEN_CAPTURE_KEY);

    const operation = this.queue.then(apply, apply);
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}

const appLockScreenProtection = new AppLockScreenProtectionController(
  Platform.OS,
  ScreenCapture,
);

export function setAppLockScreenProtection(enabled: boolean): Promise<void> {
  return appLockScreenProtection.setEnabled(enabled);
}
