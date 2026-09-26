import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { CorePayload, Manifest } from '../types';
import { PAYLOAD_REPO } from '../config';
import { debugLog } from '../lib/debugLog';
import { yieldToUi } from '../lib/yieldToUi';
import { cache } from './cache';
import { parseDatesIndex, type DatesIndex } from './datesIndex';
import { downloadDatedCore } from './historyDaily';
import { assertHistoricalIdentitiesAdvance, historicalSourceIdentity } from './historyIdentity';
import { assertRevisionManifest } from './payloadRevision';
import { clearSupplementaryBankRateHistory, installSupplementaryBankRateHistory, packedBankRateHistory } from './bankRateHistory';
import { getBundledPortableBankRateHistory, mergePortableBankRateHistory, projectPortableBankRateHistory,
  validatePortableBankRateHistory, type PortableBankRateHistory } from './portableBankRateHistory';
import * as bundled from './portableBankRateHistory.snapshot.json';

interface SavedHistory {
  schema_version: 1;
  /** A staged later day must not replace the still-installed day's identity. */
  core_bindings: Record<string, { core_sha256: string; manifest_sha256: string }>;
  index: DatesIndex;
  portable: PortableBankRateHistory;
}
const MAX_CACHE_CHARS = 48 * 1024 * 1024;
// One binding per calendar day, bounded by the portable history date budget.
const MAX_CORE_BINDINGS = 5000;
const SHA = /^[a-f0-9]{64}$/;
const digest = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));
let preparation = Promise.resolve(false);

export function decodeSavedBankRateHistory(text: string | null): SavedHistory | null {
  try {
    if (!text || text.length > MAX_CACHE_CHARS) return null;
    const envelope = JSON.parse(text);
    if (typeof envelope.payload !== 'string' || digest(envelope.payload) !== envelope.sha256) return null;
    const value = JSON.parse(envelope.payload) as SavedHistory;
    const index = parseDatesIndex(value.index);
    if (value.schema_version !== 1 || !index?.revision_heads || !validatePortableBankRateHistory(value.portable) ||
        !value.core_bindings || typeof value.core_bindings !== 'object' || Array.isArray(value.core_bindings)) return null;
    const bindings = Object.entries(value.core_bindings);
    if (!bindings.length || bindings.length > MAX_CORE_BINDINGS || bindings.some(([day, binding]) =>
      !binding || typeof binding.core_sha256 !== 'string' || !SHA.test(binding.core_sha256) ||
      typeof binding.manifest_sha256 !== 'string' || !SHA.test(binding.manifest_sha256) ||
      index.revision_heads![day]?.manifest_sha256 !== binding.manifest_sha256)) return null;
    return { ...value, index };
  } catch { return null; }
}

function encodeSavedBankRateHistory(value: SavedHistory): string {
  const payload = JSON.stringify(value);
  return JSON.stringify({ sha256: digest(payload), payload });
}

function currentMatches(core: CorePayload, manifest: Manifest, index: DatesIndex): boolean {
  try {
    if (core.run_date !== manifest.run_date) return false;
    const head = index.revision_heads?.[core.run_date];
    if (!head) return false;
    assertRevisionManifest(manifest, head, core.run_date, PAYLOAD_REPO);
    return true;
  } catch { return false; }
}

function assertIndexAdvances(index: DatesIndex, previous: DatesIndex): void {
  const dates = Object.keys(previous.revision_heads ?? {}).filter(day => day <= index.latest_date);
  assertHistoricalIdentitiesAdvance(index, dates, Object.fromEntries(
    dates.map(day => [day, historicalSourceIdentity(previous, day)]),
  ));
}

function sameHistoryHeads(left: DatesIndex, right: DatesIndex, target: string): boolean {
  const days = left.dates.filter(day => day <= target);
  const other = right.dates.filter(day => day <= target);
  return days.length === other.length && days.every(day =>
    historicalSourceIdentity(left, day) === historicalSourceIdentity(right, day));
}

/** Fully prepare every bank before adopting the catalogue. A fresh publication
 * supplies the index; offline bootstrap may reuse only its exact saved edition.
 * Bank/section/profile selection never performs any history network requests. */
export function prepareBankRateHistory(core: CorePayload, manifest: Manifest, index: DatesIndex | null = null): Promise<boolean> {
  if (packedBankRateHistory(core)) return Promise.resolve(true);
  if (!manifest.payload_revision) return Promise.resolve(false);
  const work = preparation.then(() => prepare(core, manifest, index));
  preparation = work.catch(() => false);
  return preparation;
}

async function prepare(core: CorePayload, manifest: Manifest, freshIndex: DatesIndex | null): Promise<boolean> {
  try {
    const saved = await cache.readBankRateHistory?.(decodeSavedBankRateHistory).catch(() => null) ?? null;
    const baselineIndex = parseDatesIndex(bundled.source_index);
    if (!baselineIndex?.revision_heads) return false;
    const cachedBinding = saved?.core_bindings[core.run_date];
    const cachedMatches = cachedBinding?.core_sha256 === manifest.files.core.sha256 &&
      cachedBinding.manifest_sha256 === saved?.index.revision_heads?.[core.run_date]?.manifest_sha256 &&
      currentMatches(core, manifest, saved!.index);
    const bundledMatches = bundled.core_sha256 === manifest.files.core.sha256 && currentMatches(core, manifest, baselineIndex);
    const index = freshIndex ?? (cachedMatches ? saved!.index : bundledMatches ? baselineIndex : null);
    if (!index?.revision_heads || !currentMatches(core, manifest, index)) return false;
    assertIndexAdvances(index, baselineIndex);
    if (saved) assertIndexAdvances(index, saved.index);
    const baseline = getBundledPortableBankRateHistory();
    if (!baseline) return false;
    const heads = Object.fromEntries(Object.entries(index.revision_heads).map(([day, head]) => [day, head.manifest_sha256]));
    const matches = (history: PortableBankRateHistory) => index.dates.filter(day => day <= core.run_date && history.source_heads[day] === heads[day]).length;
    let portable = saved && matches(saved.portable) >= matches(baseline) ? saved.portable : baseline;
    // Discard stale chart calculations as soon as a selected historical edition
    // changes. A failed corrected-date download cannot leave superseded rates.
    clearSupplementaryBankRateHistory(core);
    if (freshIndex) {
      const dates = index.dates.filter(day => day <= core.run_date && portable.source_heads[day] !== heads[day]);
      let failures = 0;
      for (const day of dates) {
        if (!heads[day]) continue;
        await yieldToUi();
        try {
          const observed = day === core.run_date ? core : await downloadDatedCore(day, index);
          portable = mergePortableBankRateHistory(portable, observed, heads[day]);
          failures = 0;
        } catch {
          debugLog.warn('bank-rate-history', `Historical observation ${day} could not be loaded.`);
          if (++failures >= 4) break;
        }
      }
    }
    await yieldToUi();
    const projected = projectPortableBankRateHistory(core, portable, heads);
    const missing = index.dates.filter(day => day < core.run_date && heads[day] && portable.source_heads[day] !== heads[day]);
    const installed = installSupplementaryBankRateHistory(core, projected, missing);
    if (!installed) return false;
    const bundledReusable = portable === baseline && bundledMatches && sameHistoryHeads(index, baselineIndex, core.run_date);
    const savedReusable = saved && portable === saved.portable && cachedMatches && sameHistoryHeads(index, saved.index, core.run_date);
    if (freshIndex && !bundledReusable && !savedReusable) {
      try {
        const core_bindings: SavedHistory['core_bindings'] = Object.fromEntries(Object.entries({
          [baselineIndex.latest_date]: { core_sha256: bundled.core_sha256,
            manifest_sha256: baselineIndex.revision_heads[baselineIndex.latest_date].manifest_sha256 },
          ...saved?.core_bindings,
        }).filter(([day, binding]) => heads[day] === binding.manifest_sha256));
        core_bindings[core.run_date] = { core_sha256: manifest.files.core.sha256, manifest_sha256: heads[core.run_date] };
        if (Object.keys(core_bindings).length > MAX_CORE_BINDINGS) throw new Error('History core binding budget exceeded');
        await cache.writeBankRateHistory(encodeSavedBankRateHistory({
          schema_version: 1, core_bindings, index, portable,
        }));
      } catch { debugLog.warn('bank-rate-history', 'History is ready; offline cache could not be saved.'); }
    }
    return true;
  } catch (error) {
    clearSupplementaryBankRateHistory(core);
    debugLog.warn('bank-rate-history', `Complete history unavailable: ${String((error as Error)?.message ?? error)}`);
    return false;
  }
}
