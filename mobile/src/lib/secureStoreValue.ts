import * as SecureStore from 'expo-secure-store';

import { defineSecureStoreKey, type SecureStoreKey } from './secureStoreKey';

const SECURE_VALUE_SCHEMA_VERSION = 1 as const;
/** Stay below Expo SecureStore's documented 2 KiB warning threshold. */
export const MAX_SECURE_STORE_VALUE_BYTES = 1_800;

interface SecureValueManifest {
  kind: 'ar.secure-value';
  schemaVersion: typeof SECURE_VALUE_SCHEMA_VERSION;
  generation: string;
  chunks: number;
}

export class RecoveredIncompleteSecureStoreValueError extends Error {
  constructor() {
    super('Encrypted value was incomplete and has been reset');
    this.name = 'RecoveredIncompleteSecureStoreValueError';
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function splitValue(value: string): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of value) {
    const charBytes = utf8ByteLength(char);
    if (current && currentBytes + charBytes > MAX_SECURE_STORE_VALUE_BYTES) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  chunks.push(current);
  return chunks;
}

function parseManifest(raw: string | null): SecureValueManifest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SecureValueManifest>;
    return value.kind === 'ar.secure-value' &&
      value.schemaVersion === SECURE_VALUE_SCHEMA_VERSION &&
      typeof value.generation === 'string' &&
      /^[a-z0-9-]+$/i.test(value.generation) &&
      Number.isInteger(value.chunks) &&
      (value.chunks ?? 0) > 0 &&
      (value.chunks ?? 0) <= 10_000
      ? value as SecureValueManifest
      : null;
  } catch {
    return null;
  }
}

function chunkKey(baseKey: SecureStoreKey, generation: string, index: number): SecureStoreKey {
  return defineSecureStoreKey(`${baseKey}.chunk.${generation}.${index}`);
}

async function deleteManifestChunks(
  baseKey: SecureStoreKey,
  manifest: SecureValueManifest | null,
): Promise<void> {
  if (!manifest) return;
  for (let index = 0; index < manifest.chunks; index += 1) {
    await SecureStore.deleteItemAsync(chunkKey(baseKey, manifest.generation, index));
  }
}

/**
 * Read a byte-bounded encrypted value. Direct pre-v1 values remain readable so
 * existing installations migrate without losing financial inputs.
 */
export async function readSecureStoreValue(baseKey: SecureStoreKey): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(baseKey);
  const manifest = parseManifest(raw);
  if (!manifest) return raw;
  const chunks: string[] = [];
  for (let index = 0; index < manifest.chunks; index += 1) {
    const chunk = await SecureStore.getItemAsync(chunkKey(baseKey, manifest.generation, index));
    if (chunk == null) {
      // The committed generation can never become readable again. Remove the
      // manifest first so a future write is not permanently blocked, then make
      // best-effort cleanup of any surviving chunks.
      await SecureStore.deleteItemAsync(baseKey);
      await deleteManifestChunks(baseKey, manifest).catch(() => undefined);
      throw new RecoveredIncompleteSecureStoreValueError();
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

/**
 * Write chunks first and commit their small manifest last. A failed write
 * therefore leaves the previous generation readable.
 */
export async function writeSecureStoreValue(
  baseKey: SecureStoreKey,
  value: string,
): Promise<void> {
  const previousRaw = await SecureStore.getItemAsync(baseKey).catch(() => null);
  const previousManifest = parseManifest(previousRaw);
  const chunks = splitValue(value);
  const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let writtenChunks = 0;
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(chunkKey(baseKey, generation, index), chunks[index], {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      writtenChunks += 1;
    }
    const manifest: SecureValueManifest = {
      kind: 'ar.secure-value',
      schemaVersion: SECURE_VALUE_SCHEMA_VERSION,
      generation,
      chunks: chunks.length,
    };
    await SecureStore.setItemAsync(baseKey, JSON.stringify(manifest), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    for (let index = 0; index < writtenChunks; index += 1) {
      await SecureStore.deleteItemAsync(chunkKey(baseKey, generation, index)).catch(() => undefined);
    }
    throw error;
  }
  await deleteManifestChunks(baseKey, previousManifest).catch(() => undefined);
}

export async function deleteSecureStoreValue(baseKey: SecureStoreKey): Promise<void> {
  const raw = await SecureStore.getItemAsync(baseKey).catch(() => null);
  const manifest = parseManifest(raw);
  // Remove the committed manifest first. If best-effort chunk cleanup is
  // interrupted, readers still see a clean deletion rather than an incomplete
  // encrypted value.
  await SecureStore.deleteItemAsync(baseKey);
  await deleteManifestChunks(baseKey, manifest).catch(() => undefined);
}
