import { requireOptionalNativeModule } from 'expo-modules-core';
import { jsonContentHash as portableJsonContentHash } from './jsonContentHashPortable';

type NativeCrypto = {
  digestString?: (algorithm: string, text: string, options: { encoding: string }) => string;
};
type Digest = (text: string) => string;
let nativeDigest: Digest | null | undefined;
const SHA256 = /^[a-f0-9]{64}$/;

function resolveDigest(): Digest | null {
  if (nativeDigest !== undefined) return nativeDigest;
  const module = requireOptionalNativeModule<NativeCrypto>('ExpoCrypto');
  if (typeof module?.digestString !== 'function') return (nativeDigest = null);
  const digest: Digest = text => module.digestString!('SHA-256', text, { encoding: 'hex' });
  // Expo's native sync API avoids multi-second JS hashing on Hermes. Check its
  // exact UTF-8/hex behavior before trusting it; unsupported runtimes stay portable.
  const probe = { value: 'ASCII · é 澳 🏦', escaped: '\ud800', empty: '' };
  if (digest(JSON.stringify(probe)) !== portableJsonContentHash(probe)) {
    throw new Error('Native JSON content digest failed its compatibility check');
  }
  nativeDigest = digest;
  return digest;
}

/** JSON.stringify escapes lone surrogates, keeping native and JS UTF-8 identical. */
export function jsonContentHash(value: object): string {
  const digest = resolveDigest();
  if (!digest) return portableJsonContentHash(value);
  const result = digest(JSON.stringify(value));
  if (!SHA256.test(result)) throw new Error('Native JSON content digest is invalid');
  return result;
}
