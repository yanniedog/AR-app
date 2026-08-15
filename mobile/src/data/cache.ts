// SDK 54 replaced the classic file API with a File/Directory API; the classic
// functions we use (documentDirectory, read/write/move/delete) live under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { CorePayload, DetailsPayload, Manifest, PayloadSource } from '../types';
import { HEAVY_JSON_BYTES, parseJsonHeavy } from '../lib/yieldToUi';
import type { SearchIndexPayload } from './detailSearch';
import type { BankInsightsPayload } from './bankInsights';
import type { BankSpreadHistoryPayload } from './bankSpreadHistory';
import type { HistoryBanksPayload } from './historyPayload';
import { normalizeProductHistoryPayload, type ProductHistoryPayload } from './productHistory';
import type { EconomicOutlookPayload } from './economicOutlook';
import type { PersistedSuitabilityIndex } from './suitabilityIndex';
import { normalizeCoreWithIntegrity, type CoreIntegrityContext } from './sectionIntegrity';
import { createV3GenerationCache } from './v3GenerationCache';

const IS_WEB = Platform.OS === 'web';
const DIR = IS_WEB ? 'ar-rates:payload/' : `${FileSystem.documentDirectory}payload/`;
const BUNDLE = `${DIR}core-bundle.json`;
const BUNDLE_TMP = `${BUNDLE}.tmp`;
const DETAILS = `${DIR}details.json`;
const SEARCH_INDEX = `${DIR}search-index.json`;
const HISTORY_BANKS = `${DIR}history-banks.json`;
const BANK_INSIGHTS = `${DIR}bank-history.json`;
const BANK_SPREAD_HISTORY = `${DIR}bank-spread-history.json`;
const PRODUCT_HISTORY = `${DIR}product-history.json`;
const PRODUCT_HISTORY_TMP = `${PRODUCT_HISTORY}.tmp`;
const ECONOMIC_OUTLOOK = `${DIR}rba-economic-outlook.json`;
const SUITABILITY_INDEX = `${DIR}suitability-index.json`;
const SUITABILITY_INDEX_TMP = `${SUITABILITY_INDEX}.tmp`;
// Tiny sidecars so metadata reads/writes never re-parse or re-stringify the
// multi-MB core bundle (the old updateMeta path blocked the JS thread for
// seconds after every fresh ingest when detailsSha was patched).
const CORE_META = `${DIR}core-meta.json`;
const CORE_META_TMP = `${CORE_META}.tmp`;
// Optional-asset content hashes live in a tiny sidecar so updating them never
// rewrites the multi-MB core bundle. Keyed by coreSha so a new core run
// automatically invalidates stale optional hashes.
const OPTIONAL_META = `${DIR}optional-meta.json`;

export interface OptionalMeta {
  coreSha: string;
  searchIndexSha?: string | null;
  historyBanksSha?: string | null;
  bankInsightsSha?: string | null;
  bankSpreadHistorySha?: string | null;
}

export interface CacheMeta {
  manifest: Manifest;
  source: PayloadSource;
  savedAt: string;
  coreSha: string;
  detailsSha: string | null;
  searchIndexSha?: string | null;
  historyBanksSha?: string | null;
  bankInsightsSha?: string | null;
}

export interface CoreBundle {
  meta: CacheMeta;
  core: CorePayload;
  integrity: CoreIntegrityContext;
}

async function ensureDir(): Promise<void> {
  if (IS_WEB) return;
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

const webMemory = new Map<string, string>();
let webDbPromise: Promise<IDBDatabase | null> | null = null;

function webDb(): Promise<IDBDatabase | null> {
  if (webDbPromise) return webDbPromise;
  webDbPromise = new Promise((resolve) => {
    if (typeof globalThis.indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = globalThis.indexedDB.open('australian-rates-cache', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files')) {
        request.result.createObjectStore('files');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return webDbPromise;
}

async function webGet(path: string): Promise<string | null> {
  const memory = webMemory.get(path);
  if (memory != null) return memory;
  const db = await webDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction('files').objectStore('files').get(path);
    request.onsuccess = () => {
      const value = typeof request.result === 'string' ? request.result : null;
      if (value != null) webMemory.set(path, value);
      resolve(value);
    };
    request.onerror = () => resolve(null);
  });
}

async function webSet(path: string, value: string): Promise<void> {
  webMemory.set(path, value);
  const db = await webDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const request = db.transaction('files', 'readwrite').objectStore('files').put(value, path);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

async function webDelete(path: string): Promise<void> {
  const db = await webDb();
  if (path !== DIR) {
    webMemory.delete(path);
    if (!db) return;
    await new Promise<void>((resolve) => {
      const request = db.transaction('files', 'readwrite').objectStore('files').delete(path);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
    return;
  }

  for (const key of [...webMemory.keys()]) {
    if (key.startsWith(DIR)) webMemory.delete(key);
  }
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.getAllKeys();
    request.onsuccess = () => {
      request.result.forEach((key) => {
        if (typeof key === 'string' && key.startsWith(DIR)) store.delete(key);
      });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

async function pathExists(path: string): Promise<boolean> {
  if (IS_WEB) return (await webGet(path)) != null;
  return (await FileSystem.getInfoAsync(path)).exists;
}

async function readText(path: string): Promise<string> {
  if (IS_WEB) {
    const value = await webGet(path);
    if (value == null) throw new Error(`Cache entry is unavailable: ${path}`);
    return value;
  }
  return FileSystem.readAsStringAsync(path);
}

async function writeText(path: string, value: string): Promise<void> {
  if (IS_WEB) {
    await webSet(path, value);
    return;
  }
  await FileSystem.writeAsStringAsync(path, value);
}

async function ensureParentDirectory(path: string): Promise<void> {
  if (IS_WEB) return;
  const separator = path.lastIndexOf('/');
  if (separator < 0) return;
  const parent = path.slice(0, separator + 1);
  const info = await FileSystem.getInfoAsync(parent);
  if (!info.exists) await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
}

async function deletePath(path: string): Promise<void> {
  if (IS_WEB) {
    await webDelete(path);
    return;
  }
  await FileSystem.deleteAsync(path, { idempotent: true });
}

async function movePath(from: string, to: string): Promise<void> {
  if (IS_WEB) {
    const value = await webGet(from);
    if (value == null) throw new Error(`Cache entry is unavailable: ${from}`);
    await webSet(to, value);
    await webDelete(from);
    return;
  }
  await FileSystem.moveAsync({ from, to });
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!(await pathExists(path))) return null;
    const text = await readText(path);
    // Multi-MB core/details must not freeze tab navigation mid-parse.
    if (text.length >= HEAVY_JSON_BYTES) {
      return await parseJsonHeavy<T>(text);
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeCoreMeta(meta: CacheMeta): Promise<void> {
  await ensureDir();
  await writeText(CORE_META_TMP, JSON.stringify(meta));
  await deletePath(CORE_META);
  await movePath(CORE_META_TMP, CORE_META);
}

async function readCoreMetaSidecar(): Promise<CacheMeta | null> {
  const primary = await readJson<CacheMeta>(CORE_META);
  if (isCacheMeta(primary)) return primary;
  // Crash window after writeCoreMeta wrote the tmp but before moveAsync finished.
  const tmp = await readJson<CacheMeta>(CORE_META_TMP);
  return isCacheMeta(tmp) ? tmp : null;
}

function isCacheMeta(value: unknown): value is CacheMeta {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<CacheMeta>;
  const manifest = m.manifest as Manifest | undefined;
  return (
    !!manifest &&
    typeof manifest === 'object' &&
    typeof manifest.generated_at === 'string' &&
    typeof m.coreSha === 'string' &&
    typeof m.source === 'string'
  );
}

let writeChain: Promise<void> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function atomicWriteBundle(contents: string): Promise<void> {
  await ensureDir();
  await writeText(BUNDLE_TMP, contents);
  await deletePath(BUNDLE);
  await movePath(BUNDLE_TMP, BUNDLE);
}

export const cache = {
  async readBundle(): Promise<CoreBundle | null> {
    let b = await readJson<CoreBundle>(BUNDLE);
    if (!b) b = await readJson<CoreBundle>(BUNDLE_TMP);
    if (!b || !b.meta || !b.core) return null;
    // Prefer the sidecar meta when present so detailsSha patches never require
    // rewriting the embedded bundle meta.
    const sidecar = await readCoreMetaSidecar();
    const normalized = normalizeCoreWithIntegrity(b.core, {
      coreSha256: b.meta.coreSha,
      generationDigest: b.meta.coreSha,
    });
    if (sidecar && sidecar.coreSha === b.meta.coreSha) {
      return { meta: sidecar, core: normalized.core, integrity: normalized.integrity };
    }
    return { ...b, core: normalized.core, integrity: normalized.integrity };
  },

  async readMeta(): Promise<CacheMeta | null> {
    const sidecar = await readCoreMetaSidecar();
    if (sidecar) return sidecar;
    // Older installs only embed meta in the multi-MB bundle. Also covers the
    // crash window after writeBundle deleted the sidecar / committed a new
    // bundle but before writeCoreMeta finished — fall back to embedded meta
    // (avoid a write here so readMeta stays side-effect free under serialize()).
    // Mirror readBundle: prefer the main bundle, then the tmp file if a crash
    // happened between writing BUNDLE_TMP and moving it into place.
    const fromBundle =
      (await readJson<CoreBundle>(BUNDLE))?.meta ??
      (await readJson<CoreBundle>(BUNDLE_TMP))?.meta ??
      null;
    return isCacheMeta(fromBundle) ? fromBundle : null;
  },

  async readCore(): Promise<CorePayload | null> {
    return (await cache.readBundle())?.core ?? null;
  },

  async readDetails(): Promise<DetailsPayload | null> {
    return readJson<DetailsPayload>(DETAILS);
  },

  async writeBundle(meta: CacheMeta, coreText: string): Promise<void> {
    return serialize(async () => {
      // Drop any prior sidecar first so a crash after the new bundle lands cannot
      // leave readMeta trusting stale detailsSha/coreSha from the old run.
      await deletePath(CORE_META);
      await deletePath(CORE_META_TMP);
      // Commit the bundle, then the sidecar. If we crash between the two,
      // readMeta falls back to the embedded meta in the new bundle.
      await atomicWriteBundle(`{"meta":${JSON.stringify(meta)},"core":${coreText}}`);
      // Sidecar is an optimization; a failed write must not fail refresh after
      // the multi-MB bundle is already committed (embedded meta remains valid).
      try {
        await writeCoreMeta(meta);
      } catch {
        // leave CORE_META_TMP if present — readCoreMetaSidecar recovers it
      }
    });
  },

  /**
   * Patch cache metadata (e.g. detailsSha after warming details). Writes only the
   * tiny core-meta sidecar — never re-parses or re-serializes the multi-MB core.
   */
  async updateMeta(meta: Partial<CacheMeta> & { coreSha: string; manifest: Manifest }): Promise<void> {
    return serialize(async () => {
      const existing = await cache.readMeta();
      if (!existing) return;
      if (existing.coreSha !== meta.coreSha) return;
      if (existing.manifest.generated_at > meta.manifest.generated_at) return;
      const merged: CacheMeta = { ...existing, ...meta };
      await writeCoreMeta(merged);
    });
  },

  async writeDetails(json: string): Promise<void> {
    await ensureDir();
    await writeText(DETAILS, json);
  },

  async readSearchIndex(): Promise<SearchIndexPayload | null> {
    return readJson<SearchIndexPayload>(SEARCH_INDEX);
  },

  async writeSearchIndex(json: string): Promise<void> {
    await ensureDir();
    await writeText(SEARCH_INDEX, json);
  },

  async readHistoryBanks(): Promise<HistoryBanksPayload | null> {
    return readJson<HistoryBanksPayload>(HISTORY_BANKS);
  },

  async clearHistoryBanks(): Promise<void> {
    await deletePath(HISTORY_BANKS);
  },

  async writeHistoryBanks(json: string): Promise<void> {
    await ensureDir();
    await writeText(HISTORY_BANKS, json);
  },

  async readBankInsights(): Promise<BankInsightsPayload | null> {
    return readJson<BankInsightsPayload>(BANK_INSIGHTS);
  },

  async writeBankInsights(json: string): Promise<void> {
    await ensureDir();
    await writeText(BANK_INSIGHTS, json);
  },

  async clearBankInsights(): Promise<void> {
    await deletePath(BANK_INSIGHTS);
  },

  async readBankSpreadHistory(): Promise<BankSpreadHistoryPayload | null> {
    return readJson<BankSpreadHistoryPayload>(BANK_SPREAD_HISTORY);
  },

  async writeBankSpreadHistory(json: string): Promise<void> {
    await ensureDir();
    await writeText(BANK_SPREAD_HISTORY, json);
  },

  async clearBankSpreadHistory(): Promise<void> {
    await deletePath(BANK_SPREAD_HISTORY);
  },

  async readProductHistory(): Promise<ProductHistoryPayload | null> {
    const primary = normalizeProductHistoryPayload(
      await readJson<ProductHistoryPayload>(PRODUCT_HISTORY),
    );
    if (primary) return primary;
    // Recover the last complete checkpoint if the app stopped between writing
    // the temp file and moving it over the primary path.
    const recovered = normalizeProductHistoryPayload(
      await readJson<ProductHistoryPayload>(PRODUCT_HISTORY_TMP),
    );
    if (!recovered) await deletePath(PRODUCT_HISTORY_TMP);
    return recovered;
  },

  async writeProductHistory(json: string): Promise<void> {
    return serialize(async () => {
      await ensureDir();
      await writeText(PRODUCT_HISTORY_TMP, json);
      await deletePath(PRODUCT_HISTORY);
      await movePath(PRODUCT_HISTORY_TMP, PRODUCT_HISTORY);
    });
  },

  async clearProductHistory(): Promise<void> {
    return serialize(async () => {
      await deletePath(PRODUCT_HISTORY);
      await deletePath(PRODUCT_HISTORY_TMP);
    });
  },

  async readEconomicOutlook(): Promise<EconomicOutlookPayload | null> {
    return readJson<EconomicOutlookPayload>(ECONOMIC_OUTLOOK);
  },

  async writeEconomicOutlook(payload: EconomicOutlookPayload): Promise<void> {
    await ensureDir();
    await writeText(ECONOMIC_OUTLOOK, JSON.stringify(payload));
  },

  async readSuitabilityIndex(): Promise<PersistedSuitabilityIndex | null> {
    return readJson<PersistedSuitabilityIndex>(SUITABILITY_INDEX);
  },

  async writeSuitabilityIndex(payload: PersistedSuitabilityIndex): Promise<void> {
    return serialize(async () => {
      await ensureDir();
      await writeText(SUITABILITY_INDEX_TMP, JSON.stringify(payload));
      await deletePath(SUITABILITY_INDEX);
      await movePath(SUITABILITY_INDEX_TMP, SUITABILITY_INDEX);
    });
  },

  async readOptionalMeta(): Promise<OptionalMeta | null> {
    return readJson<OptionalMeta>(OPTIONAL_META);
  },

  /**
   * Merge optional-asset hashes into the sidecar. When the coreSha changes the
   * file is replaced wholesale so hashes from a previous core can never be
   * mistaken for the current one. Serialized against the write chain so
   * concurrent prefetch writers don't clobber each other.
   */
  async writeOptionalMeta(patch: OptionalMeta): Promise<void> {
    return serialize(async () => {
      await ensureDir();
      const existing = await readJson<OptionalMeta>(OPTIONAL_META);
      const base = existing && existing.coreSha === patch.coreSha ? existing : { coreSha: patch.coreSha };
      const merged: OptionalMeta = { ...base, ...patch };
      await writeText(OPTIONAL_META, JSON.stringify(merged));
    });
  },

  async clear(): Promise<void> {
    await deletePath(DIR);
  },
};

/** Dormant v3 content-addressed cache; no production network path writes it. */
export const v3GenerationCache = createV3GenerationCache(
  {
    async read(path) {
      try {
        return (await pathExists(path)) ? await readText(path) : null;
      } catch {
        return null;
      }
    },
    async write(path, value) {
      await ensureDir();
      await ensureParentDirectory(path);
      await writeText(path, value);
    },
    async remove(path) {
      await deletePath(path);
    },
    async move(from, to) {
      await ensureParentDirectory(to);
      await movePath(from, to);
    },
  },
  `${DIR}v3`,
);
