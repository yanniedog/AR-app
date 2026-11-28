import { gunzipSync, strFromU8 } from 'fflate';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import type { CoreIntegrityContext } from './sectionIntegrity';
import type { CorePayload, Manifest, RateRow, SectionKey } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { toFraction } from './rateNumbers';
import type { ProductBestRateSummary } from './productHistoryModel';

export type ExactRateMove = [priorDay: string, priorRate: number, firstSeen: string, rate: number];
type RateMoves = Partial<Record<SectionKey, Record<string, Record<number, ExactRateMove>>>>;
type BoundCore = Pick<CoreIntegrityContext, 'core' | 'coreSha256'>;
type MovementCore = CorePayload & { exact_rate_moves?: RateMoves };
let legacyMoves: RateMoves | undefined;

export function rateMovesForCore(core: MovementCore | null, integrity?: BoundCore | null): RateMoves | undefined {
  if (!core || core.exact_rate_moves) return core?.exact_rate_moves;
  if (core.run_date !== '2026-11-28' || integrity?.core !== core) return undefined;
  // Load the archived observations only for the matching verified edition.
  const snapshot = require('./legacyExactMoves.snapshot.json') as {
    core_sha256: string; run_date: string; gzip_hex: string; sha256: string
  };
  if (integrity.coreSha256 !== snapshot.core_sha256 || core.run_date !== snapshot.run_date) return undefined;
  if (!legacyMoves) {
    const bytes = gunzipSync(hexToBytes(snapshot.gzip_hex));
    if (bytesToHex(sha256(bytes)) !== snapshot.sha256) return undefined;
    legacyMoves = JSON.parse(strFromU8(bytes));
  }
  return legacyMoves;
}

export function rateEvidenceId(kind: 'rate-move' | 'rate-evidence', manifest: Manifest | null | undefined,
  section: SectionKey, row: RateRow): string {
  return JSON.stringify([kind, manifest?.tag, manifest?.files.core.sha256, section, row.product_key, row.rate_index]);
}
const members = new WeakMap<readonly RateRow[], WeakSet<RateRow>>();

/** Bind a displayed price to its unmodified published row before looking up history. */
export function matchesPublishedRate(core: CorePayload | null, section: SectionKey, source: RateRow,
  displayed: number | string | null | undefined): boolean {
  if (!core || source.rate_index == null || source.exact_alert_eligible === false) return false;
  const visible = toFraction(displayed), advertised = toFraction(source.rate);
  if (visible == null || advertised == null || Math.abs(visible - advertised) > 1e-9) return false;
  const rows = core.sections[section].rates;
  let known = members.get(rows);
  if (!known) { known = new WeakSet(rows); members.set(rows, known); }
  return known.has(source);
}

export function exactRateMove(core: CorePayload | null, section: SectionKey, source: RateRow,
  displayed: number | string | null | undefined, integrity?: BoundCore | null): ProductBestRateSummary | null {
  if (!core || source.rate_index == null || source.exact_alert_eligible === false) return null;
  const move = rateMovesForCore(core, integrity)?.[section]?.[source.product_key]?.[source.rate_index];
  if (!Array.isArray(move) || move.length !== 4) return null;
  const [priorDay, fromRate, observedOn, toRate] = move;
  if (!isValidCalendarDate(priorDay) || !isValidCalendarDate(observedOn) || observedOn > core.run_date ||
      Date.parse(observedOn) - Date.parse(priorDay) !== 86400000 ||
      !Number.isFinite(fromRate) || fromRate < 0 || !Number.isFinite(toRate) || toRate < 0) return null;
  const advertised = toFraction(source.rate);
  if (advertised == null || Math.abs(advertised - toRate) > 1e-9 || !matchesPublishedRate(core, section, source, displayed)) return null;
  const bps = Math.round((toRate - fromRate) * 100000) / 10;
  return bps ? { kind: 'changed', trackedSince: priorDay, observations: 2, observedOn, fromRate, toRate, bps } : null;
}
