import type { RateRow } from '../types';
import type { PublicFormula, PublicProgramme, RateScenario } from './publicRateModel';
import { boundPublicProgramme, bindCurrentPublicRow, publicOfferDedupKey, publicProductOfferRows,
  rowWithPublicResolution, type PublicCatalogueView } from './publicRateIntegration';
import { representativePublicScenario } from './publicRateResolverIndex';
import { evaluatePublicCondition, nextPublicPricingBoundary, resolvePublicRate } from './publicRateResolver';
import { prepareMortgageComparisonRowsCooperatively, indexedMortgageComparisonRows, type MortgageComparisonInputs } from './mortgageComparison';
import type { RateConditionContext } from './rateConditions';
import { EMPTY_FILTERS, filterRowsCooperatively, prepareRowFilter, sortRowsCooperatively,
  type Filters, type MortgageRateMetric, type SortKey } from './selectors';
import { getMandatoryEligibilityRevision, mandatoryEligibleRows } from './eligibilityGate';
import { getSuitabilityRevision } from './suitabilityGate';
import { yieldToUi } from '../lib/yieldToUi';

const FIELDS = new Set(['amount', 'lvr', 'purpose', 'repayment']);
function fixedFormula(formula: PublicFormula, depth = 0): boolean {
  if (!formula || depth > 16) return false;
  if (formula.op === 'component') return true;
  if (formula.op === 'cap') return fixedFormula(formula.formula, depth + 1);
  return (formula.op === 'add' || formula.op === 'subtract') && formula.operands.every(value => fixedFormula(value, depth + 1));
}
function supported(programme: PublicProgramme): boolean {
  return programme.section === 'Mortgage' && fixedFormula(programme.formula!) && programme.conditions.every(condition => FIELDS.has(condition.field)) &&
    programme.components.every(component => component.conditions.length === 0) &&
    (programme.phases ?? []).every(phase => phase.conditions.length === 0 && fixedFormula(phase.formula));
}
interface Entry {
  programme: PublicProgramme | null;
  candidate: RateRow;
  quote: RateRow;
  generated: boolean;
  key: string;
  index: number;
  isMandatoryQuote: boolean;
  isVisible: boolean;
}

function entryBucketKey(programme: PublicProgramme | null): string {
  if (!programme) return '*\0*';
  let purpose = '*';
  let repayment = '*';
  for (const c of programme.conditions) {
    if (c.operator !== 'eq' || typeof c.value !== 'string') continue;
    if (purpose === '*' && c.field === 'purpose') purpose = c.value;
    else if (repayment === '*' && c.field === 'repayment') repayment = c.value;
  }
  return purpose + '\0' + repayment;
}

/** Exact fast lane for fixed public quotes with the four Mortgage input
 * predicates, and the already-published fixed rows in legacy core payloads.
 * Dynamic/tiered/conditional-component books use the existing
 * cooperative resolver; unsupported is never an empty or passing result. */
export async function prepareMortgageResultsIndex(options: {
  source: readonly RateRow[]; catalogue: PublicCatalogueView; context: RateConditionContext;
  includeNonStandard: boolean; cancelled: () => boolean;
}) {
  const { source, catalogue, context, includeNonStandard, cancelled } = options;
  const { core, manifest, coreIntegrity } = context;
  const legacy = catalogue.status === 'unavailable' && !catalogue.auditUnavailableReason && !!core && !!manifest &&
    !!coreIntegrity && coreIntegrity.core === core && coreIntegrity.runDate === core.run_date && manifest.run_date === core.run_date &&
    coreIntegrity.coreSha256 === manifest.files.core.sha256 && /^[a-f0-9]{64}$/.test(manifest.files.core.sha256) &&
    manifest.public_rate_catalogue === undefined;
  const products = legacy ? [] : catalogue.products;
  const mandatory = getMandatoryEligibilityRevision(), suitability = getSuitabilityRevision();
  const stale = () => cancelled() || mandatory !== getMandatoryEligibilityRevision() || suitability !== getSuitabilityRevision();
  const asOf = new Date().toISOString(), at = Date.parse(asOf);
  let until = Infinity, checkpoint = performance.now();
  const pause = async () => {
    await yieldToUi(0); checkpoint = performance.now();
    return stale();
  };
  // Avoid a resolved-Promise/microtask round trip for every source row. Only
  // cross the async boundary after the CPU slice budget, retaining gate checks
  // throughout preparation and after each actual yield.
  const sliceExpired = () => performance.now() - checkpoint >= 4;
  await yieldToUi(0);
  if (stale() || !legacy && (catalogue.status !== 'ready' || !catalogue.allLoaded)) return null;
  const coreKeys = new Set<string>(), entries: Entry[] = [], candidates: RateRow[] = [];
  const quote = (programme: PublicProgramme) => {
    const sample = representativePublicScenario(programme.conditions);
    if (!sample) return null;
    sample.purpose ??= 'OWNER_OCCUPIED'; sample.repayment ??= 'PRINCIPAL_AND_INTEREST';
    sample.amount ??= '1'; sample.lvr ??= '0.5';
    const resolution = resolvePublicRate(programme, sample, asOf);
    return resolution.status === 'exact' && resolution.verifiedCurrent && resolution.payableRate != null ? { resolution, sample } : null;
  };
  // Prove the entire relevant book is supported before publishing any index.
  for (const product of products) {
    if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      if (!supported(programme)) return null;
      until = Math.min(until, nextPublicPricingBoundary(programme, at));
      if (stale() || sliceExpired() && await pause()) return null;
    }
  }
  for (const original of source) {
    if (legacy) {
      candidates.push(original);
      entries.push({ programme: null, candidate: original, quote: original, generated: false, key: '', index: entries.length, isMandatoryQuote: false, isVisible: false });
      if (stale() || sliceExpired() && await pause()) return null;
      continue;
    }
    if (catalogue.getProduct(original.product_key)?.status === 'legacy') continue;
    const row = bindCurrentPublicRow(original, catalogue);
    const key = row.public_offer_id ? publicOfferDedupKey(row.product_key, row.public_offer_id) : null;
    if (key && coreKeys.has(key)) continue;
    if (key) coreKeys.add(key);
    candidates.push(row);
    const programme = boundPublicProgramme(row, catalogue);
    if (programme) {
      const resolved = quote(programme);
      if (!resolved) return null; // Cannot prove this quote independently of an actual scenario.
      entries.push({ programme, candidate: row, quote: rowWithPublicResolution(row, resolved.resolution), generated: false, key: key ?? '', index: entries.length, isMandatoryQuote: false, isVisible: false });
    }
    if (stale() || sliceExpired() && await pause()) return null;
  }
  for (const product of products) {
    if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      const key = publicOfferDedupKey(product.productKey, programme.offerId);
      if (!coreKeys.has(key)) {
        // Generated row facet text must be invariant too. Ambiguous/generated
        // facet alternatives retain the canonical scenario-dependent path.
        if (!['purpose', 'repayment'].every(field => programme.conditions.some(c => c.field === field && c.operator === 'eq'))) return null;
        const resolved = quote(programme);
        if (!resolved) return null;
        const view = { ...catalogue, getProgrammes: () => [programme] };
        const row = publicProductOfferRows(product, view, resolved.sample, () => asOf)[0];
        if (!row || boundPublicProgramme(row, catalogue) !== programme) return null;
        entries.push({ programme, candidate: row, quote: rowWithPublicResolution(row, resolved.resolution), generated: true, key, index: entries.length, isMandatoryQuote: false, isVisible: false });
      }
      if (stale() || sliceExpired() && await pause()) return null;
    }
  }
  const allQuotes = entries.map(entry => entry.quote);
  const eligible = await filterRowsCooperatively(allQuotes, { ...EMPTY_FILTERS, includeNonStandard }, context.details?.products, null, 'Mortgage', { cancelled: stale });
  if (!eligible || stale()) return null;
  const visible = new Set(eligible), mandatoryCandidates = new Set(mandatoryEligibleRows(candidates)), mandatoryQuotes = new Set(mandatoryEligibleRows(allQuotes));
  const baseMandatoryCandidates = candidates.filter(row => mandatoryCandidates.has(row));
  const buckets = new Map<string, Entry[]>();
  for (const entry of entries) {
    entry.isMandatoryQuote = mandatoryQuotes.has(entry.quote);
    entry.isVisible = visible.has(entry.quote);
    const bKey = entryBucketKey(entry.programme);
    const bucket = buckets.get(bKey);
    if (bucket) bucket.push(entry); else buckets.set(bKey, [entry]);
  }
  const scoped = await prepareMortgageComparisonRowsCooperatively(allQuotes, context, { cancelled: stale });
  if (!scoped) return null;
  const orders = new Map<string, RateRow[]>();
  for (const [sort, metric] of [['rate', 'headline'], ['rate', 'comparison'], ['bank', 'headline']] as const) {
    const rows = await sortRowsCooperatively(eligible, sort, 'Mortgage', 'max', metric, { cancelled: stale });
    if (!rows) return null;
    orders.set(sort === 'bank' ? 'bank' : sort + ':' + metric, rows);
    // Both canonical comparison modes use effectiveFraction, the same null
    // ordering, provider/name tie-break and original-row stability.
    if (sort === 'rate' && metric === 'comparison') orders.set('comparison:comparison', rows);
  }
  if (stale() || (Date.now() < at || Date.now() >= until)) return null;
  return {
    from: at, until, count: entries.length,
    select(scenario: RateScenario, inputs: MortgageComparisonInputs) {
      if (mandatory !== getMandatoryEligibilityRevision() || suitability !== getSuitabilityRevision() || (Date.now() < at || Date.now() >= until) || !scenario.purpose || !scenario.repayment) return null;
      const chosen = new Set<string>(), allowed = new Set<RateRow>(), priced: RateRow[] = [], visibleQuotes: RateRow[] = [];
      const queryAsOf = new Date().toISOString();
      const currentCandidates = [...candidates], currentMandatoryCandidates = [...baseMandatoryCandidates], currentMandatoryQuotes: RateRow[] = [];
      const bucketKeys = [
        scenario.purpose + '\0' + scenario.repayment,
        scenario.purpose + '\0*',
        '*\0' + scenario.repayment,
        '*\0*',
      ];
      const activeBuckets: Entry[][] = [];
      for (const bKey of bucketKeys) {
        const bucket = buckets.get(bKey);
        if (bucket) activeBuckets.push(bucket);
      }
      const matchedEntries: Entry[] = activeBuckets.length === 1 ? activeBuckets[0] : activeBuckets.flat().sort((a, b) => a.index - b.index);
      for (const entry of matchedEntries) {
        if (entry.programme && !entry.programme.conditions.every(condition => evaluatePublicCondition(condition, scenario, queryAsOf) === 'met')) continue;
        if (entry.generated && chosen.has(entry.key)) continue;
        if (entry.generated) { chosen.add(entry.key); currentCandidates.push(entry.candidate); if (entry.isMandatoryQuote) currentMandatoryCandidates.push(entry.candidate); }
        priced.push(entry.quote); if (entry.isMandatoryQuote) currentMandatoryQuotes.push(entry.quote);
        if (entry.isVisible) { visibleQuotes.push(entry.quote); allowed.add(entry.quote); }
      }
      const rawScope = indexedMortgageComparisonRows(priced, inputs, scoped);
      const gatedRows = rawScope.rows.filter(row => mandatoryQuotes.has(row));
      const scope = { ...rawScope, rows: gatedRows, unverified: gatedRows.filter(row => rawScope.unverifiedRows.has(row)).length };
      const scopeSet = new Set(scope.rows);
      const scopedOrders = new Map<string, RateRow[]>();
      const filteredCache = new Map<string, RateRow[]>();
      return {
        candidates: currentCandidates, mandatoryCandidates: currentMandatoryCandidates, priced, mandatoryQuotes: currentMandatoryQuotes, visibleQuotes, scope, rawScope,
        filtered(filters: Filters, sort: SortKey, metric: MortgageRateMetric) {
          if (mandatory !== getMandatoryEligibilityRevision() || suitability !== getSuitabilityRevision() || (Date.now() < at || Date.now() >= until)) return null;
          if (filters.query.trim() || filters.accountFeatures.length || filters.eligibilityCriteria.length || (filters.factCriteria?.length ?? 0) || filters.includeNonStandard !== includeNonStandard) return null;
          const orderKey = sort === 'bank' ? 'bank' : sort + ':' + (sort === 'comparison' ? 'comparison' : metric);
          const order = orders.get(orderKey);
          if (!order) return null;
          const cacheKey = orderKey + '\0' + JSON.stringify([filters.providers, filters.rateTypes, filters.lvrTiers, filters.repaymentTypes, filters.loanPurposes, filters.depositKinds, filters.interestPayments]);
          const cached = filteredCache.get(cacheKey);
          if (cached) return cached;
          let scopedOrder = scopedOrders.get(orderKey);
          if (!scopedOrder) {
            scopedOrder = order.filter(row => allowed.has(row) && scopeSet.has(row));
            scopedOrders.set(orderKey, scopedOrder);
          }
          const matches = prepareRowFilter(filters, context.details?.products, null, 'Mortgage');
          const result = scopedOrder.filter(matches);
          if (filteredCache.size >= 8) filteredCache.delete(filteredCache.keys().next().value!);
          filteredCache.set(cacheKey, result);
          return result;
        },
      };
    },
  };
}
export type MortgageResultsIndex = NonNullable<Awaited<ReturnType<typeof prepareMortgageResultsIndex>>>;
