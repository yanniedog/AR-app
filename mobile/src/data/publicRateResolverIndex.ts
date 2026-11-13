import { decimalText, publicDecimal } from './publicRateDecimal';
import { yieldToUi } from '../lib/yieldToUi';
import type { PublicCatalogueView } from './publicRateIntegration';
import { evaluatePublicCondition, nextPublicPricingBoundary, resolvePublicRate } from './publicRateResolver';
import type { PublicCondition, PublicProgramme, RateResolution, RateScenario } from './publicRateModel';

/** Edition-owned predicate index. Inputs are partitioned by canonical condition
 * truth, never rounded amount/LVR buckets. Tier arithmetic keeps exact inputs. */
export function createPublicRateResolverIndex() {
  const compiled = new WeakMap<PublicProgramme, { fingerprint: string; publication?: object; conditions: PublicCondition[]; fields: string[];
    values: Map<string, { from: number; until: number; value: RateResolution }> }>();
  const stats = { hits: 0, misses: 0, warmed: 0 };
  const resolve = (programme: PublicProgramme, scenario: RateScenario, asOf: string, immutablePublication?: object): RateResolution => {
    const at = Date.parse(asOf);
    if (!Number.isFinite(at)) return resolvePublicRate(programme, scenario, asOf);
    let index = compiled.get(programme);
    let fingerprint: string;
    // Canonical catalogue snapshots publish immutable programme values. Check
    // each object once within that explicit publication owner, rather than
    // serialising the book on every cache hit. Unowned/mutable callers retain
    // per-call validation; a replacement publication revalidates content too.
    try { fingerprint = immutablePublication && index?.publication === immutablePublication
      ? index.fingerprint : JSON.stringify(programme); } catch { return resolvePublicRate(programme, scenario, asOf); }
    if (!index || index.fingerprint !== fingerprint) {
      const conditions: PublicCondition[] = [], fields = new Set<string>(), visited = new Set<object>();
      let nodes = 0, supported = true;
      const visit = (value: unknown, depth = 0) => {
        if (!value || typeof value !== 'object') return;
        if (++nodes > 4096 || depth > 24 || visited.has(value)) { supported = false; return; }
        visited.add(value);
        if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
        const item = value as Record<string, unknown>;
        if (typeof item.conditionId === 'string' && typeof item.operator === 'string' && typeof item.field === 'string')
          conditions.push(item as unknown as PublicCondition);
        // Both whole-balance and weighted tiers conservatively retain the exact
        // input. A weighted rate may change without crossing any tier boundary.
        if (item.op === 'tiered' && typeof item.field === 'string') fields.add(item.field);
        Object.values(item).forEach(child => visit(child, depth + 1));
      };
      visit(programme);
      if (!supported) return resolvePublicRate(programme, scenario, asOf);
      index = { fingerprint, publication: immutablePublication, conditions, fields: [...fields], values: new Map() };
      compiled.set(programme, index);
    }
    index.publication = immutablePublication;
    const key = JSON.stringify([scenario.allowHistorical === true,
      index.conditions.map(condition => evaluatePublicCondition(condition, scenario, asOf)),
      index.fields.map(field => scenario[field]), asOf.slice(0, 10)]);
    const prior = index.values.get(key);
    if (prior && at >= prior.from && at < prior.until) { stats.hits++; return copy(prior.value); }
    stats.misses++;
    const value = resolvePublicRate(programme, scenario, asOf);
    // Cache only exact/current quotes. Unknown and failed results remain the
    // canonical resolver's responsibility, including malformed publications.
    if (value.status === 'exact' && value.verifiedCurrent) {
      const until = nextPublicPricingBoundary(programme, at);
      if (at < until) {
        if (index.values.size >= 8) index.values.delete(index.values.keys().next().value!);
        index.values.set(key, { from: at, until, value: copy(value) });
      }
    }
    return value;
  };
  const prepareMortgage = async (view: PublicCatalogueView, cancelled: () => boolean) => {
    await yieldToUi(0);
    if (cancelled()) return;
    let checkpoint = performance.now();
    const asOf = new Date().toISOString();
    for (const product of view.products) {
      if (product.section !== 'Mortgage' || product.status === 'legacy') continue;
      for (const programme of view.getProgrammes(product.productId)) {
        if (cancelled()) return;
        const sample = representativePublicScenario(programme.conditions);
        if (sample) { resolve(programme, sample, asOf, view); stats.warmed++; }
        if (performance.now() - checkpoint >= 4) {
          await yieldToUi(0);
          checkpoint = performance.now();
        }
      }
    }
  };
  return { resolve, stats, prepareMortgage,
    /** Existing programme objects must not change under the same owner; new
     * objects validate independently. Unowned resolve remains defensive. */
    resolveForPublication: (owner: object): typeof resolvePublicRate =>
      (programme, scenario, asOf) => resolve(programme, scenario, asOf, owner),
  };
}

// Callers own their result arrays; cached financial evidence is never mutable
// shared output. Source components/conditions retain their edition identities.
function copy(value: RateResolution): RateResolution {
  return { ...value, appliedComponents: [...value.appliedComponents],
    conditions: { met: [...value.conditions.met], unmet: [...value.conditions.unmet], unknown: [...value.conditions.unknown] },
    reasonCodes: [...value.reasonCodes], evidenceIds: [...value.evidenceIds],
    freshness: { ...value.freshness, reasonCodes: [...value.freshness.reasonCodes] },
    phases: value.phases.map(phase => ({ ...phase, reasonCodes: [...phase.reasonCodes], evidenceIds: [...phase.evidenceIds] })) };
}


/** Internal quote preparation only: samples never enter user state or results.
 * Actual queries must match every canonical condition state before reuse. */
export function representativePublicScenario(conditions: readonly PublicCondition[]): RateScenario | null {
  const result: RateScenario = {};
  const bounds = new Map<string, { low?: string; high?: string }>();
  try {
    for (const condition of conditions) {
      if (condition.operator === 'eq' && condition.value !== undefined) result[condition.field] = condition.value;
      else if (condition.operator === 'in' && condition.values?.length) result[condition.field] = condition.values[0];
      else if (condition.operator === 'bounds') {
        const prior = bounds.get(condition.field) ?? {};
        if (condition.minimum != null && (prior.low == null || publicDecimal(condition.minimum).compare(publicDecimal(prior.low)) > 0)) prior.low = condition.minimum;
        if (condition.maximum != null && (prior.high == null || publicDecimal(condition.maximum).compare(publicDecimal(prior.high)) < 0)) prior.high = condition.maximum;
        bounds.set(condition.field, prior);
      }
    }
    for (const [field, bound] of bounds) {
      if (result[field] !== undefined) continue;
      result[field] = bound.low != null && bound.high != null
        ? decimalText(publicDecimal(bound.low).add(publicDecimal(bound.high)).div(publicDecimal('2')))
        : bound.low != null ? decimalText(publicDecimal(bound.low).add(publicDecimal('1')))
          : bound.high != null ? decimalText(publicDecimal(bound.high).div(publicDecimal('2'))) : undefined;
    }
    return result;
  } catch { return null; }
}
