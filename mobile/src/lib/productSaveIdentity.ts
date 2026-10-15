import { formatRate, formatTerm } from '../data/format';
import { rateConditionality } from '../data/rateConditionalFacts';
import { ratePresentation } from '../data/ratePresentation';
import type { MortgageRateMetric } from '../data/selectors';
import { verifiedDetailsSha } from '../data/detailsIdentity';
import { validRateConditions, type RateConditionContext } from '../data/rateConditions';
import { scopedFinancialConditionFacts, type ScopedFinancialConditionPresentation } from '../data/scopedFinancialConditionFacts';
import type { RateConditions, RateRow, SectionKey } from '../types';
import { uiBalanceTier, uiConditionTag, uiListedLvr, uiListedLvrRange, uiLoanPurpose, uiRateStructure, uiRepayment } from './financialUiCopy';
import { uiCount, uiIdentifier, uiJoin, uiLabel, uiProductName, uiProductReference, uiProviderName, type UiCopy, type UiText } from './uiCopy';

interface ProductPeers {
  readonly members: Set<RateRow>;
  readonly identities: Map<string, RateRow[]>;
  readonly metrics: Map<string, Map<string, Map<string, RateRow[]>>>;
  readonly conditions: WeakMap<RateConditions, {
    details: RateConditionContext['details']; coreSha: string; detailsSha: string;
    section: SectionKey; generationId: string | null; values: Map<number, ScopedFinancialConditionPresentation>;
  }>;
}
const sourcePeers = new WeakMap<readonly RateRow[], ProductPeers>();
function spokenIdentity(row: RateRow): UiText { return uiJoin(uiProductName(row), ', ', uiProviderName(row)); }
function peersFor(rows: readonly RateRow[]): ProductPeers {
  const previous = sourcePeers.get(rows);
  if (previous) return previous;
  const identities = new Map<string, RateRow[]>(), members = new Set<RateRow>();
  for (const row of rows) {
    members.add(row);
    const name = spokenIdentity(row), peers = identities.get(name);
    if (peers) peers.push(row); else identities.set(name, [row]);
  }
  const result = { members, identities, metrics: new Map(), conditions: new WeakMap() };
  sourcePeers.set(rows, result);
  return result;
}
function metricKey(label: UiCopy, value: UiText): string { return JSON.stringify([label, value]); }
function metricPeers(index: ProductPeers, row: RateRow, section: SectionKey, metric: MortgageRateMetric): readonly RateRow[] {
  const key = `${section}:${metric}`;
  let products = index.metrics.get(key);
  if (!products) { products = new Map(); index.metrics.set(key, products); }
  const name = spokenIdentity(row);
  let groups = products.get(name);
  if (!groups) {
    groups = new Map(); products.set(name, groups);
    // Distinct source keys can have the same spoken name. Use the full source scope.
    for (const peer of index.identities.get(name) ?? []) {
      const presentation = ratePresentation(peer, section, metric);
      const identity = metricKey(presentation.primaryLabel, formatRate(presentation.primary));
      const group = groups.get(identity);
      if (group) group.push(peer); else groups.set(identity, [peer]);
    }
  }
  const presentation = ratePresentation(row, section, metric);
  return groups.get(metricKey(presentation.primaryLabel, formatRate(presentation.primary))) ?? [];
}

/** Same-publication admission as scopedRateConditions, with indexed section membership. */
function sourceConditions(index: ProductPeers, row: RateRow, section: SectionKey,
  context: RateConditionContext): ScopedFinancialConditionPresentation | null {
  const { core, details, manifest, coreIntegrity } = context;
  const record = details?.products[row.product_key]?.rateConditions;
  if (!record || !core || !details || !manifest || !coreIntegrity
    || coreIntegrity.core !== core || coreIntegrity.coreSha256 !== manifest.files.core.sha256
    || coreIntegrity.runDate !== core.run_date || core.run_date !== details.run_date || core.run_date !== manifest.run_date
    || !/^[a-f0-9]{64}$/.test(manifest.files.core.sha256) || !/^[a-f0-9]{64}$/.test(manifest.files.details.sha256)
    || verifiedDetailsSha(details) !== manifest.files.details.sha256 || !index.members.has(row)) return null;
  const coreSha = manifest.files.core.sha256, detailsSha = manifest.files.details.sha256;
  const generationId = manifest.payload_revision?.generation_id ?? null;
  let cached = index.conditions.get(record);
  if (!cached || cached.details !== details || cached.coreSha !== coreSha
    || cached.detailsSha !== detailsSha || cached.section !== section || cached.generationId !== generationId) {
    if (!validRateConditions(record)) return null;
    cached = { details, coreSha, detailsSha, section, generationId, values: new Map() };
    index.conditions.set(record, cached);
  }
  const rateIndex = row.rate_index;
  if (!Number.isSafeInteger(rateIndex) || rateIndex! < 1) return null;
  const previous = cached.values.get(rateIndex!);
  if (previous) return previous;
  const value = scopedFinancialConditionFacts({ status: 'available', sourceSha256: record.sourceSha256,
    coreSha256: coreSha, detailsSha256: detailsSha, generationId,
    entries: record.entries.filter(entry => entry.rateIndex === rateIndex && entry.rateFamily === (section === 'Mortgage' ? 'lending' : 'deposit')) });
  cached.values.set(rateIndex!, value);
  return value;
}

function joinFacts(facts: readonly UiText[]): UiText | null {
  return facts.length ? uiJoin(...facts.flatMap((fact, i) => i ? [uiLabel(' · '), fact] : [fact])) : null;
}
type Discriminator = 'lvr' | 'term' | 'balance' | 'structure' | 'purpose' | 'repayment' | 'kind' | 'account' | 'payment' | 'secondary';
const DISCRIMINATORS: Readonly<Record<SectionKey, readonly Discriminator[]>> = {
  Mortgage: ['lvr', 'term', 'structure', 'purpose', 'repayment', 'balance', 'account', 'secondary'],
  TD: ['term', 'balance', 'payment', 'kind', 'account'],
  Savings: ['kind', 'balance', 'term', 'account'],
};
function known(value: UiText): UiText | null { return value === 'Unknown' || value === 'Unverified' || !value ? null : value; }
function discriminator(field: Discriminator, row: RateRow, section: SectionKey, metric: MortgageRateMetric,
  conditions: ScopedFinancialConditionPresentation | null): UiText | null {
  const facts = conditions?.facts ?? [];
  switch (field) {
    case 'lvr': {
      const published = facts.filter(fact => fact.kind === 'published-lvr-range');
      return published.length ? joinFacts(published.map(uiConditionTag))
        : known(uiListedLvrRange(row)) ? uiListedLvr(row) : null;
    }
    case 'term': {
      const published = facts.filter(fact => fact.kind === 'published-term-range');
      return published.length ? joinFacts(published.map(uiConditionTag)) : known(formatTerm({ ...row, ribbon_fixed_term: undefined }));
    }
    case 'balance': {
      const published = facts.filter(fact => fact.kind === 'published-balance-range');
      if (published.length) return joinFacts(published.map(uiConditionTag));
      if (row.balance_min == null && row.balance_max == null) return null;
      const value = uiBalanceTier(row);
      return value === uiJoin('Balance', ' ', 'Unknown') || value === uiJoin('Balance', ' ', 'Unverified') ? null : value;
    }
    case 'structure': return known(uiRateStructure(row));
    case 'purpose': return known(uiLoanPurpose(row));
    case 'repayment': return known(uiRepayment(row));
    case 'kind': {
      const kind = rateConditionality(row, section);
      return kind === 'base' ? uiLabel('Ongoing') : kind === 'bonus' ? uiLabel('Bonus rate') : kind === 'intro' ? uiLabel('Introductory') : null;
    }
    case 'account': return row.account_class === 'standard' ? uiLabel('Standard') : row.account_class === 'non_standard' ? uiLabel('Non-standard') : null;
    case 'payment': return row.interest_payment === 'MONTHLY' ? uiLabel('Monthly') : row.interest_payment === 'ANNUALLY' ? uiLabel('Annually') : row.interest_payment === 'AT_MATURITY' ? uiLabel('at maturity') : null;
    case 'secondary': {
      const presentation = ratePresentation(row, section, metric);
      return presentation.secondary === null || !presentation.secondaryLabel ? null : uiJoin(presentation.secondaryLabel, ' ', formatRate(presentation.secondary));
    }
  }
}

export function productSaveIdentity(row: RateRow, section: SectionKey, metric: MortgageRateMetric,
  context: RateConditionContext,
  displayed?: { label: UiCopy; value: string | number | null }): { readonly name: UiText; readonly testID: string } {
  const presentation = ratePresentation(row, section, metric);
  const label = displayed?.label ?? presentation.primaryLabel;
  const rate = formatRate(displayed ? displayed.value : presentation.primary);
  const exact = Number.isInteger(row.rate_index);
  const parts: UiText[] = [uiProductName(row), uiProviderName(row)];
  if (exact) parts.push(uiJoin(label, ' ', rate));
  const rows = context.core?.sections[section]?.rates;
  const index = rows ? peersFor(rows) : null;
  let unresolved = exact;
  let indexAlsoCollides = false;
  if (exact && index?.members.has(row) && !displayed) {
    let remaining = metricPeers(index, row, section, metric).filter(peer => peer.product_key !== row.product_key || peer.rate_index !== row.rate_index);
    for (const field of DISCRIMINATORS[section]) {
      if (!remaining.length) break;
      const own = discriminator(field, row, section, metric, sourceConditions(index, row, section, context));
      if (!own) continue;
      const next = remaining.filter(peer => {
        const value = discriminator(field, peer, section, metric, sourceConditions(index, peer, section, context));
        // Missing evidence cannot establish that a sibling is a different tier.
        return value === null || value === own;
      });
      if (next.length < remaining.length) { parts.push(own); remaining = next; }
    }
    unresolved = remaining.length > 0;
    indexAlsoCollides = remaining.some(peer => peer.rate_index === row.rate_index);
  }
  if (unresolved) parts.push(uiJoin('Rate index', ' ', uiCount(row.rate_index)));
  if (indexAlsoCollides) parts.push(uiJoin('Product ID', ' ', row.product_id ? uiIdentifier(row.product_id) : uiProductReference(row)));
  return { name: uiJoin(...parts.flatMap((part, i) => i ? [uiLabel(', '), part] : [part])),
    testID: `rate-save:${encodeURIComponent(row.product_key)}:${Number.isInteger(row.rate_index) ? row.rate_index : 'all'}` };
}
