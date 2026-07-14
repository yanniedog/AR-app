import type { BankHistoryPoint, RbaEntry, SectionKey } from '../types';
import { SECTION_KEYS } from '../types';
import { normalizeTimelineDates, parseYmd } from './bankHistoryTransform';
import type { RbaCalendar, RbaDecisionEntry } from './rbaCalendar';
import { debugLog } from '../lib/debugLog';

export type BankMoveDir = 'cut' | 'hike' | 'mixed';

const MOVE_DIRS: readonly BankMoveDir[] = ['cut', 'hike', 'mixed'];
const FOLLOW_DIRS: readonly ('cut' | 'hike')[] = ['cut', 'hike'];
const DEFAULT_PASS_THROUGH_WINDOW_DAYS = 60;

/** One provider rate-move detected by the Pi between consecutive ingest runs. */
export interface BankRateEvent {
  date: string;
  provider: string;
  section: SectionKey;
  dir: BankMoveDir;
  /** Products whose best advertised rate moved >= 5 bps. */
  moved: number;
  /** Products matched between the two runs. */
  total: number;
  /** Mean delta across moved products, in basis points (negative = cut). */
  avg_bps: number;
}

/** Per-provider daily series, positionally aligned to `run_dates`. */
export interface BankSectionSeries {
  median: (number | null)[];
  best: (number | null)[];
  count: (number | null)[];
}

/** Sample-size confidence for precomputed lender behaviour (AR-local bank_behaviour). */
export type PassThroughConfidence = 'insufficient' | 'early' | 'emerging' | 'established';

export interface BehaviourDirectionSummary {
  n: number;
  days_median: number | null;
  bps_median: number | null;
  ratio_median: number | null;
  confidence: PassThroughConfidence;
}

/** Per-provider hike/cut medians shipped in bank-history `behaviour`. */
export interface BehaviourProviderSummary {
  hike: BehaviourDirectionSummary;
  cut: BehaviourDirectionSummary;
}

export interface BehaviourSectionSummary {
  section: SectionKey;
  window_days: number;
  providers: Record<string, BehaviourProviderSummary>;
}

/** Pre-aggregated per-bank history + events asset (see app_payload_mobile.py). */
export interface BankInsightsPayload {
  schema_version: number;
  run_date: string;
  run_dates: string[];
  banks: Record<string, Partial<Record<SectionKey, BankSectionSeries>>>;
  events: BankRateEvent[];
  /** Optional precomputed pass-through summaries (may be empty early in the ledger). */
  behaviour?: Partial<Record<SectionKey, BehaviourSectionSummary>>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null; // Number(null) === 0 — keep gaps as gaps
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function alignedSeries(raw: unknown, length: number): (number | null)[] | null {
  if (!Array.isArray(raw)) return null;
  const out: (number | null)[] = [];
  for (let i = 0; i < length; i += 1) {
    out.push(i < raw.length ? numberOrNull(raw[i]) : null);
  }
  return out;
}

function emptyBehaviourDirection(): BehaviourDirectionSummary {
  return {
    n: 0,
    days_median: null,
    bps_median: null,
    ratio_median: null,
    confidence: 'insufficient',
  };
}

function normalizeBehaviourDirection(raw: unknown): BehaviourDirectionSummary {
  if (!raw || typeof raw !== 'object') return emptyBehaviourDirection();
  const obj = raw as Record<string, unknown>;
  const n = Math.max(0, Math.round(numberOrNull(obj.n) ?? 0));
  const confidenceRaw = typeof obj.confidence === 'string' ? obj.confidence : '';
  const confidence: PassThroughConfidence =
    confidenceRaw === 'early' ||
    confidenceRaw === 'emerging' ||
    confidenceRaw === 'established' ||
    confidenceRaw === 'insufficient'
      ? confidenceRaw
      : n >= 10
        ? 'established'
        : n >= 6
          ? 'emerging'
          : n >= 3
            ? 'early'
            : 'insufficient';
  return {
    n,
    days_median: numberOrNull(obj.days_median),
    bps_median: numberOrNull(obj.bps_median),
    ratio_median: numberOrNull(obj.ratio_median),
    confidence,
  };
}

function normalizeBehaviour(
  raw: unknown,
): Partial<Record<SectionKey, BehaviourSectionSummary>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<SectionKey, BehaviourSectionSummary>> = {};
  for (const [section, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(SECTION_KEYS as readonly string[]).includes(section) || !value || typeof value !== 'object') {
      continue;
    }
    const obj = value as Record<string, unknown>;
    const providersRaw = obj.providers;
    const providers: Record<string, BehaviourProviderSummary> = {};
    if (providersRaw && typeof providersRaw === 'object') {
      for (const [provider, dirs] of Object.entries(providersRaw as Record<string, unknown>)) {
        if (!provider || !dirs || typeof dirs !== 'object') continue;
        const d = dirs as Record<string, unknown>;
        providers[provider] = {
          hike: normalizeBehaviourDirection(d.hike),
          cut: normalizeBehaviourDirection(d.cut),
        };
      }
    }
    out[section as SectionKey] = {
      section: section as SectionKey,
      window_days: Math.max(1, Math.round(numberOrNull(obj.window_days) ?? DEFAULT_PASS_THROUGH_WINDOW_DAYS)),
      providers,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Drop corrupt bank-history JSON before it reaches insights/chart code. */
export function normalizeBankInsightsPayload(raw: unknown): BankInsightsPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const run_date = typeof obj.run_date === 'string' ? obj.run_date.slice(0, 10) : '';
  if (!run_date) return null;

  const run_dates = normalizeTimelineDates(
    Array.isArray(obj.run_dates)
      ? obj.run_dates.map((d) => (typeof d === 'string' ? d.slice(0, 10) : ''))
      : [],
  );
  if (!run_dates.length) return null;

  const banksRaw = obj.banks;
  if (!banksRaw || typeof banksRaw !== 'object') return null;
  const banks: BankInsightsPayload['banks'] = {};
  for (const [provider, sectionsRaw] of Object.entries(banksRaw as Record<string, unknown>)) {
    if (!provider || !sectionsRaw || typeof sectionsRaw !== 'object') continue;
    const sections: Partial<Record<SectionKey, BankSectionSeries>> = {};
    for (const [key, value] of Object.entries(sectionsRaw as Record<string, unknown>)) {
      if (!(SECTION_KEYS as readonly string[]).includes(key) || !value || typeof value !== 'object') continue;
      const series = value as Record<string, unknown>;
      const median = alignedSeries(series.median, run_dates.length);
      const best = alignedSeries(series.best, run_dates.length);
      const count = alignedSeries(series.count, run_dates.length);
      if (!median || !best || !median.some((v) => v != null)) continue;
      sections[key as SectionKey] = {
        median,
        best,
        count: count ?? median.map(() => null),
      };
    }
    if (Object.keys(sections).length) banks[provider] = sections;
  }
  if (!Object.keys(banks).length) return null;

  const events: BankRateEvent[] = [];
  if (Array.isArray(obj.events)) {
    for (const item of obj.events) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const date = typeof e.date === 'string' ? e.date.slice(0, 10) : '';
      const provider = typeof e.provider === 'string' ? e.provider : '';
      const section = typeof e.section === 'string' ? e.section : '';
      const dir = typeof e.dir === 'string' ? e.dir : '';
      const avg_bps = numberOrNull(e.avg_bps);
      if (
        !parseYmd(date) ||
        !provider ||
        !(SECTION_KEYS as readonly string[]).includes(section) ||
        !(MOVE_DIRS as readonly string[]).includes(dir) ||
        avg_bps == null
      ) {
        continue;
      }
      events.push({
        date,
        provider,
        section: section as SectionKey,
        dir: dir as BankMoveDir,
        moved: Math.max(0, Math.round(numberOrNull(e.moved) ?? 0)),
        total: Math.max(0, Math.round(numberOrNull(e.total) ?? 0)),
        avg_bps,
      });
    }
  }

  return {
    schema_version: typeof obj.schema_version === 'number' ? obj.schema_version : 1,
    run_date,
    run_dates,
    banks,
    events,
    behaviour: normalizeBehaviour(obj.behaviour),
  };
}

function sortEventsDesc(events: BankRateEvent[]): BankRateEvent[] {
  return events
    .slice()
    .sort((a, b) => (a.date === b.date ? a.provider.localeCompare(b.provider) : b.date.localeCompare(a.date)));
}

export interface RecentEventsOpts {
  sections?: SectionKey[];
  provider?: string;
  limit?: number;
}

/** Newest-first provider rate-move feed. */
export function recentBankEvents(
  payload: BankInsightsPayload | null | undefined,
  opts: RecentEventsOpts = {},
): BankRateEvent[] {
  if (!payload?.events?.length) return [];
  const sections = opts.sections?.length ? new Set(opts.sections) : null;
  const filtered = payload.events.filter(
    (e) => (!sections || sections.has(e.section)) && (!opts.provider || e.provider === opts.provider),
  );
  const sorted = sortEventsDesc(filtered);
  return opts.limit && opts.limit > 0 ? sorted.slice(0, opts.limit) : sorted;
}

function windowStartIndex(run_dates: string[], windowDays: number): number {
  const anchor = parseYmd(run_dates[run_dates.length - 1] ?? '');
  if (anchor == null) return 0;
  const cutoff = anchor - windowDays * DAY_MS;
  for (let i = 0; i < run_dates.length; i += 1) {
    const ts = parseYmd(run_dates[i]);
    if (ts != null && ts >= cutoff) return i;
  }
  return run_dates.length;
}

function firstNonNull(values: (number | null)[], from: number): number | null {
  for (let i = from; i < values.length; i += 1) {
    const v = values[i];
    if (v != null) return v;
  }
  return null;
}

function lastNonNull(values: (number | null)[], upTo?: number): number | null {
  for (let i = Math.min(upTo ?? values.length - 1, values.length - 1); i >= 0; i -= 1) {
    const v = values[i];
    if (v != null) return v;
  }
  return null;
}

export interface MoverRow {
  provider: string;
  /** Net change of the provider's median rate over the window, in basis points. */
  netBps: number;
  /** Latest median rate (fraction). */
  current: number;
}

/**
 * Net per-provider median-rate change over the trailing window, biggest cuts first.
 * Pure array math over the precomputed series — no per-row aggregation on device.
 */
export function topMovers(
  payload: BankInsightsPayload | null | undefined,
  section: SectionKey,
  windowDays = 30,
): MoverRow[] {
  if (!payload) return [];
  const start = windowStartIndex(payload.run_dates, windowDays);
  const rows: MoverRow[] = [];
  for (const [provider, sections] of Object.entries(payload.banks)) {
    const series = sections[section];
    if (!series) continue;
    const first = firstNonNull(series.median, start);
    const last = lastNonNull(series.median);
    if (first == null || last == null) continue;
    rows.push({
      provider,
      netBps: Math.round((last - first) * 10000 * 10) / 10,
      current: last,
    });
  }
  rows.sort((a, b) => a.netBps - b.netBps || a.provider.localeCompare(b.provider));
  return rows;
}

export interface BankTrendModel {
  dates: string[];
  points: BankHistoryPoint[];
  allDates: string[];
}

/**
 * Chart model for one provider+section: band spans best↔median ("sharpest offer"
 * to "typical rate"), mean line tracks the median. Feeds BankHistoryChart as-is.
 */
export function bankTrendChartModel(
  payload: BankInsightsPayload | null | undefined,
  provider: string,
  section: SectionKey,
): BankTrendModel | null {
  try {
    const series = payload?.banks?.[provider]?.[section];
    if (!payload || !series) return null;
    const dates: string[] = [];
    const points: BankHistoryPoint[] = [];
    for (let i = 0; i < payload.run_dates.length; i += 1) {
      const median = series.median[i];
      const best = series.best[i];
      if (median == null && best == null) continue;
      const lo = Math.min(median ?? best ?? 0, best ?? median ?? 0);
      const hi = Math.max(median ?? best ?? 0, best ?? median ?? 0);
      dates.push(payload.run_dates[i]);
      points.push({
        date: payload.run_dates[i],
        min: lo,
        max: hi,
        mean: median ?? best,
        median: median ?? best,
        count: series.count[i] ?? 0,
      });
    }
    if (!points.length) return null;
    return { dates, points, allDates: payload.run_dates };
  } catch (err) {
    debugLog.error(
      'bankInsights',
      `bankTrendChartModel failed provider=${provider} section=${section}: ${String((err as Error)?.message ?? err)}`,
    );
    return null;
  }
}

export interface RbaDecisionRef {
  date: string;
  /** Decision size in basis points (negative = cut). */
  bps: number;
  outcome: 'hike' | 'cut';
  /** Cash-rate target after the decision, percent — when known. */
  rate?: number;
  /**
   * Announcement predates the bank-history ledger start, so first-move timing may
   * miss earlier responses and days-to-follow is a lower bound on observed delay.
   */
  partialObservation: boolean;
}

export type PassThroughStatus = 'full' | 'partial' | 'none' | 'over';

export interface PassThroughRow {
  provider: string;
  /** First same-direction move size since the decision, in basis points (signed). */
  passedBps: number;
  /** Days from the decision to the provider's first matching move, if any. */
  daysToFirstMove: number | null;
  /** |passedBps| / |decision bps|; null when decision bps is 0 or no move. */
  ratio: number | null;
  passStatus: PassThroughStatus;
}

export interface PassThroughModel {
  decision: RbaDecisionRef;
  rows: PassThroughRow[];
  /** Response window length used for this score (days). */
  windowDays: number;
}

export interface PassThroughOpts {
  /** Prefer announcement-dated calendar decisions when present. */
  calendar?: RbaCalendar | null;
  /** Score this announcement date instead of the latest scorable decision. */
  decisionDate?: string;
  section?: SectionKey;
  windowDays?: number;
}

function ymdFromUtcMs(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function addDaysYmd(ymd: string, days: number): string | null {
  const ts = parseYmd(ymd);
  if (ts == null || !Number.isFinite(ts)) return null;
  return ymdFromUtcMs(ts + days * DAY_MS);
}

function daysBetweenYmd(from: string, to: string): number | null {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

function passStatusFor(passedBps: number, decisionBps: number): PassThroughStatus {
  if (passedBps === 0 || decisionBps === 0) return 'none';
  // Same-direction only (callers already filter, but guard against misuse).
  if (Math.sign(passedBps) !== Math.sign(decisionBps)) return 'none';
  const ratio = Math.abs(passedBps) / Math.abs(decisionBps);
  if (ratio >= 1.0001) return 'over';
  if (ratio >= 0.999) return 'full';
  return 'partial';
}

function windowEndForDecision(
  decisions: PassThroughSourceDecision[],
  index: number,
  windowDays: number,
): string | null {
  const dec = decisions[index];
  if (!dec) return null;
  let windowEnd = addDaysYmd(dec.date, windowDays);
  if (!windowEnd) return null;
  if (index + 1 < decisions.length) {
    const nextDec = decisions[index + 1];
    if (nextDec) {
      const dayBeforeNext = addDaysYmd(nextDec.date, -1);
      if (dayBeforeNext && dayBeforeNext < windowEnd) windowEnd = dayBeforeNext;
    }
  }
  return windowEnd;
}

export interface PassThroughSourceDecision {
  date: string;
  bps: number;
  outcome: 'hike' | 'cut';
  rate?: number;
}

/** Derive hike/cut steps from the core cash-rate series (effective dates). */
export function decisionsFromRbaSeries(
  rba: RbaEntry[] | null | undefined,
): PassThroughSourceDecision[] {
  if (!rba?.length) return [];
  const out: PassThroughSourceDecision[] = [];
  for (let i = 1; i < rba.length; i += 1) {
    const prior = rba[i - 1].rate;
    const rate = rba[i].rate;
    if (rate === prior) continue;
    const date = String(rba[i].date || '').slice(0, 10);
    if (!parseYmd(date)) continue;
    const bps = Math.round((rate - prior) * 100);
    if (bps === 0) continue;
    out.push({
      date,
      bps,
      outcome: bps > 0 ? 'hike' : 'cut',
      rate,
    });
  }
  return out;
}

/** Prefer calendar hike/cut entries; fall back to the cash-rate series. */
export function resolvePassThroughDecisions(
  rba: RbaEntry[] | null | undefined,
  calendar?: RbaCalendar | null,
): PassThroughSourceDecision[] {
  const fromCal =
    calendar?.decisions
      ?.filter((d): d is RbaDecisionEntry & { outcome: 'hike' | 'cut' } =>
        (FOLLOW_DIRS as readonly string[]).includes(d.outcome),
      )
      .map((d) => ({
        date: d.date,
        bps: d.delta_bps,
        outcome: d.outcome,
        rate: d.rate,
      })) ?? [];
  if (fromCal.length) return fromCal;
  return decisionsFromRbaSeries(rba);
}

/**
 * Hike/cut decisions whose response window overlaps the bank-history ledger.
 * Includes decisions that slightly predate ledger start when follow-on moves are
 * still observable inside the ingest window (marked partialObservation).
 */
export function scorablePassThroughDecisions(
  payload: BankInsightsPayload | null | undefined,
  rba: RbaEntry[] | null | undefined,
  opts: PassThroughOpts = {},
): RbaDecisionRef[] {
  if (!payload?.run_dates?.length) return [];
  const ledgerStart = payload.run_dates[0];
  const ledgerEnd = payload.run_date || payload.run_dates[payload.run_dates.length - 1];
  const windowDays = opts.windowDays ?? DEFAULT_PASS_THROUGH_WINDOW_DAYS;
  const decisions = resolvePassThroughDecisions(rba, opts.calendar);
  if (!decisions.length || !parseYmd(ledgerStart) || !parseYmd(ledgerEnd)) return [];

  const scored: RbaDecisionRef[] = [];
  for (let i = 0; i < decisions.length; i += 1) {
    const dec = decisions[i];
    if (!(FOLLOW_DIRS as readonly string[]).includes(dec.outcome)) continue;
    const windowEnd = windowEndForDecision(decisions, i, windowDays);
    if (!windowEnd) continue;
    // Response window must overlap the ledger; announcement must not be after ledger end.
    if (windowEnd < ledgerStart || dec.date > ledgerEnd) continue;
    scored.push({
      date: dec.date,
      bps: dec.bps,
      outcome: dec.outcome,
      rate: dec.rate,
      partialObservation: dec.date < ledgerStart,
    });
  }
  return scored;
}

function firstMatchingMove(
  events: BankRateEvent[],
  provider: string,
  section: SectionKey,
  outcome: 'hike' | 'cut',
  decisionDate: string,
  windowEnd: string,
): BankRateEvent | null {
  let best: BankRateEvent | null = null;
  for (const event of events) {
    if (event.provider !== provider || event.section !== section || event.dir !== outcome) continue;
    if (event.date < decisionDate || event.date > windowEnd) continue;
    if (!best || event.date < best.date) best = event;
  }
  return best;
}

function buildPassThroughRows(
  payload: BankInsightsPayload,
  decision: RbaDecisionRef,
  windowEnd: string,
  section: SectionKey,
): PassThroughRow[] {
  const rows: PassThroughRow[] = [];
  for (const [provider, sections] of Object.entries(payload.banks)) {
    if (!sections[section]) continue;
    const match = firstMatchingMove(
      payload.events,
      provider,
      section,
      decision.outcome,
      decision.date,
      windowEnd,
    );
    if (!match) {
      rows.push({
        provider,
        passedBps: 0,
        daysToFirstMove: null,
        ratio: null,
        passStatus: 'none',
      });
      continue;
    }
    const passedBps = Math.round(match.avg_bps * 10) / 10;
    const absDecision = Math.abs(decision.bps);
    const ratio = absDecision > 0 ? Math.round((Math.abs(passedBps) / absDecision) * 1000) / 1000 : null;
    rows.push({
      provider,
      passedBps,
      daysToFirstMove: daysBetweenYmd(decision.date, match.date),
      ratio,
      passStatus: passStatusFor(passedBps, decision.bps),
    });
  }
  rows.sort((a, b) =>
    decision.bps < 0 ? a.passedBps - b.passedBps : b.passedBps - a.passedBps,
  );
  return rows;
}

/**
 * Score how each lender's section rates followed an RBA hike/cut whose response
 * window overlaps the bank-history ledger. Defaults to the latest scorable
 * decision; pass `decisionDate` / `calendar` to browse past decisions.
 */
export function rbaPassThrough(
  payload: BankInsightsPayload | null | undefined,
  rba: RbaEntry[] | null | undefined,
  opts: PassThroughOpts = {},
): PassThroughModel | null {
  if (!payload?.run_dates?.length) return null;
  const section = opts.section ?? 'Mortgage';
  const windowDays = opts.windowDays ?? DEFAULT_PASS_THROUGH_WINDOW_DAYS;
  const scorable = scorablePassThroughDecisions(payload, rba, opts);
  if (!scorable.length) return null;

  const decision =
    (opts.decisionDate
      ? scorable.find((d) => d.date === opts.decisionDate)
      : null) ?? scorable[scorable.length - 1];
  if (!decision) return null;

  const all = resolvePassThroughDecisions(rba, opts.calendar);
  const idx = all.findIndex((d) => d.date === decision.date);
  if (idx < 0) return null;
  const windowEnd = windowEndForDecision(all, idx, windowDays);
  if (!windowEnd) return null;

  const rows = buildPassThroughRows(payload, decision, windowEnd, section);
  if (!rows.length) return null;
  return { decision, rows, windowDays };
}

/** Newest-first list of scorable pass-through decisions for UI pickers. */
export function rbaPassThroughDecisionList(
  payload: BankInsightsPayload | null | undefined,
  rba: RbaEntry[] | null | undefined,
  opts: PassThroughOpts = {},
): RbaDecisionRef[] {
  return scorablePassThroughDecisions(payload, rba, opts).slice().reverse();
}

export interface BankSnapshotRow {
  provider: string;
  /** Best advertised rate as of the snapshot date (last known value carried forward). */
  best: number | null;
  median: number | null;
  /** Best-rate change at its most recent move on/before the date, in bps. */
  changeBps: number | null;
  /** run_date of that most recent move (null when no prior data or no change). */
  changedOn: string | null;
}

/** Per-bank market state as of `date` — powers the ribbon-scrub rewind list. */
export function bankSnapshotAt(
  payload: BankInsightsPayload | null | undefined,
  section: SectionKey,
  date: string,
  lowerIsBetter: boolean,
): BankSnapshotRow[] {
  if (!payload?.run_dates?.length) return [];
  let idx = -1;
  for (let i = payload.run_dates.length - 1; i >= 0; i -= 1) {
    if (payload.run_dates[i] <= date) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return [];

  const lastKnown = (
    series: (number | null)[],
  ): { value: number | null; index: number } => {
    for (let i = idx; i >= 0; i -= 1) {
      const v = series[i];
      if (v != null) return { value: v, index: i };
    }
    return { value: null, index: -1 };
  };

  const rows: BankSnapshotRow[] = [];
  for (const [provider, sections] of Object.entries(payload.banks)) {
    const series = sections[section];
    if (!series) continue;
    const best = lastKnown(series.best);
    const median = lastKnown(series.median);
    if (best.value == null && median.value == null) continue;
    // Most recent move on/before the date: walk back over equal values to the
    // first run where the current value appeared, then diff against the prior one.
    let changeBps: number | null = null;
    let changedOn: string | null = null;
    if (best.value != null) {
      let firstHeldIdx = best.index;
      for (let i = best.index - 1; i >= 0; i -= 1) {
        const v = series.best[i];
        if (v == null) continue;
        if (v !== best.value) {
          changeBps = Math.round((best.value - v) * 1000) / 10;
          changedOn = payload.run_dates[firstHeldIdx];
          break;
        }
        firstHeldIdx = i;
      }
    }
    rows.push({
      provider,
      best: best.value,
      median: median.value,
      changeBps,
      changedOn,
    });
  }
  rows.sort((a, b) => {
    const av = a.best ?? a.median;
    const bv = b.best ?? b.median;
    if (av == null) return 1;
    if (bv == null) return -1;
    return lowerIsBetter ? av - bv : bv - av;
  });
  return rows;
}

export interface MarketPulse {
  /** Distinct providers that moved rates in the window. */
  banksMoved: number;
  cuts: number;
  hikes: number;
  sinceDate: string;
}

/** Headline activity counts for the trailing window (Home/Trends teaser). */
export function marketPulse(
  payload: BankInsightsPayload | null | undefined,
  sinceDays = 7,
  sections?: readonly SectionKey[],
): MarketPulse | null {
  if (!payload?.run_dates?.length) return null;
  const anchor = parseYmd(payload.run_dates[payload.run_dates.length - 1]);
  if (anchor == null) return null;
  const cutoffTs = anchor - sinceDays * DAY_MS;
  const movers = new Set<string>();
  let cuts = 0;
  let hikes = 0;
  let sinceDate = payload.run_dates[payload.run_dates.length - 1];
  for (const event of payload.events) {
    if (sections && !sections.includes(event.section)) continue;
    const ts = parseYmd(event.date);
    if (ts == null || ts < cutoffTs) continue;
    movers.add(event.provider);
    if (event.dir === 'cut') cuts += 1;
    else if (event.dir === 'hike') hikes += 1;
    if (event.date < sinceDate) sinceDate = event.date;
  }
  return { banksMoved: movers.size, cuts, hikes, sinceDate };
}
