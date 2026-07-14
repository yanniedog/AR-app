// SDK 54 replaced the classic file API with a File/Directory API; the classic
// functions we use (documentDirectory, read/write/move/delete) live under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

import type { CorePayload, DetailsPayload, Manifest, PayloadSource } from '../types';
import type { SearchIndexPayload } from './detailSearch';
import type { BankInsightsPayload } from './bankInsights';
import type { HistoryBanksPayload } from './historyPayload';
import type { ProductHistoryPayload } from './productHistory';

const DIR = `${FileSystem.documentDirectory}payload/`;
const BUNDLE = `${DIR}core-bundle.json`;
const BUNDLE_TMP = `${BUNDLE}.tmp`;
const DETAILS = `${DIR}details.json`;
const SEARCH_INDEX = `${DIR}search-index.json`;
const HISTORY_BANKS = `${DIR}history-banks.json`;
const BANK_INSIGHTS = `${DIR}bank-history.json`;
const PRODUCT_HISTORY = `${DIR}product-history.json`;
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
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const text = await FileSystem.readAsStringAsync(path);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeCoreMeta(meta: CacheMeta): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(CORE_META_TMP, JSON.stringify(meta));
  await FileSystem.deleteAsync(CORE_META, { idempotent: true });
  await FileSystem.moveAsync({ from: CORE_META_TMP, to: CORE_META });
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
  await FileSystem.writeAsStringAsync(BUNDLE_TMP, contents);
  await FileSystem.deleteAsync(BUNDLE, { idempotent: true });
  await FileSystem.moveAsync({ from: BUNDLE_TMP, to: BUNDLE });
}

export const cache = {
  async readBundle(): Promise<CoreBundle | null> {
    let b = await readJson<CoreBundle>(BUNDLE);
    if (!b) b = await readJson<CoreBundle>(BUNDLE_TMP);
    if (!b || !b.meta || !b.core) return null;
    // Prefer the sidecar meta when present so detailsSha patches never require
    // rewriting the embedded bundle meta.
    const sidecar = await readCoreMetaSidecar();
    if (sidecar && sidecar.coreSha === b.meta.coreSha) {
      return { meta: sidecar, core: b.core };
    }
    return b;
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
      await FileSystem.deleteAsync(CORE_META, { idempotent: true });
      await FileSystem.deleteAsync(CORE_META_TMP, { idempotent: true });
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
    await FileSystem.writeAsStringAsync(DETAILS, json);
  },

  async readSearchIndex(): Promise<SearchIndexPayload | null> {
    return readJson<SearchIndexPayload>(SEARCH_INDEX);
  },

  async writeSearchIndex(json: string): Promise<void> {
    await ensureDir();
    await FileSystem.writeAsStringAsync(SEARCH_INDEX, json);
  },

  async readHistoryBanks(): Promise<HistoryBanksPayload | null> {
    return readJson<HistoryBanksPayload>(HISTORY_BANKS);
  },

  async clearHistoryBanks(): Promise<void> {
    await FileSystem.deleteAsync(HISTORY_BANKS, { idempotent: true });
  },

  async writeHistoryBanks(json: string): Promise<void> {
    await ensureDir();
    await FileSystem.writeAsStringAsync(HISTORY_BANKS, json);
  },

  async readBankInsights(): Promise<BankInsightsPayload | null> {
    return readJson<BankInsightsPayload>(BANK_INSIGHTS);
  },

  async writeBankInsights(json: string): Promise<void> {
    await ensureDir();
    await FileSystem.writeAsStringAsync(BANK_INSIGHTS, json);
  },

  async clearBankInsights(): Promise<void> {
    await FileSystem.deleteAsync(BANK_INSIGHTS, { idempotent: true });
  },

  async readProductHistory(): Promise<ProductHistoryPayload | null> {
    return readJson<ProductHistoryPayload>(PRODUCT_HISTORY);
  },

  async writeProductHistory(json: string): Promise<void> {
    await ensureDir();
    await FileSystem.writeAsStringAsync(PRODUCT_HISTORY, json);
  },

  async clearProductHistory(): Promise<void> {
    await FileSystem.deleteAsync(PRODUCT_HISTORY, { idempotent: true });
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
      await FileSystem.writeAsStringAsync(OPTIONAL_META, JSON.stringify(merged));
    });
  },

  async clear(): Promise<void> {
    await FileSystem.deleteAsync(DIR, { idempotent: true });
  },
};
