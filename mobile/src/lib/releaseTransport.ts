import { gcm } from '@noble/ciphers/aes';
import { hexToBytes } from '@noble/ciphers/utils';
import { transportKeyId } from './payloadCrypto';

export const RELEASE_TRANSPORT_OVERHEAD = 72;
export const MAX_TRANSPORT_ENCODED_BYTES = 256 * 1024 * 1024;
const HEADER_BYTES = 44;
const NONCE_BYTES = 12;

export function isReleaseTransport(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 65 && bytes[1] === 82 && bytes[2] === 69 && bytes[3] === 50;
}

/** Header limits are checked before key access, AES allocation or decompression. */
export async function decryptReleaseTransport(
  bytes: Uint8Array,
  resolveKey: (id: string) => Promise<string>,
  limit = MAX_TRANSPORT_ENCODED_BYTES,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > MAX_TRANSPORT_ENCODED_BYTES) {
    throw new Error('Invalid encrypted transport byte limit');
  }
  if (!isReleaseTransport(bytes) || bytes.length < RELEASE_TRANSPORT_OVERHEAD) {
    throw new Error('Missing encrypted release transport');
  }
  const id = String.fromCharCode(...bytes.slice(4, 36));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const high = view.getUint32(36, false);
  const size = view.getUint32(40, false);
  if (!/^[a-f0-9]{32}$/.test(id) || high !== 0 || size > limit || bytes.length !== size + RELEASE_TRANSPORT_OVERHEAD) {
    throw new Error('Encrypted transport header or size is invalid');
  }
  try {
    const key = await resolveKey(id);
    if (transportKeyId(key) !== id) throw new Error('Key ID mismatch');
    const nonce = bytes.slice(HEADER_BYTES, HEADER_BYTES + NONCE_BYTES);
    const plain = gcm(hexToBytes(key), nonce, bytes.slice(0, HEADER_BYTES)).decrypt(bytes.slice(HEADER_BYTES + NONCE_BYTES));
    if (['ARE1', 'ARE2'].includes(String.fromCharCode(...plain.subarray(0, 4)))) throw new Error('Nested transport');
    return plain;
  } catch {
    throw new Error('Encrypted data could not be opened. Check the setup key in Settings.');
  }
}
