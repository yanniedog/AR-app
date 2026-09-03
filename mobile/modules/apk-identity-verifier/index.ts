import { requireOptionalNativeModule } from 'expo-modules-core';

export interface VerifiedApkArchiveIdentity {
  packageName: string;
  versionName: string;
  versionCode: string;
  signerSha256: string;
  signerCount: number;
  signatureVerified: boolean;
  verifiedSchemes: string[];
}

interface NativeApkIdentityVerifier {
  verifyAsync(uri: string): Promise<VerifiedApkArchiveIdentity>;
}

const nativeVerifier = requireOptionalNativeModule<NativeApkIdentityVerifier>(
  'ArApkIdentityVerifier',
);

export async function verifyApkArchiveIdentity(
  uri: string,
): Promise<VerifiedApkArchiveIdentity> {
  if (!nativeVerifier) {
    throw new Error('Native APK identity verification is unavailable');
  }
  return nativeVerifier.verifyAsync(uri);
}
