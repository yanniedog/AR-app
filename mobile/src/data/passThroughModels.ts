import type {
  BankInsightsPayload,
  MultiSectionPassThroughModel,
  MultiSectionPassThroughRow,
  PassThroughRow,
} from './bankInsights';
import {
  rbaPassThrough,
  rbaPassThroughDecisionList,
} from './bankInsights';
import type { RbaCalendar } from './rbaCalendar';
import { SECTIONS } from '../constants';
import type { RbaEntry, SectionKey } from '../types';

export type PassThroughSort = 'response' | 'timing' | 'bank';

export interface SectionResponseSummary {
  eligible: number;
  movedWithRba: number;
  movedOpposite: number;
  unchanged: number;
  medianObservedBps: number | null;
  medianDays: number | null;
  completeBaselines: number;
  fullOrOver: number;
}

export interface BankResponseProfile {
  provider: string;
  direction: 'hike' | 'cut';
  /** Fully covered, closed windows used for the general tendency. */
  windowsObserved: number;
  currentWindowIncluded: boolean;
  currentStatus: 'followed' | 'opposite' | 'waiting' | null;
  currentBps: number | null;
  currentDays: number | null;
  movedWithRba: number;
  movedOpposite: number;
  unchanged: number;
  responseRatePct: number | null;
  medianDays: number | null;
  medianPassPct: number | null;
  confidence: 'one-window' | 'early' | 'developing' | 'established';
}

export const RESPONSE_WINDOW_SWIPE_THRESHOLD_PX = 44;

export function responseWindowSwipeDirection(
  deltaX: number,
  threshold = RESPONSE_WINDOW_SWIPE_THRESHOLD_PX,
): 'older' | 'newer' | null {
  if (deltaX <= -threshold) return 'older';
  if (deltaX >= threshold) return 'newer';
  return null;
}

export interface ResponseScatterHitPoint {
  provider: string;
  cx: number;
  cy: number;
}

export interface ResponseScatterPlotPoint extends ResponseScatterHitPoint {
  net: number;
  hasTiming: boolean;
}

export interface ResponseScatterDecisionMarker {
  date: string;
  bps: number;
  active: boolean;
}

export interface ResponseScatterDecisionLine extends ResponseScatterDecisionMarker {
  y: number;
  label: string;
  /** Vertical label offset when multiple decisions share the same bps. */
  labelDy: number;
}

export interface ResponseScatterLayout {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  windowDays: number;
  decisionBps: number;
  /** Every scorable RBA decision — drawn as labelled full-pass guides. */
  decisions?: ResponseScatterDecisionMarker[];
}

export const SCATTER_ZOOM_MIN = 1;
export const SCATTER_ZOOM_MAX = 3;
export const SCATTER_ZOOM_STEP = 0.5;

export function clampScatterZoom(zoom: number): number {
  const stepped = Math.round(zoom / SCATTER_ZOOM_STEP) * SCATTER_ZOOM_STEP;
  return Math.min(SCATTER_ZOOM_MAX, Math.max(SCATTER_ZOOM_MIN, Number(stepped.toFixed(2))));
}

export function nextScatterZoom(zoom: number, direction: 1 | -1): number {
  return clampScatterZoom(zoom + direction * SCATTER_ZOOM_STEP);
}

/** Compact axis label for an RBA decision guide on the scatter. */
export function formatScatterDecisionLabel(date: string, bps: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const hasValidDate = !Number.isNaN(d.getTime());
  const when = hasValidDate
    ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    : date.length >= 5
      ? date.slice(5)
      : date || '—';
  const magnitude = `${bps > 0 ? '+' : bps < 0 ? '−' : ''}${Math.abs(bps)}`;
  return `${when} ${magnitude}`;
}

/**
 * Plot every eligible lender for the active section. Timed same-direction
 * responses use the days axis; untimed / opposite / unchanged sit on the rail.
 * All scorable RBA decisions render as labelled horizontal full-pass guides.
 */
export function buildResponseScatterPoints(
  rows: (MultiSectionPassThroughRow & { response: PassThroughRow })[],
  layout: ResponseScatterLayout,
): {
  points: ResponseScatterPlotPoint[];
  maxBps: number;
  timedW: number;
  untimedX: number;
  innerH: number;
  referenceY: number;
  zeroY: number;
  decisionLines: ResponseScatterDecisionLine[];
} {
  const {
    width,
    height,
    padL,
    padR,
    padT,
    padB,
    windowDays,
    decisionBps,
    decisions = [],
  } = layout;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const timedW = innerW * 0.76;
  const untimedX = padL + innerW * 0.9;
  const maxBps = Math.max(
    Math.abs(decisionBps),
    ...decisions.map((decision) => Math.abs(decision.bps)),
    ...rows.map((item) => Math.abs(item.response.netChangeBps ?? item.response.passedBps)),
    1,
  );
  const x = (days: number) =>
    padL + (Math.min(windowDays, Math.max(0, days)) / windowDays) * timedW;
  const y = (bps: number) => padT + innerH / 2 - (bps / maxBps) * (innerH / 2);
  const points = rows.map((item, index) => {
    const net = item.response.netChangeBps ?? item.response.passedBps;
    const hasTiming = item.response.passedBps !== 0 && item.response.daysToFirstMove != null;
    const jitterX = ((index % 5) - 2) * (hasTiming ? 2.2 : 3.5);
    const jitterY = ((Math.floor(index / 5) % 5) - 2) * 2;
    return {
      provider: item.provider,
      net,
      hasTiming,
      cx: (hasTiming ? x(item.response.daysToFirstMove!) : untimedX) + jitterX,
      cy: y(net) + jitterY,
    };
  });
  // Keep guides on true bps Y; stagger only labels when several decisions share a level.
  const bpsCounts = new Map<number, number>();
  const decisionLines = decisions.map((decision) => {
    const prior = bpsCounts.get(decision.bps) ?? 0;
    bpsCounts.set(decision.bps, prior + 1);
    return {
      ...decision,
      y: y(decision.bps),
      label: formatScatterDecisionLabel(decision.date, decision.bps),
      labelDy: prior * 11,
    };
  });
  return {
    points,
    maxBps,
    timedW,
    untimedX,
    innerH,
    referenceY: y(decisionBps),
    zeroY: y(0),
    decisionLines,
  };
}

/**
 * Resolve a chart press to the closest plotted lender. Repeated presses in a
 * dense cluster cycle through every nearby lender so overlapped observations
 * remain reachable instead of a later SVG sibling intercepting all taps.
 */
export function selectResponseScatterProvider(
  points: ResponseScatterHitPoint[],
  locationX: number,
  locationY: number,
  selectedProvider: string | null,
  maxDistance = 22,
): string | null {
  const candidates = points
    .map((point) => ({
      point,
      distance: Math.hypot(point.cx - locationX, point.cy - locationY),
    }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return null;
  const currentIndex = candidates.findIndex(
    ({ point }) => point.provider === selectedProvider,
  );
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % candidates.length
    : 0;
  return candidates[nextIndex].point.provider;
}

export type ResponseScatterPressResult =
  | { hit: false }
  | { hit: true; provider: string | null };

/**
 * Resolve a chart press to the next selection. Misses leave selection alone;
 * a press on the sole nearby point toggles it off.
 */
export function resolveResponseScatterPress(
  points: ResponseScatterHitPoint[],
  locationX: number,
  locationY: number,
  selectedProvider: string | null,
  maxDistance = 22,
): ResponseScatterPressResult {
  const hit = selectResponseScatterProvider(
    points,
    locationX,
    locationY,
    selectedProvider,
    maxDistance,
  );
  if (!hit) return { hit: false };
  return { hit: true, provider: hit === selectedProvider ? null : hit };
}

export function responseBpsLabel(bps: number): string {
  const rounded = Math.round(bps * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} bp`;
}

export function responseTimingLabel(row: PassThroughRow, partial: boolean): string {
  if (row.daysToFirstMove == null) {
    return partial ? 'not observed after tracking began' : 'no matching move observed';
  }
  return `${partial ? '≤' : ''}${row.daysToFirstMove} day${row.daysToFirstMove === 1 ? '' : 's'}`;
}

export function lenderResponseAccessibilityLabel(
  row: Pick<MultiSectionPassThroughRow, 'provider' | 'sections'>,
  section: SectionKey,
  partial: boolean,
): string {
  const response = row.sections[section];
  return [
    row.provider,
    !response
      ? `${SECTIONS[section].title}: no series`
      : `${SECTIONS[section].title}: ${responseBpsLabel(response.netChangeBps ?? response.passedBps)}, ${responseTimingLabel(response, partial)}`,
  ].join('. ');
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Build an honest per-bank pattern across every locally observable RBA
 * rate-change window. The newest open window participates like any other
 * observation, while incomplete pre-ledger baselines never contribute a
 * pass-through percentage.
 */
export function buildBankResponseProfiles(
  payload: BankInsightsPayload,
  rba: RbaEntry[],
  calendar: RbaCalendar | null,
  section: SectionKey,
  direction: 'hike' | 'cut',
): BankResponseProfile[] {
  const decisions = rbaPassThroughDecisionList(payload, rba, { calendar })
    .filter((decision) => decision.outcome === direction);
  const newestDate = decisions[0]?.date;
  const byProvider = new Map<string, {
    windows: number;
    current: boolean;
    withRba: number;
    opposite: number;
    unchanged: number;
    days: number[];
    ratios: number[];
    currentStatus: BankResponseProfile['currentStatus'];
    currentBps: number | null;
    currentDays: number | null;
  }>();

  for (const decision of decisions) {
    const model = rbaPassThrough(payload, rba, {
      calendar,
      decisionDate: decision.date,
      section,
    });
    if (!model) continue;
    for (const response of model.rows) {
      const provider = response.provider;
      const stats = byProvider.get(provider) ?? {
        windows: 0,
        current: false,
        withRba: 0,
        opposite: 0,
        unchanged: 0,
        days: [],
        ratios: [],
        currentStatus: null,
        currentBps: null,
        currentDays: null,
      };
      const isCurrent = model.windowOpen && decision.date === newestDate;
      if (isCurrent) {
        stats.current = true;
        stats.currentBps = response.netChangeBps ?? response.passedBps;
        stats.currentDays = response.daysToFirstMove;
        stats.currentStatus = response.passedBps !== 0
          ? 'followed'
          : (response.netChangeBps ?? 0) !== 0
            ? 'opposite'
            : 'waiting';
        byProvider.set(provider, stats);
        continue;
      }
      // General tendencies use only complete, closed evidence. Open non-moves,
      // missing baselines, and lenders lost before the window end are censored.
      if (
        model.decision.partialObservation ||
        !response.baselineComplete ||
        !response.windowEndComplete
      ) {
        byProvider.set(provider, stats);
        continue;
      }
      stats.windows += 1;
      if (response.passedBps !== 0) {
        stats.withRba += 1;
        if (response.daysToFirstMove != null) stats.days.push(response.daysToFirstMove);
        if (response.ratio != null) stats.ratios.push(response.ratio * 100);
      } else if ((response.netChangeBps ?? 0) !== 0) {
        stats.opposite += 1;
      } else {
        stats.unchanged += 1;
      }
      byProvider.set(provider, stats);
    }
  }

  return [...byProvider.entries()]
    .map(([provider, stats]): BankResponseProfile => ({
      provider,
      direction,
      windowsObserved: stats.windows,
      currentWindowIncluded: stats.current,
      currentStatus: stats.currentStatus,
      currentBps: stats.currentBps,
      currentDays: stats.currentDays,
      movedWithRba: stats.withRba,
      movedOpposite: stats.opposite,
      unchanged: stats.unchanged,
      responseRatePct: stats.windows
        ? Math.round((stats.withRba / stats.windows) * 100)
        : null,
      medianDays: median(stats.days),
      medianPassPct: median(stats.ratios),
      confidence: stats.windows >= 6
        ? 'established'
        : stats.windows >= 4
          ? 'developing'
          : stats.windows >= 2
            ? 'early'
            : 'one-window',
    }))
    .sort((a, b) =>
      b.windowsObserved - a.windowsObserved ||
      (b.responseRatePct ?? -1) - (a.responseRatePct ?? -1) ||
      (a.medianDays ?? Number.POSITIVE_INFINITY) -
        (b.medianDays ?? Number.POSITIVE_INFINITY) ||
      a.provider.localeCompare(b.provider),
    );
}

export function sectionRows(
  model: MultiSectionPassThroughModel,
  section: SectionKey,
): (MultiSectionPassThroughRow & { response: PassThroughRow })[] {
  return model.rows.flatMap((row) => {
    const response = row.sections[section];
    return response ? [{ ...row, response }] : [];
  });
}

export function summarizeSectionResponse(
  model: MultiSectionPassThroughModel,
  section: SectionKey,
): SectionResponseSummary {
  const responses = sectionRows(model, section).map((row) => row.response);
  const withRba = responses.filter((row) => row.passedBps !== 0);
  const opposite = responses.filter(
    (row) => (row.netChangeBps ?? 0) !== 0 && row.passedBps === 0,
  );
  const unchanged = responses.length - withRba.length - opposite.length;
  return {
    eligible: responses.length,
    movedWithRba: withRba.length,
    movedOpposite: opposite.length,
    unchanged,
    medianObservedBps: median(withRba.map((row) => Math.abs(row.passedBps))),
    medianDays: median(
      withRba.flatMap((row) =>
        row.daysToFirstMove == null ? [] : [row.daysToFirstMove],
      ),
    ),
    completeBaselines: responses.filter((row) => row.baselineComplete).length,
    fullOrOver: responses.filter(
      (row) => row.passStatus === 'full' || row.passStatus === 'over',
    ).length,
  };
}

export function passThroughCustomerContext(section: SectionKey, decisionBps: number): string {
  const ratesRose = decisionBps > 0;
  if (section === 'Mortgage') {
    return ratesRose
      ? 'More pass-through means higher advertised mortgage rates — worse for borrowers.'
      : 'More pass-through means lower advertised mortgage rates — better for borrowers.';
  }
  return ratesRose
    ? 'More pass-through means higher advertised deposit rates — better for savers.'
    : 'More pass-through means lower advertised deposit rates — worse for savers.';
}

export function filterAndSortSectionRows(
  model: MultiSectionPassThroughModel,
  section: SectionKey,
  query: string,
  sort: PassThroughSort,
  providerFilter: string | null = null,
): (MultiSectionPassThroughRow & { response: PassThroughRow })[] {
  const normalized = query.trim().toLocaleLowerCase();
  const rows = sectionRows(model, section).filter((row) => {
    if (providerFilter && row.provider !== providerFilter) return false;
    return !normalized || row.provider.toLocaleLowerCase().includes(normalized);
  });
  return rows.sort((a, b) => {
    if (sort === 'bank') return a.provider.localeCompare(b.provider);
    if (sort === 'timing') {
      const ad = a.response.daysToFirstMove ?? Number.POSITIVE_INFINITY;
      const bd = b.response.daysToFirstMove ?? Number.POSITIVE_INFINITY;
      return ad - bd || Math.abs(b.response.passedBps) - Math.abs(a.response.passedBps) ||
        a.provider.localeCompare(b.provider);
    }
    return (
      Math.abs(b.response.passedBps) - Math.abs(a.response.passedBps) ||
      (a.response.daysToFirstMove ?? Number.POSITIVE_INFINITY) -
        (b.response.daysToFirstMove ?? Number.POSITIVE_INFINITY) ||
      a.provider.localeCompare(b.provider)
    );
  });
}

export function passThroughEvidenceLabel(model: MultiSectionPassThroughModel): string {
  if (model.decision.partialObservation) return 'Early evidence · partial history';
  if (model.windowOpen) return 'Live evidence · window open';
  return 'Complete response window';
}
