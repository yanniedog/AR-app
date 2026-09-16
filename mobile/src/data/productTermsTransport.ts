import { retainTermsReference } from './termsReferenceStore';
import * as Crypto from 'expo-crypto';
import { PAYLOAD_REPO } from '../config';
import type { Manifest, ManifestFile } from '../types';
import { downloadInflate } from './payload';
import { canonicalTermsJson, validateProductTerms, type ProductTerms } from './productTerms';

export interface ProductTermsIndex {
  schema_version: 1 | 2;
  run_date: string;
  products: Record<string, ManifestFile | string>;
}
const SHA = /^[a-f0-9]{64}$/;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_INFLATED = 32 * 1024 * 1024;
const indexes = new Map<string, Promise<ProductTermsIndex>>();
const products = new Map<string, Promise<ProductTerms>>();
const shards = new Map<string, Promise<Record<string, unknown>>>();

function manifestAsset(manifest: Manifest, key: string): ManifestFile | undefined {
  const files = manifest.files as unknown as Record<string, ManifestFile>;
  return Object.hasOwn(files, key) ? files[key] : undefined;
}

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
  if (![1, 2].includes(index.schema_version) || index.run_date !== manifest.run_date || !index.products ||
      typeof index.products !== 'object' || Array.isArray(index.products) ||
      Object.keys(index.products).length > 20000 ||
      Object.entries(index.products).some(([key, item]) => !key || (index.schema_version === 1
        ? !validDescriptor(item, manifest)
        : typeof item !== 'string' || !/^terms_shard_[0-9]{3}$/.test(item) ||
          !validDescriptor(manifestAsset(manifest, item), manifest)))) {
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
  const reference = Object.hasOwn(index.products, productKey) ? index.products[productKey] : undefined;
  if (!reference) return null;
  const descriptor = typeof reference === 'string' ? manifestAsset(manifest, reference) : reference;
  if (!descriptor) throw new Error('Missing declared terms shard');
  const key = `${generationKey}:${productKey}:${descriptor.sha256}`;
  return memo(products, key, 16, async () => {
    let raw: unknown;
    if (index.schema_version === 2) {
      const shard = await memo(shards, `${generationKey}:${descriptor.sha256}`, 4, async () => {
        const value = await acquire(descriptor) as Record<string, unknown>;
        if (!value || value.schema_version !== 1 || value.run_date !== manifest.run_date ||
            !value.products || typeof value.products !== 'object' || Array.isArray(value.products) ||
            Object.keys(value.products).length > 20000) throw new Error('Invalid product terms shard');
        return value.products as Record<string, unknown>;
      });
      if (!Object.hasOwn(shard, productKey)) throw new Error('Product missing from declared terms shard');
      raw = shard[productKey];
    } else raw = await acquire(descriptor);
    const terms = validateProductTerms(raw, productKey);
    const { identity_sha256, ...body } = terms;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonicalTermsJson(body));
    if (hash !== identity_sha256) throw new Error('Product terms content identity mismatch');
    // Optional descriptive retention never grants execution approval or replaces current transport failures.
    await retainTermsReference({ productKey, edition: manifest.payload_revision!.bundle_sha256, runDate: manifest.run_date,
      indexSha256: file.sha256, assetSha256: descriptor.sha256, terms, retainedAt: new Date().toISOString() }).catch(() => undefined);
    return terms;
  });
}
