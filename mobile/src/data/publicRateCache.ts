import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { PublicRateAsset } from './publicRateModel';

export interface PublicRateCacheStorage {
  read(name: string, maximumCharacters: number): Promise<string | null>;
  writeAtomic(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
  list(): Promise<string[]>;
}
const MAX_FILES = 2 * 129;
const MAX_CACHE_CHARACTERS = 2 * 2 * 24 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/;

/** Content-addressed public bytes only. Failed or interrupted writes never replace verified bytes. */
export function createPublicRateAssetCache(storage: PublicRateCacheStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  const filename = (edition: string, asset: PublicRateAsset) => {
    if (!SHA.test(edition) || !SHA.test(asset.sha256)) throw new Error('Invalid public rate cache identity');
    return `${edition}-${asset.sha256}.hex`;
  };
  return {
    async read(edition: string, asset: PublicRateAsset, options: { strict?: boolean } = {}): Promise<Uint8Array | null> {
      await queue.catch(() => undefined);
      const name = filename(edition, asset), raw = await storage.read(name, asset.bytes * 2).catch(error => {
        if (options.strict) throw error;
        return null;
      });
      if (raw === null) return null;
      try {
        if (raw.length !== asset.bytes * 2 || !/^[a-f0-9]+$/.test(raw)) throw new Error('Corrupt public rate cache');
        const bytes = hexToBytes(raw);
        if (bytesToHex(sha256(bytes)) !== asset.sha256) throw new Error('Corrupt public rate cache hash');
        return bytes;
      } catch (error) {
        if (options.strict) throw error;
        await storage.remove(name).catch(() => undefined); return null;
      }
    },
    retain(edition: string, asset: PublicRateAsset, bytes: Uint8Array): Promise<void> {
      const run = queue.catch(() => undefined).then(async () => {
        const name = filename(edition, asset);
        if (bytes.length !== asset.bytes || bytesToHex(sha256(bytes)) !== asset.sha256) throw new Error('Unverified public rate cache bytes');
        const encoded = bytesToHex(bytes);
        await storage.writeAtomic(name, encoded);
        if (await storage.read(name, encoded.length) !== encoded) throw new Error('Public rate cache readback failed');
        const listed = await storage.list();
        const files = listed.filter(file => /^[a-f0-9]{64}-[a-f0-9]{64}\.hex$/.test(file));
        // Previous aborted transactions have no authority; remove their bounded scratch files.
        for (const scratch of listed.filter(file => /^[a-f0-9]{64}-[a-f0-9]{64}\.hex\.tmp$/.test(file))) await storage.remove(scratch);
        // Access order is public metadata. Retain current edition and one bounded previous edition.
        const orderName = 'editions.json';
        const rawOrder = await storage.read(orderName, 160 * 1024).catch(() => null);
        let old: string[] = [], entries: { name: string; characters: number }[] = [];
        try {
          const parsed = JSON.parse(rawOrder ?? '{}') as { editions?: unknown; entries?: unknown };
          if (Array.isArray(parsed.editions) && parsed.editions.every(value => typeof value === 'string' && SHA.test(value))) old = parsed.editions.slice(0, 2);
          if (Array.isArray(parsed.entries) && parsed.entries.length <= MAX_FILES && parsed.entries.every(value =>
            value && /^[a-f0-9]{64}-[a-f0-9]{64}\.hex$/.test(value.name) && Number.isSafeInteger(value.characters) && value.characters > 0 && value.characters <= 2 * 1024 * 1024)) entries = parsed.entries;
        } catch { /* Empty recovery index. */ }
        const editions = [edition, ...old.filter(value => value !== edition)].slice(0, 2);
        entries = [{ name, characters: encoded.length }, ...entries.filter(entry => entry.name !== name && editions.includes(entry.name.slice(0, 64)))];
        let total = 0, kept = 0;
        entries = entries.sort((a, b) => editions.indexOf(a.name.slice(0, 64)) - editions.indexOf(b.name.slice(0, 64))).filter(entry => {
          if (kept >= MAX_FILES || total + entry.characters > MAX_CACHE_CHARACTERS) return false;
          total += entry.characters; kept += 1; return true;
        });
        await storage.writeAtomic(orderName, JSON.stringify({ editions, entries }));
        const retainedNames = new Set(entries.map(entry => entry.name));
        for (const file of files) {
          if (!retainedNames.has(file)) await storage.remove(file);
        }
      });
      queue = run; return run;
    },
  };
}

const root = `${FileSystem.cacheDirectory}public-rates-v1/`;
const key = (name: string) => `ar-public-rate-v1:${name}`;
const storage: PublicRateCacheStorage = {
  async read(name, maximum) {
    if (Platform.OS === 'web') {
      const value = globalThis.localStorage?.getItem(key(name)) ?? null;
      if (value !== null && value.length > maximum) throw new Error('Oversized public rate cache');
      return value;
    }
    const info = await FileSystem.getInfoAsync(root + name);
    if (!info.exists) return null;
    if (info.isDirectory || info.size > maximum) throw new Error('Invalid public rate cache entry');
    return FileSystem.readAsStringAsync(root + name);
  },
  async writeAtomic(name, value) {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(key(name), value); return; }
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
    const temporary = root + name + '.tmp';
    const prior = await FileSystem.getInfoAsync(root + name);
    if (prior.exists && !prior.isDirectory && prior.size === value.length && await FileSystem.readAsStringAsync(root + name) === value) return;
    await FileSystem.writeAsStringAsync(temporary, value);
    // The old content-addressed target remains useful if replacement is interrupted.
    if (prior.exists) await FileSystem.deleteAsync(root + name, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: root + name });
  },
  async remove(name) {
    if (Platform.OS === 'web') { globalThis.localStorage?.removeItem(key(name)); return; }
    await FileSystem.deleteAsync(root + name, { idempotent: true });
  },
  async list() {
    if (Platform.OS === 'web') {
      const store = globalThis.localStorage, result: string[] = [];
      for (let i = 0; store && i < store.length; i += 1) { const name = store.key(i); if (name?.startsWith(key(''))) result.push(name.slice(key('').length)); }
      return result;
    }
    const info = await FileSystem.getInfoAsync(root);
    return info.exists ? FileSystem.readDirectoryAsync(root) : [];
  },
};
export const publicRateAssetCache = createPublicRateAssetCache(storage);
