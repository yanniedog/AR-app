import { formatRate, formatTerm } from '../../data/format';
import type { ScopedFinancialConditionPresentation } from '../../data/scopedFinancialConditionFacts';
import { uiConditionRange, uiListedLvrRange } from '../../lib/financialUiCopy';
import { uiCount, uiJoin, uiLabel, uiMoney, type UiCopy, type UiText } from '../../lib/uiCopy';
import type { RateRow, SectionKey } from '../../types';

export const COMPACT_ROW = { action: 48, gap: 4, fontSize: 14, icon: 16, minHeight: 56 } as const;
/** The row's text determines its height. Artwork fits inside that height, never grows it. */
export function compactBankLogoFrame(width: number, rowHeight: number, fontScale: number, border = 0) {
  const inset = 3;
  const height = Math.max(0, rowHeight - 2 * inset - border);
  // Preserve a full metric rail on narrow/large-text screens. Wide marks remain
  // contained (letterboxed when necessary), rather than cropped or distorted.
  const maximum = Math.max(48, Math.min(112, width - 232 * Math.max(1, fontScale)));
  return { width: Math.min(maximum, Math.max(48, height * 2)), height, inset };
}
const peerCache = new WeakMap<readonly RateRow[], Map<string, Set<RateRow>>>();

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
  readonly showStatuses: boolean;
  readonly showPrimaryIcon: boolean;
  readonly warningOnly: boolean;
}

/** Preserve every fact in a rail that can be scrubbed at any text size. */
export function compactProductRowLayout(width: number, fontScale: number, primary: UiText,
  secondary: UiText | null, facet: CompactProductFacet, statusIcons: number,
  measuredPrimary = 0, measuredSecondary = 0, tier: UiText | null = null,
  logoWidth: number = COMPACT_ROW.action, productName: UiText = uiLabel('')): CompactProductRowLayout {
  const scale = Math.max(1, fontScale);
  const primaryWidth = Math.max(compactFactWidth(primary, scale), measuredPrimary) + COMPACT_ROW.icon + 6;
  const secondaryWidth = secondary === null ? 0
    : Math.max(compactFactWidth(secondary, scale), measuredSecondary) + COMPACT_ROW.icon + 6;
  const facetWidth = compactFactWidth(facet.value, scale) + COMPACT_ROW.icon + 6
    + statusIcons * (COMPACT_ROW.icon + 6)
    + (tier === null ? 0 : compactFactWidth(tier, scale) + COMPACT_ROW.icon + 6);
  const identity = Math.max(160 * scale, compactFactWidth(productName, scale) + 8);
  const content = primaryWidth + secondaryWidth + facetWidth + identity
    + (secondary === null ? 2 : 3) * COMPACT_ROW.gap;
  return { main: Math.max(content, width - logoWidth - COMPACT_ROW.action - 2 * COMPACT_ROW.gap),
    identity, primary: primaryWidth, secondary: secondaryWidth, showSecondary: secondary !== null,
    facet: facetWidth, showFacetValue: true, showTier: tier !== null, showFacetSymbol: true,
    combinedStatus: false, showStatuses: true, showPrimaryIcon: true, warningOnly: false };
}
