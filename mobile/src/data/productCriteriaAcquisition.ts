import type { Manifest, ManifestFile } from '../types';
import { createProductCriteriaReader, readCriteriaAsset, type CriteriaLookup } from './productCriteriaTransport';

type Lease<T> = { promise: Promise<T>; release: () => void };
type Pending<T> = { controller: AbortController; users: number; promise: Promise<T> };
interface Edition {
  signature: string; index?: { key: string; text: string }; full?: CriteriaLookup;
  products: Map<string, CriteriaLookup>; assets: Map<string, Pending<string>>; requests: Map<string, Pending<CriteriaLookup>>;
}
export const CRITERIA_CACHE_LIMITS = { products: 8, pendingRequests: 9 };
const editions = new WeakMap<Manifest, Edition>();

function shared<T>(map: Map<string, Pending<T>>, key: string, build: (signal: AbortSignal) => Promise<T>): Lease<T> {
  let task = map.get(key);
  if (!task) {
    const controller = new AbortController();
    const value: Pending<T> = { controller, users: 0, promise: Promise.resolve(undefined as T) };
    value.promise = Promise.resolve().then(() => build(controller.signal)).finally(() => { if (map.get(key) === value) map.delete(key); });
    map.set(key, value); task = value;
  }
  task.users++; let released = false;
  return { promise: task.promise, release: () => {
    if (released) return; released = true; task!.users--;
    if (!task!.users && map.get(key) === task) { map.delete(key); task!.controller.abort(); }
  } };
}
function editionFor(manifest: Manifest): Edition {
  const files = manifest.files as unknown as Record<string, ManifestFile | undefined>;
  const signature = JSON.stringify([manifest.repo, manifest.tag, manifest.run_date, manifest.payload_revision, manifest.source_observation,
    Object.keys(files ?? {}).filter(key => key.startsWith('product_criteria_')).sort().map(key => [key, files[key]])]);
  const previous = editions.get(manifest);
  if (previous?.signature === signature) return previous;
  if (previous) { for (const task of previous.requests.values()) task.controller.abort(); for (const task of previous.assets.values()) task.controller.abort(); }
  const edition: Edition = { signature, products: new Map(), assets: new Map(), requests: new Map() };
  editions.set(manifest, edition); return edition;
}
function asset(manifest: Manifest, edition: Edition, file: ManifestFile, maximum: number, signal: AbortSignal): Promise<string> {
  const key = JSON.stringify([file.name, file.sha256, file.bytes, maximum]);
  const index = file === (manifest.files as unknown as Record<string, ManifestFile>).product_criteria_index;
  if (index && edition.index?.key === key) return Promise.resolve(edition.index.text);
  const lease = shared(edition.assets, key, token => readCriteriaAsset(file, maximum, token));
  const release = () => lease.release();
  signal.addEventListener('abort', release, { once: true });
  if (signal.aborted) release();
  return lease.promise.then(text => {
    if (index && !signal.aborted && editions.get(manifest) === edition) edition.index = { key, text };
    return text;
  }).finally(() => { signal.removeEventListener('abort', release); release(); });
}
function one(manifest: Manifest, edition: Edition, productKey?: string): Lease<CriteriaLookup> {
  const cached = productKey === undefined ? edition.full : edition.products.get(productKey);
  if (cached) {
    if (productKey !== undefined) { edition.products.delete(productKey); edition.products.set(productKey, cached); }
    return { promise: Promise.resolve(cached), release: () => undefined };
  }
  const key = productKey === undefined ? 'all' : JSON.stringify(productKey);
  if (!edition.requests.has(key) && edition.requests.size >= CRITERIA_CACHE_LIMITS.pendingRequests)
    return { promise: Promise.reject(new Error('Criteria acquisition capacity')), release: () => undefined };
  return shared(edition.requests, key, async signal => {
    const products = await createProductCriteriaReader(manifest, { isCurrent: () => !signal.aborted && editions.get(manifest) === edition,
      productKeys: productKey === undefined ? undefined : [productKey], retainDocuments: productKey !== undefined,
      load: (file, maximum) => asset(manifest, edition, file, maximum, signal) }).read(signal);
    if (signal.aborted || editions.get(manifest) !== edition) throw new Error('Criteria acquisition superseded');
    if (productKey === undefined) edition.full = products;
    else {
      edition.products.set(productKey, products);
      while (edition.products.size > CRITERIA_CACHE_LIMITS.products) edition.products.delete(edition.products.keys().next().value!);
    }
    return products;
  });
}

/** Single-product callers share index and in-flight shard bytes, retaining at
 * most eight product lookups. Only global filters acquire the full catalogue;
 * that cache retains facts, with source documents validated then discarded. */
export function acquireProductCriteria(manifest: Manifest, productKeys?: readonly string[]): Lease<CriteriaLookup> {
  const edition = editionFor(manifest);
  if (productKeys === undefined) return one(manifest, edition);
  const keys = [...new Set(productKeys)];
  if (!keys.length || keys.length > CRITERIA_CACHE_LIMITS.products)
    return { promise: Promise.reject(new Error('Invalid criteria product selection')), release: () => undefined };
  const leases = keys.map(key => one(manifest, edition, key));
  return { promise: Promise.all(leases.map(lease => lease.promise)).then(values => Object.assign(Object.create(null), ...values) as CriteriaLookup),
    release: () => leases.forEach(lease => lease.release()) };
}
