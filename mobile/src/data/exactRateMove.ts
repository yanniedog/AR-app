import type { CorePayload, Manifest, RateRow, SectionKey } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { toFraction } from './rateNumbers';
import type { ProductBestRateSummary } from './productHistoryModel';

export type ExactRateMove = [priorDay: string, priorRate: number, firstSeen: string, rate: number];
export function rateEvidenceId(kind: 'rate-move' | 'rate-evidence', manifest: Manifest | null | undefined,
  section: SectionKey, row: RateRow): string {
  return JSON.stringify([kind, manifest?.tag, manifest?.files.core.sha256, section, row.product_key, row.rate_index]);
}
const members = new WeakMap<readonly RateRow[], WeakSet<RateRow>>();

export function exactRateMove(core: CorePayload | null, section: SectionKey, source: RateRow,
  displayed: number | string | null | undefined): ProductBestRateSummary | null {
  if (!core || source.rate_index == null || source.exact_alert_eligible === false) return null;
  const move = core.exact_rate_moves?.[section]?.[source.product_key]?.[source.rate_index];
  if (!Array.isArray(move) || move.length !== 4) return null;
  const [priorDay, fromRate, observedOn, toRate] = move;
  if (!isValidCalendarDate(priorDay) || !isValidCalendarDate(observedOn) || observedOn > core.run_date ||
      Date.parse(observedOn) - Date.parse(priorDay) !== 86400000 ||
      !Number.isFinite(fromRate) || fromRate < 0 || !Number.isFinite(toRate) || toRate < 0) return null;
  const visible = toFraction(displayed), advertised = toFraction(source.rate);
  if (visible == null || advertised == null || Math.abs(visible - toRate) > 1e-9 ||
      Math.abs(advertised - toRate) > 1e-9) return null;
  const rows = core.sections[section].rates;
  let known = members.get(rows);
  if (!known) { known = new WeakSet(rows); members.set(rows, known); }
  if (!known.has(source)) return null;
  const bps = Math.round((toRate - fromRate) * 100000) / 10;
  return bps ? { kind: 'changed', trackedSince: priorDay, observations: 2, observedOn, fromRate, toRate, bps } : null;
}
