import * as Crypto from 'expo-crypto';
import { PAYLOAD_REPO } from '../config';
import type { Manifest, ManifestFile } from '../types';
import { downloadInflate } from './payload';
import { canonicalTermsJson, validateProductTerms, type ProductTerms } from './productTerms';

export interface ProductTermsIndex {
  schema_version: 1;
  run_date: string;
  products: Record<string, ManifestFile>;
}
const SHA = /^[a-f0-9]{64}$/;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_INFLATED = 32 * 1024 * 1024;
const indexes = new Map<string, Promise<ProductTermsIndex>>();
const products = new Map<string, Promise<ProductTerms>>();

function validDescriptor(value: unknown, manifest: Manifest): value is ManifestFile {
  if (!value || typeof value !== 'object') return false;
  const item = value as ManifestFile;
  const prefix = `https://github.com/${PAYLOAD_REPO}/releases/download/${manifest.tag}/`;
  return typeof item.name === 'string' && /^[A-Za-z0-9_.-]+$/.test(item.name) &&
    typeof item.sha256 === 'string' && SHA.test(item.sha256) && item.enc === undefined &&
    Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= MAX_BYTES &&
    item.url === prefix + item.name;
}

/** Bind every child asset to the same immutable selected release as its index. */
export function validateProductTermsIndex(raw: unknown, manifest: Manifest): ProductTermsIndex {
  if (!manifest.payload_revision || manifest.repo !== PAYLOAD_REPO || !raw || typeof raw !== 'object') {
    throw new Error('Terms require an immutable payload revision');
  }
  const index = raw as ProductTermsIndex;
  if (index.schema_version !== 1 || index.run_date !== manifest.run_date || !index.products ||
      typeof index.products !== 'object' || Array.isArray(index.products) ||
      Object.keys(index.products).length > 20000 ||
      Object.entries(index.products).some(([key, item]) => !key || !validDescriptor(item, manifest))) {
    throw new Error('Invalid product terms index');
  }
  return index;
}

async function acquire(file: ManifestFile): Promise<unknown> {
  const text = await downloadInflate(file.url, file.sha256, {
    fileName: file.name, expectedBytes: file.bytes, requireExactBytes: true,
    maxCompressedBytes: MAX_BYTES, maxInflatedBytes: MAX_INFLATED, allowEncrypted: false,
  });
  return JSON.parse(text) as unknown;
}

function memo<T>(cache: Map<string, Promise<T>>, key: string, limit: number, create: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  while (cache.size >= limit) cache.delete(cache.keys().next().value!);
  const promise = create().catch((error: unknown) => {
    if (cache.get(key) === promise) cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

/** Called only when the user opens evidence. Current rates need no document download. */
export async function loadProductTerms(manifest: Manifest, productKey: string): Promise<ProductTerms | null> {
  const file = manifest.files.terms_index;
  if (!file) return null;
  if (!manifest.payload_revision || !validDescriptor(file, manifest)) throw new Error('Invalid immutable terms descriptor');
  const generationKey = `${manifest.payload_revision.bundle_sha256}:${file.sha256}`;
  const index = await memo(indexes, generationKey, 2, async () =>
    validateProductTermsIndex(await acquire(file), manifest));
  const descriptor = Object.hasOwn(index.products, productKey) ? index.products[productKey] : undefined;
  if (!descriptor) return null;
  const key = `${generationKey}:${productKey}:${descriptor.sha256}`;
  return memo(products, key, 16, async () => {
    const terms = validateProductTerms(await acquire(descriptor), productKey);
    const { identity_sha256, ...body } = terms;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalTermsJson(body));
    if (hash !== identity_sha256) throw new Error('Product terms content identity mismatch');
    return terms;
  });
}
