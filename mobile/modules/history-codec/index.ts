import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeHistoryCodec {
  compressAsync(json: string): Promise<{ sha256: string; bytes: number; gzip_base64: string }>;
  decompressAsync(gzipBase64: string, bytes: number, sha256: string): Promise<string>;
}

/** Resolve only after the caller has scheduled optional history work. */
export function getNativeHistoryCodec(): NativeHistoryCodec | null {
  return requireOptionalNativeModule<NativeHistoryCodec>('ArHistoryCodec');
}
