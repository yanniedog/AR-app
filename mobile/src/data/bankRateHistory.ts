import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { SECTION_KEYS } from '../types';
import { yieldToUi } from '../lib/yieldToUi';
import { downloadDatedCore, fetchDatesIndexJson, historyDatesUpTo } from './historyDaily';
import { resolveDatedPublication } from './historicalPublication';
import { assertHistoricalIdentitiesAdvance, historicalRevisionHighWater } from './historyIdentity';
import { snapshotBankRates, type BankRateScope, type BankRateSnapshot } from './bankRateOverview';

const CACHE_KEY = 'bank-rate-overview-v1';
interface HistoryCache { scope: string; identities: Record<string, string>; snapshots: Record<string, BankRateSnapshot> }
function validSnapshot(snapshot: unknown): snapshot is BankRateSnapshot {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  return Object.entries(snapshot).every(([section, banks]) => SECTION_KEYS.includes(section as typeof SECTION_KEYS[number]) &&
    banks && typeof banks === 'object' && Object.values(banks).every(raw => {
      const s = raw as Record<string, number> | null;
      return s && ['min', 'mean', 'median', 'max', 'count'].every(k => typeof s[k] === 'number' && Number.isFinite(s[k])) &&
        s.count > 0 && Number.isInteger(s.count) && s.min >= 0 && s.min <= s.mean && s.mean <= s.max && s.min <= s.median && s.median <= s.max;
    }));
}
export function bankRateScopeKey(scope: BankRateScope): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(SECTION_KEYS.map(section =>
    [section, [...scope.signatures[section]].sort()])))));
}

/** Explicit, bounded history loading. One catalogue in memory at a time; only
 * scoped aggregates persist. Revalidate publication identity before cache reuse. */
export async function loadBankRateHistory(
  scope: BankRateScope, runDate: string, isCurrent: () => boolean,
  onProgress: (snapshots: Record<string, BankRateSnapshot>) => void,
  cachedOnly = false,
  maxDownloads = 30,
): Promise<void> {
  const key = bankRateScopeKey(scope);
  let cached: HistoryCache | null = null;
  try { cached = JSON.parse(await AsyncStorage.getItem(CACHE_KEY) ?? 'null') as HistoryCache | null; } catch { /* Cache is optional. */ }
  if (!isCurrent() || (cachedOnly && cached?.scope !== key)) return;
  const index = await fetchDatesIndexJson();
  const dates = historyDatesUpTo(index, runDate).filter(date => date < runDate).slice(-30);
  assertHistoricalIdentitiesAdvance(index, dates, cached?.identities);
  const next: HistoryCache = { scope: key, identities: historicalRevisionHighWater(cached?.identities), snapshots: {} };
  let failures = 0;
  let downloads = 0;
  for (const date of dates.slice().reverse()) {
    if (!isCurrent()) return;
    try {
      const publication = await resolveDatedPublication(date, index);
      if (!isCurrent()) return;
      const saved = cached?.snapshots?.[date];
      const reusable = cached?.scope === key && cached.identities?.[date] === publication.identity && validSnapshot(saved) && saved;
      if (cachedOnly && !reusable) { next.snapshots[date] = {}; continue; }
      if (!reusable && downloads >= maxDownloads) break;
      if (!reusable) downloads += 1;
      const snapshot = reusable || snapshotBankRates(scope, await downloadDatedCore(date, index, publication));
      if (!isCurrent()) return;
      next.snapshots[date] = snapshot;
      next.identities[date] = publication.identity;
      onProgress({ ...next.snapshots });
      if (!cachedOnly) try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* Storage failure must not erase verified chart points. */ }
      failures = 0;
      await yieldToUi();
    } catch {
      // Keep the missing date on the axis so the chart never bridges an outage.
      next.snapshots[date] = {};
      onProgress({ ...next.snapshots });
      failures += 1;
      if (failures >= 4) throw new Error('Some history could not be loaded. Retry to fill the gaps.');
    }
  }
}
