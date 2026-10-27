import type { RateRow } from '../types';
import type { PublicFormula, PublicProgramme, RateScenario } from './publicRateModel';
import { boundPublicProgramme, bindCurrentPublicRow, publicOfferDedupKey, publicProductOfferRows,
  rowWithPublicResolution, type PublicCatalogueView } from './publicRateIntegration';
import { representativePublicScenario } from './publicRateResolverIndex';
import { evaluatePublicCondition, nextPublicPricingBoundary, resolvePublicRate } from './publicRateResolver';
import { prepareMortgageComparisonRow, indexedMortgageComparisonRows, type MortgageComparisonInputs,
  type PreparedMortgageComparisonRow } from './mortgageComparison';
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
interface Entry { programme: PublicProgramme; candidate: RateRow; quote: RateRow; generated: boolean; key: string }

/** Exact fast lane for fixed public quotes with the four Mortgage input
 * predicates. Dynamic/tiered/conditional-component books use the existing
 * cooperative resolver; unsupported is never an empty or passing result. */
export async function prepareMortgageResultsIndex(options: {
  source: readonly RateRow[]; catalogue: PublicCatalogueView; context: RateConditionContext;
  includeNonStandard: boolean; cancelled: () => boolean;
}) {
  const { source, catalogue, context, includeNonStandard, cancelled } = options;
  const mandatory = getMandatoryEligibilityRevision(), suitability = getSuitabilityRevision();
  const stale = () => cancelled() || mandatory !== getMandatoryEligibilityRevision() || suitability !== getSuitabilityRevision();
  const asOf = new Date().toISOString(), at = Date.parse(asOf);
  let until = Infinity, checkpoint = performance.now();
  const pause = async () => {
    if (performance.now() - checkpoint >= 4) { await yieldToUi(0); checkpoint = performance.now(); }
    return stale();
  };
  await yieldToUi(0);
  if (stale() || catalogue.status !== 'ready' || !catalogue.allLoaded) return null;
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
  for (const product of catalogue.products) {
    if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      if (!supported(programme)) return null;
      until = Math.min(until, nextPublicPricingBoundary(programme, at));
      if (await pause()) return null;
    }
  }
  for (const original of source) {
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
      entries.push({ programme, candidate: row, quote: rowWithPublicResolution(row, resolved.resolution), generated: false, key: key ?? '' });
    }
    if (await pause()) return null;
  }
  for (const product of catalogue.products) {
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
        entries.push({ programme, candidate: row, quote: rowWithPublicResolution(row, resolved.resolution), generated: true, key });
      }
      if (await pause()) return null;
    }
  }
  const allQuotes = entries.map(entry => entry.quote);
  const eligible = await filterRowsCooperatively(allQuotes, { ...EMPTY_FILTERS, includeNonStandard }, context.details?.products, null, 'Mortgage', { cancelled: stale });
  if (!eligible || stale()) return null;
  const visible = new Set(eligible), mandatoryCandidates = new Set(mandatoryEligibleRows(candidates)), mandatoryQuotes = new Set(mandatoryEligibleRows(allQuotes));
  const scoped = new WeakMap<RateRow, PreparedMortgageComparisonRow>();
  for (const row of allQuotes) { scoped.set(row, prepareMortgageComparisonRow(row, context)); if (await pause()) return null; }
  const orders = new Map<string, RateRow[]>();
  for (const [sort, metric] of [['rate', 'headline'], ['rate', 'comparison'], ['comparison', 'comparison'], ['bank', 'headline']] as const) {
    const rows = await sortRowsCooperatively(eligible, sort, 'Mortgage', 'max', metric, { cancelled: stale });
    if (!rows) return null;
    orders.set(sort === 'bank' ? 'bank' : sort + ':' + metric, rows);
  }
  if (stale() || (Date.now() < at || Date.now() >= until)) return null;
  return {
    from: at, until, count: entries.length,
    select(scenario: RateScenario, inputs: MortgageComparisonInputs) {
      if (mandatory !== getMandatoryEligibilityRevision() || suitability !== getSuitabilityRevision() || (Date.now() < at || Date.now() >= until) || !scenario.purpose || !scenario.repayment) return null;
      const chosen = new Set<string>(), allowed = new Set<RateRow>(), priced: RateRow[] = [], visibleQuotes: RateRow[] = [];
      const queryAsOf = new Date().toISOString();
      const currentCandidates = [...candidates], currentMandatoryCandidates = candidates.filter(row => mandatoryCandidates.has(row)), currentMandatoryQuotes: RateRow[] = [];
      for (const entry of entries) {
        if (!entry.programme.conditions.every(condition => evaluatePublicCondition(condition, scenario, queryAsOf) === 'met')) continue;
        if (entry.generated && chosen.has(entry.key)) continue;
        if (entry.generated) { chosen.add(entry.key); currentCandidates.push(entry.candidate); if (mandatoryQuotes.has(entry.quote)) currentMandatoryCandidates.push(entry.candidate); }
        priced.push(entry.quote); if (mandatoryQuotes.has(entry.quote)) currentMandatoryQuotes.push(entry.quote);
        if (visible.has(entry.quote)) { visibleQuotes.push(entry.quote); allowed.add(entry.quote); }
      }
      const rawScope = indexedMortgageComparisonRows(priced, inputs, scoped);
      const gatedRows = rawScope.rows.filter(row => mandatoryQuotes.has(row));
      const scope = { ...rawScope, rows: gatedRows, unverified: gatedRows.filter(row => rawScope.unverifiedRows.has(row)).length };
      const scopeSet = new Set(scope.rows);
      return {
        candidates: currentCandidates, mandatoryCandidates: currentMandatoryCandidates, priced, mandatoryQuotes: currentMandatoryQuotes, visibleQuotes, scope, rawScope,
        filtered(filters: Filters, sort: SortKey, metric: MortgageRateMetric) {
          if (mandatory !== getMandatoryEligibilityRevision() || suitability !== getSuitabilityRevision() || (Date.now() < at || Date.now() >= until)) return null;
          if (filters.query.trim() || filters.accountFeatures.length || filters.eligibilityCriteria.length || (filters.factCriteria?.length ?? 0) || filters.includeNonStandard !== includeNonStandard) return null;
          const order = orders.get(sort === 'bank' ? 'bank' : sort + ':' + (sort === 'comparison' ? 'comparison' : metric));
          if (!order) return null;
          const matches = prepareRowFilter(filters, context.details?.products, null, 'Mortgage');
          return order.filter(row => allowed.has(row) && scopeSet.has(row) && matches(row));
        },
      };
    },
  };
}
export type MortgageResultsIndex = NonNullable<Awaited<ReturnType<typeof prepareMortgageResultsIndex>>>;
