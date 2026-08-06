/** APK verification is Android-only; keep web exports free of native modules. */
export async function hashFileSha256(_path: string): Promise<string> {
  throw new Error('Native file hashing is unavailable on web');
}
