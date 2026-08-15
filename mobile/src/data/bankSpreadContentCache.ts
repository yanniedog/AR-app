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
/** Two authoritative slots plus one bounded transaction scratch slot. */
export const BANK_SPREAD_CACHE_SLOT_COUNT = BANK_SPREAD_CACHE_MAX_ENTRIES + 1;
export const BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
export const BANK_SPREAD_CACHE_MAX_INFLATED_BYTES = 64 * 1024 * 1024;
export const BANK_SPREAD_CACHE_MAX_TOTAL_COMPRESSED_BYTES =
  BANK_SPREAD_CACHE_MAX_ENTRIES * BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES;
/** Primary plus crash-recovery temporary file for each fixed slot. */
export const BANK_SPREAD_CACHE_MAX_PHYSICAL_RECORD_FILES = BANK_SPREAD_CACHE_SLOT_COUNT * 2;
export const BANK_SPREAD_CACHE_MAX_PHYSICAL_COMPRESSED_BYTES =
  BANK_SPREAD_CACHE_MAX_PHYSICAL_RECORD_FILES * BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES;
export const BANK_SPREAD_CACHE_MAX_ENCODED_BYTES =
  Math.ceil(BANK_SPREAD_CACHE_MAX_COMPRESSED_BYTES / 3) * 4;
export const BANK_SPREAD_CACHE_MAX_TOTAL_ENCODED_BYTES =
  BANK_SPREAD_CACHE_MAX_ENTRIES * BANK_SPREAD_CACHE_MAX_ENCODED_BYTES;
export const BANK_SPREAD_CACHE_MAX_PHYSICAL_ENCODED_BYTES =
  BANK_SPREAD_CACHE_MAX_PHYSICAL_RECORD_FILES * BANK_SPREAD_CACHE_MAX_ENCODED_BYTES;

export interface BankSpreadContentStorage {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
  remove(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  /** Retained for the filesystem adapter; fixed-slot cache logic never enumerates. */
  list(path: string): Promise<string[]>;
}

interface RetainedEntry extends BankSpreadStoredEntry {
  slot: number;
}

interface RetentionIndex {
  schema_version: 3;
  transaction_sequence: number;
  entries: RetainedEntry[];
}

interface BankSpreadCacheLimits {
  maxCompressedBytes: number;
  maxInflatedBytes: number;
  maxEntries: number;
  maxTotalCompressedBytes: number;
  maxEncodedBytes: number;
  maxTotalEncodedBytes: number;
}

interface VerifiedIndex {
  index: RetentionIndex;
  records: Map<number, VerifiedBankSpreadRecord>;
  source: 'primary' | 'temporary' | 'empty';
}

class CorruptRetentionIndexError extends Error {}

const MAX_TRANSACTION_SEQUENCE = Number.MAX_SAFE_INTEGER - 2;

function emptyIndex(): RetentionIndex {
  return { schema_version: 3, transaction_sequence: 0, entries: [] };
}

function sameIndex(left: RetentionIndex, right: RetentionIndex): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nextSequence(index: RetentionIndex, increments = 1): number {
  if (index.transaction_sequence > MAX_TRANSACTION_SEQUENCE - increments) {
    throw new Error('Bank spread retention transaction sequence is exhausted');
  }
  return index.transaction_sequence + increments;
}

function sameEntry(left: BankSpreadStoredEntry, right: BankSpreadStoredEntry): boolean {
  return (
    left.core_sha256 === right.core_sha256 &&
    left.bank_spread_history_sha256 === right.bank_spread_history_sha256 &&
    left.run_date === right.run_date &&
    left.compressed_bytes === right.compressed_bytes &&
    left.encoded_bytes === right.encoded_bytes
  );
}

function parseIndex(raw: string | null, limits: BankSpreadCacheLimits): RetentionIndex | null {
  if (!raw || raw.length > limits.maxEntries * 512 + 128) return null;
  try {
    const value = JSON.parse(raw) as Partial<RetentionIndex>;
    if (
      value.schema_version !== 3 ||
      !Number.isSafeInteger(value.transaction_sequence) ||
      (value.transaction_sequence as number) < 0 ||
      (value.transaction_sequence as number) > MAX_TRANSACTION_SEQUENCE ||
      !Array.isArray(value.entries)
    ) return null;
    if (value.entries.length > limits.maxEntries) return null;
    const keys = new Set<string>();
    const slots = new Set<number>();
    let compressedBytes = 0;
    let encodedBytes = 0;
    for (const entry of value.entries) {
      if (!entry || typeof entry !== 'object') return null;
      const identity = bankSpreadEntryIdentity(entry);
      if (
        !validBankSpreadIdentity(identity) ||
        !Number.isSafeInteger(entry.slot) ||
        entry.slot < 0 ||
        entry.slot >= BANK_SPREAD_CACHE_SLOT_COUNT ||
        !Number.isSafeInteger(entry.compressed_bytes) ||
        entry.compressed_bytes <= 0 ||
        entry.compressed_bytes > limits.maxCompressedBytes ||
        !Number.isSafeInteger(entry.encoded_bytes) ||
        entry.encoded_bytes <= 0 ||
        entry.encoded_bytes > limits.maxEncodedBytes
      ) return null;
      const key = bankSpreadIdentityKey(identity);
      if (keys.has(key) || slots.has(entry.slot)) return null;
      keys.add(key);
      slots.add(entry.slot);
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

  const slotPath = (slot: number) => `${recordsRoot}/slot-${slot}.json`;

  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = mutationChain.then(fn, fn);
    mutationChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async function readSlot(
    entry: RetainedEntry,
  ): Promise<VerifiedBankSpreadRecord | null> {
    const identity = bankSpreadEntryIdentity(entry);
    const path = slotPath(entry.slot);
    const primary = await validateStoredBankSpreadRecord(
      await storage.read(path),
      identity,
      'primary',
      limits,
    );
    const record = primary ?? await validateStoredBankSpreadRecord(
      await storage.read(`${path}.tmp`),
      identity,
      'temporary',
      limits,
    );
    return record && sameEntry(record.entry, entry) ? record : null;
  }

  async function verifyIndex(
    index: RetentionIndex,
    source: VerifiedIndex['source'],
  ): Promise<VerifiedIndex | null> {
    const records = new Map<number, VerifiedBankSpreadRecord>();
    for (const entry of index.entries) {
      const record = await readSlot(entry);
      if (!record) return null;
      records.set(entry.slot, record);
    }
    return { index, records, source };
  }

  async function readVerifiedIndex(): Promise<VerifiedIndex> {
    const primaryRaw = await storage.read(indexPath);
    const temporaryRaw = await storage.read(indexTmpPath);
    const primary = parseIndex(primaryRaw, limits);
    const temporary = parseIndex(temporaryRaw, limits);
    if (primaryRaw === null && temporaryRaw === null) {
      return { index: emptyIndex(), records: new Map(), source: 'empty' };
    }

    const verified = (
      await Promise.all([
        primary ? verifyIndex(primary, 'primary') : Promise.resolve(null),
        temporary ? verifyIndex(temporary, 'temporary') : Promise.resolve(null),
      ])
    ).filter((candidate): candidate is VerifiedIndex => candidate !== null);
    if (verified.length === 2) {
      const [left, right] = verified;
      if (left.index.transaction_sequence === right.index.transaction_sequence) {
        if (!sameIndex(left.index, right.index)) {
          throw new CorruptRetentionIndexError(
            'Bank spread retention index has an ambiguous transaction sequence',
          );
        }
        return left.source === 'primary' ? left : right;
      }
      return left.index.transaction_sequence > right.index.transaction_sequence ? left : right;
    }
    if (verified.length === 1) return verified[0];
    throw new CorruptRetentionIndexError(
      'Bank spread retention index is corrupt or references invalid slots',
    );
  }

  async function replaceIndex(index: RetentionIndex): Promise<void> {
    await storage.write(indexTmpPath, JSON.stringify(index));
    await storage.remove(indexPath);
    await storage.move(indexTmpPath, indexPath);
  }

  async function healIndex(state: VerifiedIndex): Promise<void> {
    if (state.source === 'temporary') {
      await storage.remove(indexPath);
      await storage.move(indexTmpPath, indexPath);
      state.source = 'primary';
      return;
    }
    if (state.source === 'primary') await storage.remove(indexTmpPath);
  }

  async function ensureSequenceCapacity(
    state: VerifiedIndex,
    requiredIncrements = 2,
  ): Promise<VerifiedIndex> {
    if (state.index.transaction_sequence <= MAX_TRANSACTION_SEQUENCE - requiredIncrements) {
      return state;
    }
    const rebased = { ...state.index, transaction_sequence: 0 };
    await replaceIndex(rebased);
    return { ...state, index: rebased, source: 'primary' };
  }

  async function healSlot(slot: number, record: VerifiedBankSpreadRecord): Promise<void> {
    const path = slotPath(slot);
    if (record.source === 'temporary') {
      await storage.remove(path);
      await storage.move(`${path}.tmp`, path);
      record.source = 'primary';
      return;
    }
    await storage.remove(`${path}.tmp`);
  }

  async function writeSlot(slot: number, record: VerifiedBankSpreadRecord): Promise<void> {
    const path = slotPath(slot);
    await storage.write(`${path}.tmp`, serializeBankSpreadRecord(record));
    await storage.remove(path);
    await storage.move(`${path}.tmp`, path);
    record.source = 'primary';
  }

  function entryFor(slot: number, record: VerifiedBankSpreadRecord): RetainedEntry {
    return { ...record.entry, slot };
  }

  async function buildNextIndex(
    currentSlot: number,
    current: VerifiedBankSpreadRecord,
    previous: VerifiedIndex,
  ): Promise<RetentionIndex> {
    const entries: RetainedEntry[] = [entryFor(currentSlot, current)];
    let totalCompressed = current.entry.compressed_bytes;
    let totalEncoded = current.entry.encoded_bytes;
    for (const candidate of previous.index.entries) {
      if (entries.length >= limits.maxEntries) break;
      if (candidate.slot === currentSlot) continue;
      const record = previous.records.get(candidate.slot);
      if (!record) continue;
      if (bankSpreadIdentityKey(record.identity) === bankSpreadIdentityKey(current.identity)) continue;
      const nextCompressed = totalCompressed + record.entry.compressed_bytes;
      const nextEncoded = totalEncoded + record.entry.encoded_bytes;
      if (
        nextCompressed > limits.maxTotalCompressedBytes ||
        nextEncoded > limits.maxTotalEncodedBytes
      ) continue;
      await healSlot(candidate.slot, record);
      entries.push(entryFor(candidate.slot, record));
      totalCompressed = nextCompressed;
      totalEncoded = nextEncoded;
    }
    return {
      schema_version: 3,
      transaction_sequence: nextSequence(previous.index),
      entries,
    };
  }

  async function commitIndex(
    previous: VerifiedIndex,
    next: RetentionIndex,
    stillCurrent: () => boolean,
  ): Promise<boolean> {
    if (!stillCurrent()) return false;
    await replaceIndex(next);
    if (stillCurrent()) return true;
    await replaceIndex({
      ...previous.index,
      transaction_sequence: nextSequence(next),
    });
    return false;
  }

  async function readStructuralRepairState(): Promise<{
    preferred: RetentionIndex | null;
    maximumSequence: number;
  }> {
    const primary = parseIndex(await storage.read(indexPath), limits);
    const temporary = parseIndex(await storage.read(indexTmpPath), limits);
    if (primary && temporary) {
      if (primary.transaction_sequence === temporary.transaction_sequence) {
        return {
          preferred: sameIndex(primary, temporary) ? primary : null,
          maximumSequence: primary.transaction_sequence,
        };
      }
      return {
        preferred: primary.transaction_sequence > temporary.transaction_sequence ? primary : temporary,
        maximumSequence: Math.max(primary.transaction_sequence, temporary.transaction_sequence),
      };
    }
    const preferred = primary ?? temporary;
    return {
      preferred,
      maximumSequence: preferred?.transaction_sequence ?? 0,
    };
  }

  async function verifiedRepairEntries(
    structural: RetentionIndex | null,
  ): Promise<{ entry: RetainedEntry; record: VerifiedBankSpreadRecord }[]> {
    if (!structural) return [];
    const entries: { entry: RetainedEntry; record: VerifiedBankSpreadRecord }[] = [];
    for (const entry of structural.entries) {
      const record = await readSlot(entry);
      if (record) entries.push({ entry, record });
    }
    return entries;
  }

  async function repairCorruptIndex(
    candidate: VerifiedBankSpreadRecord,
    stillCurrent: () => boolean,
  ): Promise<boolean> {
    const structural = await readStructuralRepairState();
    const salvage = await verifiedRepairEntries(structural.preferred);
    if (!stillCurrent()) return false;

    const candidateKey = bankSpreadIdentityKey(candidate.identity);
    const exact = structural.preferred?.entries.find(
      (entry) => bankSpreadIdentityKey(bankSpreadEntryIdentity(entry)) === candidateKey,
    );
    const used = new Set(salvage.map(({ entry }) => entry.slot));
    const slot = exact?.slot ?? Array.from(
      { length: BANK_SPREAD_CACHE_SLOT_COUNT },
      (_, index) => index,
    ).find((value) => !used.has(value));
    if (!Number.isSafeInteger(slot)) {
      throw new Error('Bank spread cache has no repair scratch slot');
    }

    await writeSlot(slot as number, candidate);
    if (!stillCurrent()) return false;

    const baseSequence = structural.maximumSequence <= MAX_TRANSACTION_SEQUENCE - 2
      ? structural.maximumSequence
      : 0;
    const repairedBase: VerifiedIndex = {
      index: {
        schema_version: 3,
        transaction_sequence: baseSequence,
        entries: salvage
          .filter(({ entry }) => entry.slot !== slot)
          .map(({ entry }) => entry),
      },
      records: new Map(
        salvage
          .filter(({ entry }) => entry.slot !== slot)
          .map(({ entry, record }) => [entry.slot, record]),
      ),
      source: 'empty',
    };
    const repaired = await buildNextIndex(slot as number, candidate, repairedBase);
    await replaceIndex(repaired);
    if (stillCurrent()) return true;

    await replaceIndex({
      ...repairedBase.index,
      transaction_sequence: nextSequence(repaired),
    });
    return false;
  }

  async function load(
    identity: BankSpreadCacheIdentity,
    stillCurrent: () => boolean,
  ): Promise<BankSpreadHistoryPayload | null> {
    return serialize(async () => {
      if (!validBankSpreadIdentity(identity) || !stillCurrent()) return null;
      let previous = await readVerifiedIndex();
      if (!stillCurrent()) return null;
      await healIndex(previous);
      const entry = previous.index.entries.find(
        (candidate) => bankSpreadIdentityKey(bankSpreadEntryIdentity(candidate)) ===
          bankSpreadIdentityKey(identity),
      );
      if (!entry) return null;
      const record = previous.records.get(entry.slot);
      if (!record) return null;
      await healSlot(entry.slot, record);
      if (!stillCurrent()) return null;
      if (previous.index.entries[0]?.slot === entry.slot) return record.payload;
      previous = await ensureSequenceCapacity(previous);
      if (!stillCurrent()) return null;
      const next = await buildNextIndex(entry.slot, record, previous);
      if (!(await commitIndex(previous, next, stillCurrent))) return null;
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
      if (!stillCurrent()) return false;
      let previous: VerifiedIndex;
      try {
        previous = await readVerifiedIndex();
      } catch (error) {
        if (!(error instanceof CorruptRetentionIndexError)) throw error;
        return repairCorruptIndex(candidate, stillCurrent);
      }
      if (!stillCurrent()) return false;
      await healIndex(previous);
      previous = await ensureSequenceCapacity(previous);
      if (!stillCurrent()) return false;
      const existingEntry = previous.index.entries.find(
        (entry) => bankSpreadIdentityKey(bankSpreadEntryIdentity(entry)) ===
          bankSpreadIdentityKey(identity),
      );
      let slot: number;
      let record: VerifiedBankSpreadRecord;
      if (existingEntry) {
        slot = existingEntry.slot;
        record = previous.records.get(slot) as VerifiedBankSpreadRecord;
        if (!sameBankSpreadBytes(record.rawBytes, candidate.rawBytes)) {
          throw new Error('Bank spread content-address collision');
        }
        await healSlot(slot, record);
      } else {
        const used = new Set(previous.index.entries.map((entry) => entry.slot));
        slot = Array.from({ length: BANK_SPREAD_CACHE_SLOT_COUNT }, (_, index) => index)
          .find((value) => !used.has(value)) as number;
        if (!Number.isSafeInteger(slot)) {
          throw new Error('Bank spread cache has no transaction scratch slot');
        }
        record = candidate;
        await writeSlot(slot, record);
      }
      if (!stillCurrent()) return false;
      const next = await buildNextIndex(slot, record, previous);
      return commitIndex(previous, next, stillCurrent);
    });
  }

  return { install, load };
}
