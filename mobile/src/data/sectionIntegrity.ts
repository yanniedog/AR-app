import type { CorePayload, RateRow, Ribbon, RibbonProvider, RibbonStats, SectionKey } from '../types';
import { attachBankRateHistoryTiers } from './bankRateHistoryWire';
import { withBundledBankRateHistory } from './bundledBankRateHistory';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

interface CoreContents { digest: string; history: CorePayload['bank_rate_history_catalogue']; detachedHistory: boolean }
const coreContents = new WeakMap<CoreIntegrityContext, CoreContents>();
const sealedHistories = new WeakSet<object>();
const sealingHistories = new WeakMap<object, Promise<boolean>>();

/** Transport JSON has plain data properties. Seal that graph once so its exact
 * object identity can remain bound without repeatedly serializing all history.
 * Accessors/custom objects retain full hashing instead of receiving this trust. */
function* sealHistorySteps(value: unknown): Generator<void, boolean, void> {
  if (value === null || typeof value !== 'object') return true;
  if (sealedHistories.has(value)) return true;
  const seen = new WeakSet<object>(), active = new WeakSet<object>();
  const pending: { value: object; exit: boolean }[] = [{ value, exit: false }];
  while (pending.length) {
    const next = pending.pop()!, item = next.value;
    if (next.exit) { active.delete(item); continue; }
    if (active.has(item)) return false;
    if (seen.has(item)) continue;
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== null && prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype)) return false;
    seen.add(item); active.add(item); pending.push({ value: item, exit: true });
    // Lock references before yielding; a child is inspected when visited.
    // A rejected graph is never marked sealed, even if some nodes froze.
    Object.freeze(item);
    for (const key of Reflect.ownKeys(item)) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value === 'function') return false;
      if (descriptor.value !== null && typeof descriptor.value === 'object') pending.push({ value: descriptor.value, exit: false });
      yield;
    }
  }
  sealedHistories.add(value);
  return true;
}

function sealHistory(value: unknown): boolean {
  const steps = sealHistorySteps(value);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

/** Await before exposing a freshly decoded core to application consumers. */
export async function sealCoreHistoryAsync(core: CorePayload,
  yieldWork: () => Promise<void> = async () => (await import('../lib/yieldToUi')).yieldToUi(0)): Promise<void> {
  const history = core.bank_rate_history_catalogue;
  if (!history || typeof history !== 'object' || sealedHistories.has(history)) return;
  let task = sealingHistories.get(history);
  if (!task) {
    task = (async () => {
      await yieldWork();
      const steps = sealHistorySteps(history);
      let result = steps.next(), count = 0, started = Date.now();
      while (!result.done) {
        if (++count % 32 === 0 && Date.now() - started >= 8) { await yieldWork(); started = Date.now(); }
        result = steps.next();
      }
      return result.value;
    })();
    sealingHistories.set(history, task);
  }
  try { await task; } finally { sealingHistories.delete(history); }
}

function contentDigest(core: CorePayload, detachedHistory: boolean) {
  const projection = detachedHistory ? { ...core } : core;
  if (detachedHistory) delete projection.bank_rate_history_catalogue;
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(projection))));
}

function bindCoreContents(core: CorePayload): CoreContents {
  const history = core.bank_rate_history_catalogue, detachedHistory = sealHistory(history);
  return { history, detachedHistory, digest: contentDigest(core, detachedHistory) };
}
/** Checked only at calculation boundaries, never by rendering selectors. */
export function verifiedCoreContents(integrity: CoreIntegrityContext | null | undefined): boolean {
  const bound = integrity && coreContents.get(integrity);
  return !!bound && bound.history === integrity!.core.bank_rate_history_catalogue &&
    bound.digest === contentDigest(integrity!.core, bound.detachedHistory);
}

export interface CoreIntegrityContext {
  schemaVersion: 1;
  /** The exact normalized object consumed by selectors and aggregates. */
  core: CorePayload;
  contract: 'v1' | 'v3';
  runDate: string;
  generationDigest: string | null;
  coreSha256: string | null;
  normalizationVersion: string;
  quarantines: {
    bankHistoryPairs: ReadonlySet<string>;
    rowsByReason: Readonly<Record<string, number>>;
    /** Exact changes to manifest summary dimensions caused by normalization. */
    countImpacts: Readonly<{
      rates: number;
      products: number;
      providers: number;
    }>;
  };
}

export interface CoreIntegrityProvenance {
  contract?: CoreIntegrityContext['contract'];
  generationDigest?: string | null;
  coreSha256?: string | null;
  normalizationVersion?: string;
}

export function bankHistoryPairKey(provider: string, section: SectionKey): string {
  return `${section}\u0000${provider}`;
}

/** Provider/section aggregates that cannot be separated safely after download. */
export function quarantinedBankHistoryPairs(
  integrity: CoreIntegrityContext | null | undefined,
): ReadonlySet<string> {
  return integrity?.quarantines.bankHistoryPairs ?? new Set<string>();
}

/**
 * Some data holders publish products explicitly named "Term Deposit" under the
 * broad TRANS_AND_SAVINGS_ACCOUNTS CDR category. The producer currently carries
 * that category through to the Savings section. Keep this rule deliberately
 * narrow: product names must begin with the product identity, so references to a
 * term deposit (for example, a loan "secured by a Term Deposit") and specialist
 * Farm Management Deposits are not reclassified.
 */
export function isExplicitTermDepositProduct(row: Pick<RateRow, 'product_name'>): boolean {
  const name = String(row.product_name || '')
    .trim()
    .replace(/\s+/g, ' ');
  return /^(?:fixed )?term deposit(?:\b|$)/i.test(name);
}

function stats(values: number[]): RibbonStats {
  if (!values.length) return { min: null, max: null, mean: null, median: null };
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2,
  };
}

function finiteRate(row: RateRow): number | null {
  if (row.rate == null || row.rate === '') return null;
  const value = Number(row.rate);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Rebuild the complete producer-shaped ribbon after quarantining rows. */
export function rebuildSectionRibbon(rows: readonly RateRow[]): Ribbon {
  const providerRows = new Map<string, RateRow[]>();
  const products = new Set<string>();
  const rates: number[] = [];

  for (const row of rows) {
    const rate = finiteRate(row);
    if (rate === null) continue;
    products.add(row.product_key);
    rates.push(rate);
    const provider = String(row.provider || 'Unknown');
    const grouped = providerRows.get(provider);
    if (grouped) grouped.push(row);
    else providerRows.set(provider, [row]);
  }

  const providers: RibbonProvider[] = [...providerRows.entries()]
    .map(([provider, grouped]) => ({
      provider,
      rates: grouped.length,
      products: new Set(grouped.map((row) => row.product_key)).size,
      ...stats(grouped.map(finiteRate).filter((value): value is number => value !== null)),
    }))
    .sort((left, right) => left.provider.localeCompare(right.provider));

  return {
    counts: {
      rates: rates.length,
      products: products.size,
      providers: providerRows.size,
    },
    range: stats(rates),
    providers,
  };
}

/**
 * Quarantine explicit term-deposit identities from Savings at the shared core
 * trust boundary. We intentionally do not move them into TD: their producer
 * taxonomy and term facets are also Savings-shaped, so presenting them as a
 * trustworthy TD record would invent data. A corrected producer payload can add
 * them back to TD later without any client migration.
 *
 * Returns the original object when no correction is needed. This keeps the hot
 * path cheap and makes repeated normalization idempotent by reference.
 */
export function normalizeCoreWithIntegrity(
  core: CorePayload,
  provenance: CoreIntegrityProvenance = {},
): { core: CorePayload; integrity: CoreIntegrityContext } {
  core = attachBankRateHistoryTiers(withBundledBankRateHistory(core, provenance.coreSha256));
  const savings = core?.sections?.Savings;
  const contaminated = savings && Array.isArray(savings.rates)
    ? savings.rates.filter(isExplicitTermDepositProduct)
    : [];
  const rates = savings && Array.isArray(savings.rates)
    ? savings.rates.filter((row) => !isExplicitTermDepositProduct(row))
    : null;

  const quarantinedPairs = new Set<string>(
    contaminated
      .map((row) => bankHistoryPairKey(row.provider, 'Savings')),
  );

  const normalized: CorePayload = savings && rates && rates.length !== savings.rates.length
    ? {
        ...core,
        sections: {
          ...core.sections,
          Savings: {
            ...savings,
            rates,
            ribbon: rebuildSectionRibbon(rates),
          },
        },
      }
    : core;
  const rawRows = Object.values(core.sections ?? {}).flatMap((section) => section.rates ?? []);
  const normalizedRows = Object.values(normalized.sections ?? {})
    .flatMap((section) => section.rates ?? []);
  const uniqueCount = (rowsToCount: readonly RateRow[], key: 'product_key' | 'provider') =>
    new Set(rowsToCount.map((row) => row[key]).filter(Boolean)).size;
  const integrity: CoreIntegrityContext = {
    schemaVersion: 1,
    core: normalized,
    contract: provenance.contract ?? 'v1',
    runDate: normalized.run_date,
    generationDigest: provenance.generationDigest ?? null,
    coreSha256: provenance.coreSha256 ?? null,
    normalizationVersion: provenance.normalizationVersion ?? 'app-section-integrity-v1',
    quarantines: {
      bankHistoryPairs: quarantinedPairs,
      rowsByReason: Object.freeze({
        explicit_term_deposit_in_savings: contaminated.length,
      }),
      countImpacts: Object.freeze({
        rates: rawRows.length - normalizedRows.length,
        products: uniqueCount(rawRows, 'product_key') - uniqueCount(normalizedRows, 'product_key'),
        providers: uniqueCount(rawRows, 'provider') - uniqueCount(normalizedRows, 'provider'),
      }),
    },
  };
  coreContents.set(integrity, bindCoreContents(normalized));
  return { core: normalized, integrity };
}

/**
 * Legacy adapter retained for fixtures and callers that only need normalized
 * rows. Trust-sensitive consumers must use `normalizeCoreWithIntegrity` and
 * carry its context explicitly.
 */
export function normalizeCoreSectionIntegrity(core: CorePayload): CorePayload {
  return normalizeCoreWithIntegrity(core).core;
}

/** Preserve trust evidence when a non-catalogue field creates a new core object. */
export function rebindCoreIntegrity(
  integrity: CoreIntegrityContext,
  core: CorePayload,
): CoreIntegrityContext {
  // Calendar checks usually return the same core. Keep its original digest and
  // context instead of serializing and hashing the entire catalogue twice.
  // verifiedCoreContents still detects any in-place mutation at calculation time.
  if (integrity.core === core) return integrity;
  const rebound: CoreIntegrityContext = {
    ...integrity,
    core,
    runDate: core.run_date,
  };
  if (verifiedCoreContents(integrity) && core.bank_rate_history_catalogue === integrity.core.bank_rate_history_catalogue) {
    coreContents.set(rebound, bindCoreContents(core));
  }
  return rebound;
}
