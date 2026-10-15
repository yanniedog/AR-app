import { formatRate, formatTerm } from '../../data/format';
import type { ScopedFinancialConditionPresentation } from '../../data/scopedFinancialConditionFacts';
import { uiConditionRange, uiListedLvrRange } from '../../lib/financialUiCopy';
import { uiCount, uiJoin, uiLabel, uiMoney, type UiCopy, type UiText } from '../../lib/uiCopy';
import type { RateRow, SectionKey } from '../../types';

export const COMPACT_ROW = { action: 48, gap: 4, fontSize: 14, icon: 12, minHeight: 64 } as const;
const peerCache = new WeakMap<readonly RateRow[], Map<UiCopy, Set<RateRow>>>();

/** One index per immutable source section/metric, never a section scan per row. */
export function compactMetricHasPeers(row: RateRow, rows: readonly RateRow[] | undefined, label: UiCopy): boolean {
  if (!rows) return false;
  let indexes = peerCache.get(rows);
  if (!indexes) { indexes = new Map(); peerCache.set(rows, indexes); }
  let collisions = indexes.get(label);
  if (!collisions) {
    collisions = new Set();
    const groups = new Map<string, RateRow>();
    for (const candidate of rows) {
      const raw = label === 'Comparison rate' ? candidate.comparison_rate : label === 'Ongoing rate' ? candidate.ongoing_rate : candidate.rate;
      const key = JSON.stringify([candidate.provider, candidate.product_name, formatRate(raw)]);
      const first = groups.get(key);
      if (first) { collisions.add(first); collisions.add(candidate); }
      else groups.set(key, candidate);
    }
    indexes.set(label, collisions);
  }
  return collisions.has(row);
}

export function compactTierIndex(row: RateRow): UiText | null {
  return Number.isSafeInteger(row.rate_index) && row.rate_index! >= 0 ? uiJoin('#', uiCount(row.rate_index!)) : null;
}
export interface CompactProductFacet {
  readonly kind: 'LVR' | 'Term' | 'Balance';
  readonly value: UiText;
  readonly known: boolean;
}

function balanceValue(row: RateRow): UiText {
  const parse = (raw: RateRow['balance_min']): number | null => raw != null && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(raw).trim())
    && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const lower = parse(row.balance_min), upper = parse(row.balance_max);
  if ((row.balance_min != null && row.balance_min !== '' && lower === null)
    || (row.balance_max != null && row.balance_max !== '' && upper === null)
    || (lower !== null && upper !== null && lower > upper)) return uiLabel('Unverified');
  const money = (value: number) => uiMoney(value, Number.isInteger(value) ? 0 : Math.max(2, Math.min(6, (String(value).split('.')[1] ?? '').length)));
  return lower !== null && upper !== null ? uiJoin(money(lower), '–', money(upper))
    : lower !== null ? uiJoin('≥', money(lower)) : upper !== null ? uiJoin('≤', money(upper)) : uiLabel('Unknown');
}

/** Exact admitted source bounds take precedence over the normalized catalogue tier. */
export function compactProductFacet(row: RateRow, section: SectionKey,
  conditions: ScopedFinancialConditionPresentation): CompactProductFacet {
  const kind = section === 'Mortgage' ? 'LVR' : section === 'TD' ? 'Term' : 'Balance';
  const source = conditions.facts.filter(fact => kind === 'LVR' ? fact.kind === 'published-lvr-range'
    : kind === 'Term' ? fact.kind === 'published-term-range' : fact.kind === 'published-balance-range'
      && (fact.subject === 'balance' || fact.subject === 'deposit-balance'));
  const value = source.length > 1 ? uiLabel('Unknown') : source.length ? uiConditionRange(source[0]) : kind === 'LVR' ? uiListedLvrRange(row)
    : kind === 'Term' ? formatTerm(row) || uiLabel('Unknown') : balanceValue(row);
  return { kind, value, known: !['Unknown', 'Unverified'].includes(value) };
}

/** Conservative tabular-number budget; native text measurements can enlarge it. */
export function compactFactWidth(text: UiText, fontScale: number): number {
  let em = 0;
  for (const character of text) {
    em += /[0-9]/.test(character) ? 0.62 : /[., ]/.test(character) ? 0.32 : 0.95;
  }
  return Math.ceil(em * COMPACT_ROW.fontSize * fontScale);
}

export interface CompactProductRowLayout {
  readonly main: number;
  readonly identity: number;
  readonly primary: number;
  readonly secondary: number;
  readonly showSecondary: boolean;
  readonly facet: number;
  readonly showFacetValue: boolean;
  readonly showTier: boolean;
  readonly showFacetSymbol: boolean;
  readonly combinedStatus: boolean;
  readonly showPrimaryIcon: boolean;
  readonly warningOnly: boolean;
}

/** A single rail, with no text scaling cap, numeric ellipsis or horizontal scroll. */
export function compactProductRowLayout(width: number, fontScale: number, primary: UiText,
  secondary: UiText | null, facet: CompactProductFacet, statusIcons: number,
  measuredPrimary = 0, measuredSecondary = 0, tier: UiText | null = null, hasPeers = false): CompactProductRowLayout {
  const main = Math.max(0, width - 2 * COMPACT_ROW.action - 2 * COMPACT_ROW.gap);
  const primaryTextWidth = Math.max(compactFactWidth(primary, fontScale), measuredPrimary);
  const secondaryWidth = secondary === null ? 0
    : Math.max(compactFactWidth(secondary, fontScale), measuredSecondary) + COMPACT_ROW.icon + 2;
  const categoryWidth = facet.kind === 'LVR' ? compactFactWidth(uiLabel('%'), fontScale) : COMPACT_ROW.icon;
  const symbolWidth = categoryWidth + statusIcons * (COMPACT_ROW.icon + 2);
  const indexWidth = tier === null ? 0 : compactFactWidth(tier, fontScale);
  let showSecondary = secondary !== null
    && main >= primaryTextWidth + 14 + secondaryWidth + COMPACT_ROW.gap + symbolWidth
      + (hasPeers ? indexWidth + 2 : 0) + 2 * COMPACT_ROW.gap + 48;
  const metricsWidth = primaryTextWidth + 14 + (showSecondary ? secondaryWidth + COMPACT_ROW.gap : 0);
  const availableFacet = main - metricsWidth - 2 * COMPACT_ROW.gap - 80;
  const exactFacetWidth = compactFactWidth(facet.value, fontScale) + statusIcons * (COMPACT_ROW.icon + 2);
  let showFacetValue = facet.known && exactFacetWidth + (hasPeers ? indexWidth + 2 : 0) <= availableFacet;
  let showTier = tier !== null && (hasPeers || !showFacetValue);
  let showFacetSymbol = true, combinedStatus = false, showPrimaryIcon = true, warningOnly = false;
  const minimumIdentity = Math.max(24, COMPACT_ROW.fontSize * fontScale);
  const sizes = () => {
    const parts = [showFacetValue ? compactFactWidth(facet.value, fontScale) : showFacetSymbol ? categoryWidth : 0,
      warningOnly ? 0 : combinedStatus ? statusIcons ? COMPACT_ROW.icon : 0 : statusIcons * (COMPACT_ROW.icon + 2) - (statusIcons ? 2 : 0),
      showTier ? indexWidth : 0].filter(value => value > 0);
    const facetWidth = parts.reduce((sum, value) => sum + value, 0) + Math.max(0, parts.length - 1) * 2;
    const primaryWidth = warningOnly ? 16 : primaryTextWidth + (showPrimaryIcon ? 14 : 0);
    return { primaryWidth, facetWidth, identity: main - primaryWidth
      - (showSecondary ? secondaryWidth + COMPACT_ROW.gap : 0) - facetWidth - 2 * COMPACT_ROW.gap };
  };
  if (sizes().identity < minimumIdentity && showFacetValue) { showFacetValue = false; showTier = tier !== null; }
  if (sizes().identity < minimumIdentity) showSecondary = false;
  if (sizes().identity < minimumIdentity) combinedStatus = true;
  if (sizes().identity < minimumIdentity) showFacetSymbol = false;
  if (sizes().identity < minimumIdentity) showPrimaryIcon = false;
  if (sizes().identity < minimumIdentity) {
    // The native glyphs themselves cannot fit. A warning represents this compact
    // presentation limit; it never changes a known rate into an unknown value.
    warningOnly = true; showSecondary = false; showFacetValue = false; showFacetSymbol = false;
    showPrimaryIcon = false; combinedStatus = true;
    if (sizes().identity < minimumIdentity) showTier = false;
  }
  const final = sizes();
  return { main, primary: final.primaryWidth, secondary: secondaryWidth, showSecondary,
    identity: Math.max(0, final.identity), facet: final.facetWidth, showFacetValue, showTier,
    showFacetSymbol, combinedStatus, showPrimaryIcon, warningOnly };
}
