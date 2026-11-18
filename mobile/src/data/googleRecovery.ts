/** Google recovery remains unavailable until the documented release prerequisites are met.
 * This is deliberately source-controlled, not an OTA/remote configuration switch.
 */
export const GOOGLE_RECOVERY_RELEASE = Object.freeze({
  writtenConsent: false,
  androidOAuthRegistered: false,
  signedBuildRecoveryVerified: false,
});

export function googleRecoveryAvailable(): boolean {
  return Object.values(GOOGLE_RECOVERY_RELEASE).every(value => value);
}

export function assertGoogleRecoveryAvailable(): void {
  if (!googleRecoveryAvailable()) throw new Error('Google recovery is pending approval.');
}
