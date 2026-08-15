import type { BankSpreadHistoryPayload } from './bankSpreadHistory';
import {
  bankSpreadEntryIdentity,
  bankSpreadIdentityKey,
  sameBankSpreadBytes,
  serializeBankSpreadRecord,
  validateRawBankSpreadRecord,
  validateStoredBankSpreadRecord,
  validBankSpreadIdentity,
  type BankSpreadCacheIdentity,
  type BankSpreadStoredEntry,
  type VerifiedBankSpreadRecord,
} from './bankSpreadContentRecord';

export type { BankSpreadCacheIdentity } from './bankSpreadContentRecord';

export const BANK_SPREAD_CACHE_MAX_ENTRIES = 2;
export const BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
export const BANK_SPREAD_CACHE_MAX_INFLATED_BYTES = 64 * 1024 * 1024;
export const BANK_SPREAD_CACHE_MAX_TOTAL_COMPRESSED_BYTES =
  BANK_SPREAD_CACHE_MAX_ENTRIES * BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES;
export const BANK_SPREAD_CACHE_MAX_ENCODED_BYTES =
  Math.ceil(BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES / 3) * 4;
export const BANK_SPREAD_CACHE_MAX_TOTAL_ENCODED_BYTES =
  BANK_SPREAD_CACHE_MAX_ENTRIES * BANK_SPREAD_CACHE_MAX_ENCODED_BYTES;

export interface BankSpreadContentStorage {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  /** Return direct child names only. */
  list(path: string): Promise<string[]>;
}

type RetainedEntry = BankSpreadStoredEntry;

interface RetentionIndex {
  schema_version: 1;
  entries: RetainedEntry[];
}

type VerifiedRecord = VerifiedBankSpreadRecord;

interface BankSpreadCacheLimits {
  maxCompressedBytes: number;
  maxInflatedBytes: number;
  maxEntries: number;
  maxTotalCompressedBytes: number;
  maxEncodedBytes: number;
  maxTotalEncodedBytes: number;
}

function parseIndex(raw: string | null, limits: BankSpreadCacheLimits): RetentionIndex | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RetentionIndex>;
    if (value.schema_version !== 1 || !Array.isArray(value.entries)) return null;
    if (value.entries.length > limits.maxEntries) return null;
    const keys = new Set<string>();
    let compressedBytes = 0;
    let encodedBytes = 0;
    for (const entry of value.entries) {
      if (!entry || typeof entry !== 'object') return null;
      const identity = bankSpreadEntryIdentity(entry);
      if (
        !validBankSpreadIdentity(identity) ||
        !Number.isSafeInteger(entry.compressed_bytes) ||
        entry.compressed_bytes <= 0 ||
        entry.compressed_bytes > limits.maxCompressedBytes ||
        !Number.isSafeInteger(entry.encoded_bytes) ||
        entry.encoded_bytes <= 0 ||
        entry.encoded_bytes > limits.maxEncodedBytes
      ) return null;
      const key = bankSpreadIdentityKey(identity);
      if (keys.has(key)) return null;
      keys.add(key);
      compressedBytes += entry.compressed_bytes;
      encodedBytes += entry.encoded_bytes;
    }
    if (
      compressedBytes > limits.maxTotalCompressedBytes ||
      encodedBytes > limits.maxTotalEncodedBytes
    ) return null;
    return value as RetentionIndex;
  } catch {
    return null;
  }
}

export function createBankSpreadContentCache(
  storage: BankSpreadContentStorage,
  root: string,
  limitOverrides: Partial<BankSpreadCacheLimits> = {},
) {
  const limits: BankSpreadCacheLimits = {
    maxCompressedBytes: BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES,
    maxInflatedBytes: BANK_SPREAD_CACHE_MAX_INFLATED_BYTES,
    maxEntries: BANK_SPREAD_CACHE_MAX_ENTRIES,
    maxTotalCompressedBytes: BANK_SPREAD_CACHE_MAX_TOTAL_COMPRESSED_BYTES,
    maxEncodedBytes: BANK_SPREAD_CACHE_MAX_ENCODED_BYTES,
    maxTotalEncodedBytes: BANK_SPREAD_CACHE_MAX_TOTAL_ENCODED_BYTES,
    ...limitOverrides,
  };
  const recordsRoot = `${root}/records`;
  const indexPath = `${root}/index.json`;
  const indexTmpPath = `${indexPath}.tmp`;
  let mutationChain: Promise<void> = Promise.resolve();

  const recordPath = (identity: BankSpreadCacheIdentity) =>
    `${recordsRoot}/${identity.coreSha}-${identity.spreadSha}.json`;

  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = mutationChain.then(fn, fn);
    mutationChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async function readVerifiedRecord(identity: BankSpreadCacheIdentity): Promise<VerifiedRecord | null> {
    if (!validBankSpreadIdentity(identity)) return null;
    const path = recordPath(identity);
    const primary = await validateStoredBankSpreadRecord(
      await storage.read(path),
      identity,
      'primary',
      limits,
    );
    if (primary) return primary;
    return validateStoredBankSpreadRecord(
      await storage.read(`${path}.tmp`),
      identity,
      'temporary',
      limits,
    );
  }

  async function readIndex(): Promise<RetentionIndex | null> {
    const primary = parseIndex(await storage.read(indexPath), limits);
    if (primary) return primary;
    return parseIndex(await storage.read(indexTmpPath), limits);
  }

  async function replaceIndex(index: RetentionIndex | null): Promise<void> {
    if (!index) {
      await storage.remove(indexPath);
      await storage.remove(indexTmpPath);
      return;
    }
    await storage.write(indexTmpPath, JSON.stringify(index));
    await storage.remove(indexPath);
    await storage.move(indexTmpPath, indexPath);
  }

  async function healTemporary(record: VerifiedRecord): Promise<void> {
    const path = recordPath(record.identity);
    if (record.source !== 'temporary') {
      await storage.remove(`${path}.tmp`);
      return;
    }
    await storage.remove(path);
    await storage.move(`${path}.tmp`, path);
    record.source = 'primary';
  }

  async function enumerateRecordFiles(): Promise<string[]> {
    let names: string[];
    try {
      names = await storage.list(recordsRoot);
    } catch {
      return [];
    }
    return names
      .filter((name) => /^[0-9a-f]{64}-[0-9a-f]{64}\.json(?:\.tmp)?$/.test(name))
      .map((name) => `${recordsRoot}/${name}`);
  }

  async function discardIfUnindexed(
    identity: BankSpreadCacheIdentity,
    suppliedIndex?: RetentionIndex | null,
  ): Promise<void> {
    const index = suppliedIndex === undefined ? await readIndex() : suppliedIndex;
    const retained = index?.entries.some(
      (entry) => bankSpreadIdentityKey(bankSpreadEntryIdentity(entry)) === bankSpreadIdentityKey(identity),
    );
    if (retained) return;
    const path = recordPath(identity);
    await storage.remove(path);
    await storage.remove(`${path}.tmp`);
  }

  async function cleanupOrphans(
    retained: RetentionIndex,
    stillCurrent: () => boolean,
  ): Promise<boolean> {
    const keep = new Set(retained.entries.map((entry) =>
      recordPath(bankSpreadEntryIdentity(entry))));
    const files = await enumerateRecordFiles();
    if (!stillCurrent()) return false;
    for (const path of files) {
      if (keep.has(path)) continue;
      if (!stillCurrent()) return false;
      await storage.remove(path);
      if (!stillCurrent()) return false;
    }
    return true;
  }

  async function retainCurrent(
    current: VerifiedRecord,
    stillCurrent: () => boolean,
  ): Promise<boolean> {
    if (!stillCurrent()) return false;
    if (
      limits.maxEntries < 1 ||
      current.entry.compressed_bytes > limits.maxTotalCompressedBytes ||
      current.entry.encoded_bytes > limits.maxTotalEncodedBytes
    ) return false;
    await healTemporary(current);
    if (!stillCurrent()) return false;
    const previousIndex = await readIndex();
    if (!stillCurrent()) return false;
    const retained: RetainedEntry[] = [current.entry];
    let totalCompressed = current.entry.compressed_bytes;
    let totalEncoded = current.entry.encoded_bytes;
    for (const candidate of previousIndex?.entries ?? []) {
      if (retained.length >= limits.maxEntries) break;
      const identity = bankSpreadEntryIdentity(candidate);
      if (bankSpreadIdentityKey(identity) === bankSpreadIdentityKey(current.identity)) continue;
      const verified = await readVerifiedRecord(identity);
      if (!stillCurrent()) return false;
      if (!verified) continue;
      const nextCompressed = totalCompressed + verified.entry.compressed_bytes;
      const nextEncoded = totalEncoded + verified.entry.encoded_bytes;
      if (
        nextCompressed > limits.maxTotalCompressedBytes ||
        nextEncoded > limits.maxTotalEncodedBytes
      ) continue;
      await healTemporary(verified);
      if (!stillCurrent()) return false;
      retained.push(verified.entry);
      totalCompressed = nextCompressed;
      totalEncoded = nextEncoded;
    }
    const nextIndex: RetentionIndex = { schema_version: 1, entries: retained };
    await replaceIndex(nextIndex);
    if (!stillCurrent()) {
      await replaceIndex(previousIndex);
      return false;
    }
    if (!(await cleanupOrphans(nextIndex, stillCurrent))) {
      // Cleanup may already have deleted records excluded from nextIndex.  At
      // that point the previous index is no longer safe to restore because it
      // may reference one of those deleted records.  Leave the already
      // committed nextIndex in place; it contains only records that cleanup
      // deliberately retained, and the live generation will reorder it on
      // its next exact-key load/install.
      return false;
    }
    return true;
  }

  async function writeRecord(record: VerifiedRecord): Promise<void> {
    const path = recordPath(record.identity);
    await storage.write(`${path}.tmp`, serializeBankSpreadRecord(record));
    await storage.remove(path);
    await storage.move(`${path}.tmp`, path);
  }

  async function load(
    identity: BankSpreadCacheIdentity,
    stillCurrent: () => boolean,
  ): Promise<BankSpreadHistoryPayload | null> {
    return serialize(async () => {
      const record = await readVerifiedRecord(identity);
      if (!record) {
        if (!stillCurrent()) return null;
        const index = await readIndex();
        if (!stillCurrent()) return null;
        await cleanupOrphans(index ?? { schema_version: 1, entries: [] }, stillCurrent);
        return null;
      }
      if (!stillCurrent()) return null;
      if (!(await retainCurrent(record, stillCurrent)) || !stillCurrent()) return null;
      return record.payload;
    });
  }

  async function install(
    identity: BankSpreadCacheIdentity,
    verifiedRawBytes: Uint8Array,
    stillCurrent: () => boolean,
  ): Promise<boolean> {
    const candidate = await validateRawBankSpreadRecord(
      identity,
      verifiedRawBytes,
      'candidate',
      limits,
    );
    if (!candidate) throw new Error('Bank spread cache rejected unverified or oversized raw bytes');
    return serialize(async () => {
      if (!stillCurrent()) {
        await discardIfUnindexed(identity);
        return false;
      }
      const existing = await readVerifiedRecord(identity);
      if (!stillCurrent()) {
        await discardIfUnindexed(identity);
        return false;
      }
      if (existing && !sameBankSpreadBytes(existing.rawBytes, candidate.rawBytes)) {
        throw new Error('Bank spread content-address collision');
      }
      const record = existing ?? candidate;
      if (!existing) {
        await writeRecord(candidate);
        if (!stillCurrent()) {
          await discardIfUnindexed(identity);
          return false;
        }
        record.source = 'primary';
      }
      const retained = await retainCurrent(record, stillCurrent);
      if (!retained || !stillCurrent()) {
        await discardIfUnindexed(identity);
        return false;
      }
      return true;
    });
  }

  return { install, load };
}
