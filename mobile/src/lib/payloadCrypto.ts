import { gcm } from '@noble/ciphers/aes';
import { hexToBytes } from '@noble/ciphers/utils';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Decrypt support for AES-256-GCM payload assets produced by the Pi's
 * payload_crypto.py (Phase B of docs/SECURITY_CDR_PIPELINE.md).
 *
 * Asset format: `ARE1 | 12-byte nonce | GCM ciphertext+tag` with AAD = "ARE1".
 * This reader remains for backward compatibility with previously published
 * encrypted assets. New payload contracts do not rely on account-issued keys.
 */

const MAGIC = Uint8Array.from([0x41, 0x52, 0x45, 0x31]); // "ARE1"
const NONCE_LEN = 12;
const KEY_LEN = 32;

export function isEncryptedAsset(bytes: Uint8Array): boolean {
  return (
    bytes.length > MAGIC.length + NONCE_LEN &&
    bytes[0] === MAGIC[0] &&
    bytes[1] === MAGIC[1] &&
    bytes[2] === MAGIC[2] &&
    bytes[3] === MAGIC[3]
  );
}

/** Short non-secret key identifier; must match manifest `enc.key_id`. */
export function payloadKeyId(keyHex: string): string {
  return transportKeyId(keyHex).slice(0, 8);
}

/** 128-bit identifier for versioned encrypted transport and private setup keys. */
export function transportKeyId(keyHex: string): string {
  const prefix = 'ar-local-payload-key:'; // ASCII; avoids a TextEncoder dependency
  const key = hexToBytes(keyHex);
  if (key.length !== KEY_LEN) throw new Error('Invalid data key length');
  const buf = new Uint8Array(prefix.length + key.length);
  for (let i = 0; i < prefix.length; i += 1) buf[i] = prefix.charCodeAt(i);
  buf.set(key, prefix.length);
  return Array.from(sha256(buf).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function decryptAsset(bytes: Uint8Array, keyHex: string): Uint8Array {
  if (!keyHex) {
    throw new Error('payload asset is encrypted but no decryption key is configured');
  }
  const key = hexToBytes(keyHex);
  if (key.length !== KEY_LEN) {
    throw new Error(`payload decryption key must be ${KEY_LEN} bytes (64 hex chars)`);
  }
  if (!isEncryptedAsset(bytes)) {
    throw new Error('not an ARE1 encrypted asset');
  }
  const nonce = bytes.slice(MAGIC.length, MAGIC.length + NONCE_LEN);
  const ciphertext = bytes.slice(MAGIC.length + NONCE_LEN);
  return gcm(key, nonce, MAGIC).decrypt(ciphertext);
}
