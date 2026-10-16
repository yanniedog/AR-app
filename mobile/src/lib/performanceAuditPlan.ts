import { ROOT } from '../data/taxonomy';
import { EMPTY_FILTERS, filterRows } from '../data/selectors';
import { isSuitabilityFilterReady } from '../data/suitabilityGate';
import { savedRateId } from '../data/savedRates';
import { SECTION_KEYS, type CorePayload, type ProductDetail, type RateRow, type SectionKey } from '../types';
import { MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID } from './performanceAuditProfile';

export const DEEP_AUDIT_PLAN_SCHEMA_VERSION = 2 as const;
export const DEEP_AUDIT_PASS_IDS = ['first-pass', 'repeat'] as const;

export type DeepAuditPassId = (typeof DEEP_AUDIT_PASS_IDS)[number];

export type DeepAuditReadinessCategory =
  | 'app'
  | 'audit-state'
  | 'bank-history'
  | 'bank-insights'
  | 'data'
  | 'details'
  | 'economic-data'
  | 'graphics'
  | 'list'
  | 'local-state'
  | 'log-buffer'
  | 'logos'
  | 'preferences'
  | 'product-history'
  | 'rba-calendar'
  | 'redirect'
  | 'scenario-storage'
  | 'search-index'
  | 'suitability'
  | 'update-status';

export const DEEP_AUDIT_EXCLUDED_ACTION_IDS = [
  'onboarding.complete',
  'notifications.enable',
  'app-lock.toggle',
  'data.refresh',
  'data.cache.clear',
  'app-update.download',
  'app-update.install',
  'external-link.open',
  'share.open',
  'clipboard.write',
  'debug-log.clear',
  'debug-log.upload',
  'debug-log.delete-upload',
  'diagnostics-consent.toggle',
  'financial-input.edit',
] as const;

export type DeepAuditExcludedActionId =
  (typeof DEEP_AUDIT_EXCLUDED_ACTION_IDS)[number];

export interface DeepAuditExactProduct {
  section: SectionKey;
  provider: string;
  productKey: string;
  productName: string;
  /** Exact tier identity. Null means the source row did not publish an index. */
  rateIndex: number | null;
  offerId?: string;
  programmeId?: string;
  selectionToken: string;
  taxonomyPath: string[];
}

export interface DeepAuditDerivedInputs {
  datasetDate: string | null;
  section: SectionKey | null;
  taxonomyPath: string[];
  provider: string | null;
  searchQuery: string | null;
  primaryProduct: DeepAuditExactProduct | null;
  secondaryProduct: DeepAuditExactProduct | null;
  compareSelectionTokens: string[];
  /** A bounded foreground sample, never evidence that the entire catalogue rendered. */
  sampledProducts: DeepAuditExactProduct[];
  sampling: {
    seed: string;
    method: 'section-provider-product-tier';
    filterReady: boolean;
    eligibleProducts: number | null;
    eligibleProviders: number | null;
    sampledProducts: number;
    sampledProviders: number;
    sampledSections: number;
    fullCatalogueRendered: false;
  };
}

export interface DeepAuditSelectionOptions {
  /** Use the session ID, keeping the same seed for both passes and any plan rebuild. */
  seed?: string;
  includeNonStandard?: boolean;
  detailsProducts?: Record<string, ProductDetail> | null;
}

export interface DeepAuditSkipSafety {
  maySkip: boolean;
  /** Runtime conditions under which skipping is honest and safe. */
  when: string[];
  reason: string;
}

export type DeepAuditStateImpact = 'none' | 'local-only' | 'restorable';

export interface DeepAuditSafety {
  stateImpact: DeepAuditStateImpact;
  unsafeActionsExcluded: DeepAuditExcludedActionId[];
}

export type DeepAuditParameter = string | number | boolean | null | string[];

export interface DeepAuditStep {
  id: string;
  passId: DeepAuditPassId;
  scenarioId: string;
  /** 0 route, 1 primary control, 2 deep control, 3 graph/leaf interaction. */
  depth: 0 | 1 | 2 | 3;
  semanticActionId: string;
  expectedPath: string;
  expectedSurface: string;
  readiness: DeepAuditReadinessCategory[];
  optional: boolean;
  skipReason: string | null;
  skipSafety: DeepAuditSkipSafety;
  mutatesRestorableState: boolean;
  safety: DeepAuditSafety;
  parameters: Record<string, DeepAuditParameter>;
}

export interface DeepAuditPass {
  id: DeepAuditPassId;
  label: string;
  steps: DeepAuditStep[];
}

export interface DeepPerformanceAuditPlan {
  schemaVersion: typeof DEEP_AUDIT_PLAN_SCHEMA_VERSION;
  coverageProfile: typeof MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID;
  safeActionCount: number;
  inputs: DeepAuditDerivedInputs;
  excludedUnsafeActions: DeepAuditExcludedActionId[];
  passes: DeepAuditPass[];
}

interface StepTemplate {
  scenarioId: string;
  depth: DeepAuditStep['depth'];
  semanticActionId: string;
  expectedPath: string;
  expectedSurface: string;
  readiness: DeepAuditReadinessCategory[];
  optional?: boolean;
  skipReason?: string | null;
  skipWhen?: string[];
  skipExplanation?: string;
  stateImpact?: DeepAuditStateImpact;
  unsafeActionsExcluded?: DeepAuditExcludedActionId[];
  parameters?: Record<string, DeepAuditParameter>;
  repeatParameters?: Record<string, DeepAuditParameter>;
}

interface ScenarioDefaults {
  expectedPath: string;
  expectedSurface: string;
  readiness: DeepAuditReadinessCategory[];
  optional?: boolean;
  skipReason?: string | null;
  skipWhen?: string[];
  skipExplanation?: string;
  unsafeActionsExcluded?: DeepAuditExcludedActionId[];
}

interface ActionTemplate extends Omit<StepTemplate, 'scenarioId'> {
  expectedPath: string;
  expectedSurface: string;
  readiness: DeepAuditReadinessCategory[];
}

const NO_UNSAFE_ACTIONS: DeepAuditExcludedActionId[] = [];

function uniqueReadiness(
  ...groups: DeepAuditReadinessCategory[][]
): DeepAuditReadinessCategory[] {
  return [...new Set(groups.flat())];
}

/** Asset families that are surface-specific and must not leak across destinations. */
const DESTINATION_ASSET_READINESS = new Set<DeepAuditReadinessCategory>([
  'graphics',
  'logos',
  'list',
]);

/**
 * Merge scenario defaults with per-action readiness. When the action changes
 * expected surface/path and supplies its own readiness, drop inherited
 * graphics/logos/list requirements so e.g. compare.dismiss → rates.results
 * does not demand a graphic probe the search surface never registers.
 */
function resolveStepReadiness(
  defaults: ScenarioDefaults,
  action: Partial<ActionTemplate> & Pick<ActionTemplate, 'semanticActionId' | 'depth'>,
): DeepAuditReadinessCategory[] {
  const expectedSurface = action.expectedSurface ?? defaults.expectedSurface;
  const expectedPath = action.expectedPath ?? defaults.expectedPath;
  const destinationChanged =
    expectedSurface !== defaults.expectedSurface || expectedPath !== defaults.expectedPath;
  if (destinationChanged && action.readiness) {
    const kept = defaults.readiness.filter((entry) => !DESTINATION_ASSET_READINESS.has(entry));
    return uniqueReadiness(kept, action.readiness);
  }
  return uniqueReadiness(defaults.readiness, action.readiness ?? []);
}

function exactRateIndex(row: RateRow): number | null {
  return Number.isInteger(row.rate_index) ? row.rate_index! : null;
}

function selectionToken(productKey: string, rateIndex: number | null): string {
  return rateIndex == null ? productKey : `${rateIndex}#${productKey}`;
}

function taxonomyPath(row: RateRow, section: SectionKey): string[] {
  const segments = (row.taxonomy_path ?? '').split('.').filter(Boolean);
  return segments[0] === ROOT[section] ? segments.slice(1) : [];
}

/** Seeded Fisher-Yates, with a canonical input order so a seed is reproducible. */
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** Give small banks the same opportunity as banks publishing many rate tiers. */
function stratifiedRows(rows: RateRow[], random: () => number): RateRow[] {
  const providers = new Map<string, Map<string, RateRow[]>>();
  for (const row of rows) {
    const products = providers.get(row.provider) ?? new Map<string, RateRow[]>();
    const tiers = products.get(row.product_key) ?? [];
    tiers.push(row);
    products.set(row.product_key, tiers);
    providers.set(row.provider, products);
  }
  const queues = shuffled([...providers.keys()].sort(), random).map(provider => {
    const products = providers.get(provider)!;
    return shuffled([...products.keys()].sort(), random).map(key => {
      const tiers = products.get(key)!.slice().sort((a, b) =>
        (exactRateIndex(a) ?? -1) - (exactRateIndex(b) ?? -1) ||
        (a.public_offer_id ?? '').localeCompare(b.public_offer_id ?? '') ||
        (a.public_programme_id ?? '').localeCompare(b.public_programme_id ?? ''));
      return tiers[Math.floor(random() * tiers.length)];
    });
  });
  const selected: RateRow[] = [];
  // Two products per section, different banks where possible. No top-N prefilter.
  for (let round = 0; selected.length < 2; round += 1) {
    let added = false;
    for (const queue of queues) {
      if (queue[round]) { selected.push(queue[round]); added = true; }
      if (selected.length === 2) break;
    }
    if (!added) break;
  }
  return selected;
}

function exactProduct(row: RateRow, section: SectionKey): DeepAuditExactProduct {
  const rateIndex = exactRateIndex(row);
  return {
    section,
    provider: row.provider,
    productKey: row.product_key,
    productName: row.product_name,
    rateIndex,
    selectionToken: row.public_offer_id ? `offer:${row.public_offer_id}#${row.product_key}` : selectionToken(row.product_key, rateIndex),
    ...(row.public_offer_id ? { offerId: row.public_offer_id } : {}),
    ...(row.public_programme_id ? { programmeId: row.public_programme_id } : {}),
    taxonomyPath: taxonomyPath(row, section),
  };
}

/**
 * Sample only currently eligible rows. The mandatory profile gate remains in
 * force even during the audit's temporary full-catalogue opt-in. Every eligible
 * bank, product and exact tier is reachable, without alphabetical preference.
 */
export function deriveDeepAuditInputs(
  core: CorePayload | null,
  options: DeepAuditSelectionOptions = {},
): DeepAuditDerivedInputs {
  const seed = options.seed ?? core?.run_date ?? 'no-payload';
  const random = seededRandom(seed);
  const filterReady = Boolean(core) && isSuitabilityFilterReady(options.includeNonStandard ?? false);
  const eligibleProducts = new Set<string>();
  const eligibleProviders = new Set<string>();
  const samples = new Map<SectionKey, DeepAuditExactProduct[]>();
  for (const section of SECTION_KEYS) {
    const rows = core && filterReady ? filterRows(
      core.sections[section]?.rates ?? [],
      { ...EMPTY_FILTERS, includeNonStandard: options.includeNonStandard ?? false },
      options.detailsProducts,
      null,
      section,
    ).filter(row => row.product_key.trim() && row.provider.trim()) : [];
    for (const row of rows) {
      eligibleProducts.add(row.product_key);
      eligibleProviders.add(row.provider);
    }
    samples.set(section, stratifiedRows(rows, random).map(row => exactProduct(row, section)));
  }
  const sections = shuffled(SECTION_KEYS, random);
  const chosenSection = sections.find(section => samples.get(section)!.length >= 2)
    ?? sections.find(section => samples.get(section)!.length > 0) ?? null;
  const primaryProduct = chosenSection ? samples.get(chosenSection)![0] ?? null : null;
  const secondaryProduct = chosenSection ? samples.get(chosenSection)![1] ?? null : null;
  const sampledProducts = sections.flatMap(section => samples.get(section)!);
  return {
    datasetDate: core?.run_date ?? null,
    section: chosenSection,
    taxonomyPath: primaryProduct?.taxonomyPath ?? [],
    provider: primaryProduct?.provider ?? null,
    searchQuery: primaryProduct?.provider ?? null,
    primaryProduct,
    secondaryProduct,
    compareSelectionTokens: primaryProduct && secondaryProduct
      ? [primaryProduct.selectionToken, secondaryProduct.selectionToken] : [],
    sampledProducts,
    sampling: {
      seed, method: 'section-provider-product-tier', filterReady,
      eligibleProducts: filterReady ? eligibleProducts.size : null,
      eligibleProviders: filterReady ? eligibleProviders.size : null,
      sampledProducts: sampledProducts.length,
      sampledProviders: new Set(sampledProducts.map(product => product.provider)).size,
      sampledSections: new Set(sampledProducts.map(product => product.section)).size,
      fullCatalogueRendered: false,
    },
  };
}

function scenario(
  templates: StepTemplate[],
  scenarioId: string,
  defaults: ScenarioDefaults,
  actions: (Partial<ActionTemplate> & Pick<ActionTemplate, 'semanticActionId' | 'depth'>)[],
): void {
  for (const action of actions) {
    templates.push({
      scenarioId,
      depth: action.depth,
      semanticActionId: action.semanticActionId,
      expectedPath: action.expectedPath ?? defaults.expectedPath,
      expectedSurface: action.expectedSurface ?? defaults.expectedSurface,
      readiness: resolveStepReadiness(defaults, action),
      optional: action.optional ?? defaults.optional ?? false,
      skipReason: action.skipReason ?? defaults.skipReason ?? null,
      skipWhen: action.skipWhen ?? defaults.skipWhen ?? [],
      skipExplanation: action.skipExplanation ?? defaults.skipExplanation,
      stateImpact: action.stateImpact ?? 'none',
      unsafeActionsExcluded:
        action.unsafeActionsExcluded ?? defaults.unsafeActionsExcluded ?? NO_UNSAFE_ACTIONS,
      parameters: action.parameters ?? {},
      repeatParameters: action.repeatParameters ?? {},
    });
  }
}

function templatesFor(inputs: DeepAuditDerivedInputs): StepTemplate[] {
  const templates: StepTemplate[] = [];
  const primary = inputs.primaryProduct;
  const secondary = inputs.secondaryProduct;
  const section = inputs.section;
  const missingCore = inputs.datasetDate ? null : 'No active core payload is loaded';
  const missingPrimary = primary ? null : 'No exact product row is available';
  const missingPair = primary && secondary
    ? null
    : 'Fewer than two distinct exact products are available in one section';
  const missingProvider = inputs.provider ? null : 'No observed provider is available';
  const missingTaxonomy = inputs.taxonomyPath.length
    ? null
    : 'The selected exact product has no valid hierarchy path';
  const productPath = primary
    ? `/product/${encodeURIComponent(primary.productKey)}`
    : '/product';
  const lenderPath = inputs.provider
    ? `/bank/${encodeURIComponent(inputs.provider)}`
    : '/bank';
  const exactProductParameters: Record<string, DeepAuditParameter> = primary
    ? {
        section: primary.section,
        provider: primary.provider,
        productKey: primary.productKey,
        rateIndex: primary.rateIndex,
        ...(primary.programmeId ? { programmeId: primary.programmeId } : {}),
      }
    : {};
  const compareParameters: Record<string, DeepAuditParameter> = {
    section: section ?? null,
    selectionTokens: inputs.compareSelectionTokens,
    primaryRateIndex: primary?.rateIndex ?? null,
    secondaryRateIndex: secondary?.rateIndex ?? null,
  };
  const optionalFeatureSkip = {
    skipWhen: ['The feature is disabled', 'Its trusted asset is absent', 'The mounted surface reports a terminal error'],
    skipExplanation: 'Optional surfaces are skipped explicitly instead of changing access, preferences or inventing data.',
  };

  scenario(templates, 'route.rates', {
    expectedPath: '/browse',
    expectedSurface: 'rates.results',
    readiness: ['app', 'data', 'details', 'search-index', 'suitability', 'list'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable'],
    skipExplanation: 'Search uses an observed product/provider query and exact rows only.',
    unsafeActionsExcluded: ['notifications.enable'],
  }, [
    { depth: 0, semanticActionId: 'search.open', parameters: { section: section ?? null } },
    {
      depth: 1,
      semanticActionId: 'search.query.product',
      parameters: { query: inputs.searchQuery },
      optional: true,
      skipReason: missingPrimary,
    },
    { depth: 1, semanticActionId: 'search.query.clear', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'search.sort.next', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'search.filters.open', stateImpact: 'local-only' },
    {
      depth: 2,
      semanticActionId: 'search.filter.provider.first',
      parameters: { provider: inputs.provider },
      stateImpact: 'local-only',
      optional: true,
      skipReason: missingProvider,
    },
    { depth: 2, semanticActionId: 'search.filters.apply', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'search.filters.clear', stateImpact: 'local-only' },
    {
      depth: 2,
      semanticActionId: 'search.compare.mode',
      stateImpact: 'local-only',
      optional: true,
      skipReason: missingPair,
    },
    {
      depth: 2,
      semanticActionId: 'search.compare.page.0',
      parameters: primary ? { selectionToken: primary.selectionToken } : {},
      stateImpact: 'local-only',
      optional: true,
      skipReason: missingPair,
    },
    {
      depth: 2,
      semanticActionId: 'search.compare.select.0',
      parameters: primary ? { selectionToken: primary.selectionToken, rateIndex: primary.rateIndex } : {},
      stateImpact: 'local-only',
      optional: true,
      skipReason: missingPair,
    },
    {
      depth: 2,
      semanticActionId: 'search.compare.page.1',
      parameters: secondary ? { selectionToken: secondary.selectionToken } : {},
      stateImpact: 'local-only',
      optional: true,
      skipReason: missingPair,
    },
    {
      depth: 2,
      semanticActionId: 'search.compare.select.1',
      parameters: secondary ? { selectionToken: secondary.selectionToken, rateIndex: secondary.rateIndex } : {},
      stateImpact: 'local-only',
      optional: true,
      skipReason: missingPair,
    },
    {
      depth: 2,
      semanticActionId: 'search.compare.open',
      expectedPath: '/compare',
      expectedSurface: 'compare.table',
      parameters: compareParameters,
      readiness: ['details', 'logos'],
      optional: true,
      skipReason: missingPair,
    },
  ]);

  scenario(templates, 'route.rates-sheets', {
    expectedPath: '/browse', expectedSurface: 'rates.results',
    readiness: ['app', 'data', 'details', 'suitability', 'list'],
    skipReason: missingCore, skipWhen: ['Core data is unavailable'],
  }, [
    { depth: 0, semanticActionId: 'search.open', parameters: { section: section ?? null } },
    { depth: 1, semanticActionId: 'search.filters.open', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'search.filter.provider.first', parameters: { provider: inputs.provider }, stateImpact: 'local-only', optional: true, skipReason: missingProvider },
    { depth: 2, semanticActionId: 'search.filters.cancel', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'search.sort.open', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'search.sort.cancel', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'search.section.next', stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.market', {
    expectedPath: '/market', expectedSurface: 'market.overview',
    readiness: ['app', 'data', 'bank-insights', 'rba-calendar', 'list'],
    optional: true, ...optionalFeatureSkip,
  }, [
    { depth: 0, semanticActionId: 'market.open' },
    { depth: 1, semanticActionId: 'changes.section.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'changes.movers.toggle', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'market.outlook.open', expectedPath: '/research', expectedSurface: 'outlook.dashboard', readiness: ['data'], skipReason: missingCore, stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'market.history.open', expectedPath: '/bank-rates', expectedSurface: 'bank-rates.dashboard', readiness: ['graphics'], skipReason: missingCore, stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'market.rba.open', expectedPath: '/rba', expectedSurface: 'rba.dashboard', readiness: ['rba-calendar'], stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'market.response.open', expectedPath: '/rba-response', expectedSurface: 'moves.response-chart', readiness: ['rba-calendar', 'graphics'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.bank-rates', {
    expectedPath: '/bank-rates',
    expectedSurface: 'bank-rates.dashboard',
    readiness: ['app', 'data', 'graphics'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable'],
    skipExplanation: 'Bank rates require observed chart layout and a prepared rate model.',
  }, [
    { depth: 0, semanticActionId: 'bank-rates.open' },
    {
      depth: 1,
      semanticActionId: 'bank-rates.section.next',
      stateImpact: 'local-only',
      optional: true,
      skipWhen: ['Only one product type is enabled in interests'],
    },
  ]);

  scenario(templates, 'redirect.node', {
    expectedPath: '/browse',
    expectedSurface: 'rates.results',
    readiness: ['app', 'redirect', 'data', 'list'],
    optional: true,
    skipReason: missingTaxonomy,
    skipWhen: ['No valid taxonomy path is present'],
    skipExplanation: 'The legacy redirect is tested only with a path observed in the pinned payload.',
  }, [
    {
      depth: 1,
      semanticActionId: 'redirect.node.verify',
      parameters: { section: section ?? null, taxonomyPath: inputs.taxonomyPath },
    },
  ]);

  scenario(templates, 'route.compare', {
    expectedPath: '/compare',
    expectedSurface: 'compare.table',
    readiness: ['app', 'data', 'details', 'logos'],
    optional: true,
    skipReason: missingPair,
    skipWhen: ['Fewer than two exact products exist in one section'],
    skipExplanation: 'Mixed-section or substituted rows are never used to force comparison coverage.',
  }, [
    { depth: 0, semanticActionId: 'compare.open', parameters: compareParameters },
    { depth: 2, semanticActionId: 'compare.scroll.last-column', stateImpact: 'local-only' },
    {
      depth: 1,
      semanticActionId: 'compare.dismiss',
      expectedPath: '/browse',
      expectedSurface: 'rates.results',
      readiness: ['list'],
      parameters: { returnPath: '/browse' },
      stateImpact: 'local-only',
    },
  ]);

  scenario(templates, 'route.product', {
    expectedPath: productPath,
    expectedSurface: 'product.details',
    readiness: ['app', 'data', 'details', 'logos'],
    optional: true,
    skipReason: missingPrimary,
    skipWhen: ['The exact product or exact rate tier no longer resolves'],
    skipExplanation: 'The plan preserves product_key and rate_index and never substitutes a sibling tier.',
    unsafeActionsExcluded: ['notifications.enable', 'share.open', 'external-link.open'],
  }, [
    { depth: 0, semanticActionId: 'product.open', parameters: exactProductParameters },
    { depth: 2, semanticActionId: 'product.history.window.30d', readiness: ['graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 3, semanticActionId: 'product.history.date.previous', readiness: ['graphics'], optional: true, ...optionalFeatureSkip },
    {
      depth: 1,
      semanticActionId: 'product.receipt.open',
      expectedPath: '/rate-receipt',
      expectedSurface: 'receipt.evidence',
      readiness: ['details', 'scenario-storage'],
      parameters: exactProductParameters,
    },
  ]);

  scenario(templates, 'route.product-calculation', {
    expectedPath: '/calculator', expectedSurface: 'calculator.results',
    readiness: ['app', 'data', 'details', 'scenario-storage', 'suitability', 'list'],
    optional: true, skipReason: missingPrimary,
    skipWhen: ['The exact product or rate tier is unavailable', 'Encrypted scenario storage is unavailable'],
  }, [
    { depth: 0, semanticActionId: 'product.open', expectedPath: productPath, expectedSurface: 'product.details', readiness: ['logos'], parameters: exactProductParameters },
    { depth: 1, semanticActionId: 'product.calculate.open', parameters: exactProductParameters, stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.receipt', {
    expectedPath: '/rate-receipt',
    expectedSurface: 'receipt.evidence',
    readiness: ['app', 'data', 'details', 'scenario-storage'],
    optional: true,
    skipReason: missingPrimary,
    skipWhen: ['The exact product or tier is unavailable', 'Encrypted scenario storage reports a terminal error'],
    skipExplanation: 'The receipt reads the existing local scenario and never invents or edits financial inputs.',
    unsafeActionsExcluded: ['financial-input.edit', 'external-link.open', 'share.open'],
  }, [
    { depth: 0, semanticActionId: 'receipt.open', parameters: exactProductParameters },
    {
      depth: 1,
      semanticActionId: 'receipt.scroll.evidence',
      readiness: ['app', 'data', 'details', 'scenario-storage', 'list'],
      stateImpact: 'local-only',
    },
    {
      depth: 1,
      semanticActionId: 'receipt.back-to-product',
      expectedPath: productPath,
      expectedSurface: 'product.details',
      readiness: ['details', 'logos'],
      parameters: exactProductParameters,
      stateImpact: 'local-only',
    },
  ]);

  scenario(templates, 'route.lender', {
    expectedPath: lenderPath,
    expectedSurface: 'lender.details',
    readiness: ['app', 'data', 'suitability', 'logos', 'list'],
    optional: true,
    skipReason: missingProvider,
    skipWhen: ['The observed provider has no current rows', 'Optional bank intelligence is absent'],
    skipExplanation: 'Provider input comes from the same exact product used earlier in the chain.',
  }, [
    {
      depth: 0,
      semanticActionId: 'product.open',
      expectedPath: productPath,
      expectedSurface: 'product.details',
      readiness: ['details', 'logos'],
      parameters: exactProductParameters,
      optional: true,
      skipReason: missingPrimary,
    },
    { depth: 1, semanticActionId: 'product.lender.open', parameters: { provider: inputs.provider } },
    { depth: 1, semanticActionId: 'lender.chart.section.next', readiness: ['bank-insights', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'lender.history.window.next', readiness: ['bank-insights', 'bank-history', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 3, semanticActionId: 'lender.history.date.previous', readiness: ['bank-insights', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'lender.move.first', readiness: ['bank-insights', 'product-history'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'lender.product.first', expectedPath: productPath, expectedSurface: 'product.details', readiness: ['details', 'logos'], parameters: exactProductParameters, optional: true, skipReason: missingPrimary },
  ]);

  // Category-stratified spot checks are separate independent entries. A failed
  // product does not prevent the remaining sampled banks/products being tried.
  for (const [index, product] of inputs.sampledProducts.entries()) {
    scenario(templates, `sample.catalogue.${index}`, {
      expectedPath: `/product/${encodeURIComponent(product.productKey)}`,
      expectedSurface: 'product.details',
      readiness: ['app', 'data', 'details', 'logos', 'list'],
      unsafeActionsExcluded: ['external-link.open', 'share.open'],
    }, [
      {
        depth: 0, semanticActionId: 'product.open',
        parameters: { section: product.section, provider: product.provider,
          productKey: product.productKey, rateIndex: product.rateIndex,
          ...(product.programmeId ? { programmeId: product.programmeId } : {}) },
      },
      {
        depth: 1, semanticActionId: 'product.lender.open',
        expectedPath: `/bank/${encodeURIComponent(product.provider)}`,
        expectedSurface: 'lender.details', readiness: ['data', 'suitability', 'logos', 'list'],
        parameters: { provider: product.provider },
      },
    ]);
  }

  scenario(templates, 'route.calculator', {
    expectedPath: '/calculator',
    expectedSurface: 'calculator.results',
    readiness: ['app', 'data', 'details', 'scenario-storage', 'suitability', 'list'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable', 'Encrypted scenario storage reports a terminal error'],
    skipExplanation: 'Registered calculator callbacks apply restorable canned parameter sets; financial-input.edit remains excluded.',
    unsafeActionsExcluded: ['financial-input.edit'],
  }, [
    { depth: 0, semanticActionId: 'calculator.open' },
    {
      depth: 1,
      semanticActionId: 'calculator.section.mortgage',
      parameters: { section: 'Mortgage' },
      stateImpact: 'local-only',
    },
    {
      depth: 1,
      semanticActionId: 'calculator.scenario.apply-buy',
      parameters: {
        mode: 'buy',
        propertyValue: '750000',
        deposit: '150000',
        costs: '25000',
        currentRate: '7.25',
        years: '30',
      },
      stateImpact: 'restorable',
    },
    { depth: 1, semanticActionId: 'calculator.mode.next', parameters: { mode: 'refi' }, stateImpact: 'restorable' },
    {
      depth: 1,
      semanticActionId: 'calculator.scenario.apply-refi',
      parameters: {
        mode: 'refi',
        propertyValue: '900000',
        loanBalance: '650000',
        currentRate: '6.95',
        years: '25',
      },
      stateImpact: 'restorable',
    },
    {
      depth: 1,
      semanticActionId: 'calculator.section.savings',
      parameters: { section: 'Savings' },
      stateImpact: 'local-only',
    },
    {
      depth: 1,
      semanticActionId: 'calculator.scenario.apply-deposit',
      parameters: {
        balance: '50000',
        currentRate: '2.50',
      },
      repeatParameters: {
        balance: '51000',
        currentRate: '2.60',
      },
      stateImpact: 'restorable',
    },
    {
      depth: 1,
      semanticActionId: 'calculator.section.return-mortgage',
      parameters: { section: 'Mortgage' },
      stateImpact: 'local-only',
    },
    { depth: 2, semanticActionId: 'calculator.candidate.first', expectedPath: productPath, expectedSurface: 'product.details', parameters: exactProductParameters, optional: true, skipReason: missingPrimary },
    { depth: 1, semanticActionId: 'calculator.candidate.back', expectedPath: '/calculator', expectedSurface: 'calculator.results', stateImpact: 'local-only', optional: true, skipReason: missingPrimary },
    { depth: 1, semanticActionId: 'calculator.projections.open', expectedPath: '/calculator', expectedSurface: 'projections.inputs', readiness: ['scenario-storage'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.projections', {
    expectedPath: '/calculator',
    expectedSurface: 'projections.lifecycle-chart',
    readiness: ['app', 'data', 'scenario-storage', 'graphics'],
    optional: true,
    skipWhen: ['The existing user scenario is incomplete', 'Encrypted scenario storage reports a terminal error'],
    skipExplanation: 'Registered projection field/selection callbacks apply restorable canned parameter sets before chart interactions; financial-input.edit remains excluded.',
    unsafeActionsExcluded: ['financial-input.edit'],
  }, [
    { depth: 0, semanticActionId: 'projections.open', expectedSurface: 'projections.inputs', readiness: ['scenario-storage'], parameters: { section: 'Mortgage' } },
    {
      depth: 1,
      semanticActionId: 'projections.inputs.apply-primary',
      expectedSurface: 'projections.inputs',
      readiness: ['scenario-storage'],
      parameters: {
        mode: 'refi',
        propertyValue: '850000',
        loanBalance: '600000',
        currentRate: '6.40',
        years: '28',
        lowerRate: '5.40',
        higherRate: '7.40',
        offsetBalance: '25000',
        mortgageRateStructure: 'variable',
      },
      stateImpact: 'restorable',
    },
    { depth: 1, semanticActionId: 'projections.rate-structure.next', expectedSurface: 'projections.inputs', readiness: ['scenario-storage'], stateImpact: 'restorable' },
    {
      depth: 1,
      semanticActionId: 'projections.inputs.apply-alternate',
      expectedSurface: 'projections.inputs',
      readiness: ['scenario-storage'],
      parameters: {
        mode: 'refi',
        propertyValue: '850000',
        loanBalance: '580000',
        currentRate: '5.95',
        years: '26',
        lowerRate: '4.95',
        higherRate: '6.95',
        offsetBalance: '40000',
        extraRepaymentAmount: '200',
        mortgageRateStructure: 'fixed',
        fixedPeriodMonths: '24',
      },
      stateImpact: 'restorable',
    },
    { depth: 1, semanticActionId: 'projections.advanced.toggle', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'projections.dimension.next', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'projections.metric.next', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 3, semanticActionId: 'projections.chart.next', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 3, semanticActionId: 'projections.chart.previous', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'projections.section.next', readiness: ['graphics'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.moves', {
    expectedPath: '/rba-response',
    expectedSurface: 'moves.response-chart',
    readiness: ['app', 'data', 'bank-insights', 'rba-calendar', 'list'],
    optional: true,
    ...optionalFeatureSkip,
  }, [
    { depth: 0, semanticActionId: 'moves.open' },
    { depth: 1, semanticActionId: 'moves.decision.previous', readiness: ['rba-calendar'], stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'moves.section.next', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'moves.response-chart.provider.next', readiness: ['graphics'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.rba', {
    expectedPath: '/rba',
    expectedSurface: 'rba.dashboard',
    readiness: ['app', 'data', 'rba-calendar'],
    optional: true,
    ...optionalFeatureSkip,
  }, [
    { depth: 0, semanticActionId: 'rba.open' },
    { depth: 1, semanticActionId: 'rba.forecast.next', readiness: ['economic-data', 'graphics'], stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'rba.bonds.next', readiness: ['economic-data', 'graphics'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.outlook', {
    expectedPath: '/research',
    expectedSurface: 'outlook.dashboard',
    readiness: ['app', 'data'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable'],
    skipExplanation: 'Optional chart families skip at their own terminal readiness boundary.',
    unsafeActionsExcluded: ['external-link.open'],
  }, [
    { depth: 0, semanticActionId: 'outlook.open' },
    { depth: 1, semanticActionId: 'outlook.section.next', stateImpact: 'restorable' },
    { depth: 2, semanticActionId: 'outlook.history.mode.spread', readiness: ['bank-history', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.history.mode.calendar', readiness: ['bank-history', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.history.mode.pulse', readiness: ['bank-insights', 'product-history', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.history.mode.leaders', readiness: ['bank-insights', 'graphics', 'logos'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.history.window.30d', readiness: ['graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.history.window.all', readiness: ['graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 3, semanticActionId: 'outlook.history.date.previous', readiness: ['graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.rba-response.decision.previous', expectedSurface: 'outlook.rba-response', readiness: ['rba-calendar', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.economy.lens.next', expectedSurface: 'outlook.economy', readiness: ['economic-data', 'graphics'], stateImpact: 'local-only', optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.economy.window.next', expectedSurface: 'outlook.economy', readiness: ['economic-data', 'graphics'], stateImpact: 'local-only', optional: true, ...optionalFeatureSkip },
    { depth: 3, semanticActionId: 'outlook.economy.date.previous', expectedSurface: 'outlook.economy', readiness: ['economic-data', 'graphics'], stateImpact: 'local-only', optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.snapshot.browse.first', expectedPath: '/browse', expectedSurface: 'rates.results', readiness: ['list'], parameters: { section: section ?? null }, optional: true, skipReason: missingCore },
  ]);

  scenario(templates, 'route.saved', {
    expectedPath: '/watchlist',
    expectedSurface: 'saved.list',
    readiness: ['app', 'data', 'list', 'logos'],
    optional: true,
    skipReason: missingPair,
    skipWhen: ['Fewer than two exact products exist in one section'],
    skipExplanation: 'Temporary exact saves are rollback-protected and never substitute missing variants.',
  }, [
    { depth: 0, semanticActionId: 'saved.open' },
    { depth: 1, semanticActionId: 'saved.fixture.ensure-exact-pair', parameters: compareParameters, stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'saved.product.open', expectedPath: productPath, expectedSurface: 'product.details',
      readiness: ['details', 'logos'], stateImpact: 'local-only',
      parameters: primary ? { savedId: savedRateId(primary.productKey, primary.rateIndex, primary.offerId || primary.rateIndex != null ? 'rate' : 'product', primary.offerId) } : {} },
    { depth: 2, semanticActionId: 'product.calculate.open', expectedPath: '/calculator', expectedSurface: 'calculator.results',
      readiness: ['details', 'scenario-storage', 'suitability', 'list'], stateImpact: 'local-only',
      parameters: exactProductParameters },
    { depth: 1, semanticActionId: 'saved.compare.mode', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'saved.compare.select.0', parameters: primary ? { selectionToken: primary.selectionToken, rateIndex: primary.rateIndex } : {}, stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'saved.compare.select.1', parameters: secondary ? { selectionToken: secondary.selectionToken, rateIndex: secondary.rateIndex } : {}, stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'saved.compare.open', expectedPath: '/compare', expectedSurface: 'compare.table', readiness: ['details', 'logos'], parameters: compareParameters },
    { depth: 1, semanticActionId: 'saved.compare.dismiss', expectedPath: '/watchlist', expectedSurface: 'saved.list', readiness: ['list', 'logos'], parameters: { returnPath: '/watchlist' }, stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'saved.fixture.restore', stateImpact: 'restorable' },
  ]);

  scenario(templates, 'route.profile', {
    expectedPath: '/profile',
    expectedSurface: 'profile.filters',
    readiness: ['app', 'preferences', 'local-state'],
    skipWhen: ['No applicable profile option is rendered'],
    skipExplanation: 'The complete profile snapshot is restored immediately after the round trip.',
  }, [
    { depth: 0, semanticActionId: 'profile.open' },
    { depth: 1, semanticActionId: 'profile.filter.first.toggle', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'profile.filter.restore', stateImpact: 'restorable' },
  ]);

  scenario(templates, 'route.settings', {
    expectedPath: '/settings',
    expectedSurface: 'settings.sections',
    readiness: ['app', 'preferences', 'update-status', 'local-state'],
    skipWhen: ['An optional disclosure or segmented alternative is not rendered'],
    skipExplanation: 'Only disclosures and rollback-protected appearance/ranking controls are exercised.',
    unsafeActionsExcluded: [
      'notifications.enable',
      'app-lock.toggle',
      'data.refresh',
      'data.cache.clear',
      'app-update.download',
      'app-update.install',
      'diagnostics-consent.toggle',
    ],
  }, [
    { depth: 0, semanticActionId: 'settings.open' },
    { depth: 1, semanticActionId: 'settings.home-sections.toggle', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'settings.data-details.toggle', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'settings.diagnostics.toggle', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'settings.theme.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.theme.restore', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.rank.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.rank.restore', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.non-standard.toggle', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.mortgage-rank.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.interests.reorder', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.default-section.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.deep-search.toggle', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.history-explorer.toggle', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.wifi-only.toggle', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.apk-wifi-only.toggle', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.alert-threshold.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.preferences.restore', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'settings.notifications.observe' },
    { depth: 1, semanticActionId: 'settings.privacy.observe' },
    { depth: 1, semanticActionId: 'settings.app-lock.observe' },
    { depth: 1, semanticActionId: 'settings.feature.deep-search.observe', readiness: ['search-index'], optional: true, ...optionalFeatureSkip },
    { depth: 1, semanticActionId: 'settings.feature.history-explorer.observe', readiness: ['bank-history', 'bank-insights'], optional: true, ...optionalFeatureSkip },
    { depth: 1, semanticActionId: 'settings.update-status.observe', readiness: ['update-status'], optional: true, ...optionalFeatureSkip },
  ]);

  scenario(templates, 'route.terms', {
    expectedPath: '/terms',
    expectedSurface: 'terms.notices',
    readiness: ['app', 'local-state'],
  }, [
    { depth: 0, semanticActionId: 'terms.open' },
    { depth: 1, semanticActionId: 'terms.scroll.end', stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.debug-log', {
    expectedPath: '/debug-log',
    expectedSurface: 'debug-log.entries',
    readiness: ['app', 'log-buffer', 'list'],
    unsafeActionsExcluded: [
      'clipboard.write',
      'share.open',
      'debug-log.clear',
      'debug-log.upload',
      'debug-log.delete-upload',
    ],
  }, [
    { depth: 0, semanticActionId: 'debug-log.open' },
    { depth: 1, semanticActionId: 'debug-log.scroll.end', stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.not-found', {
    expectedPath: '/__audit-not-found__',
    expectedSurface: 'not-found.recovery',
    readiness: ['app', 'local-state'],
  }, [
    { depth: 0, semanticActionId: 'not-found.open' },
    { depth: 1, semanticActionId: 'not-found.home', expectedPath: '/browse', expectedSurface: 'rates.results', readiness: ['local-state'], stateImpact: 'local-only' },
  ]);

  for (const legacy of ['search', 'categories', 'banks', 'matches', 'catalogue', 'onboarding']) {
    scenario(templates, `redirect.${legacy}`, {
      expectedPath: '/browse', expectedSurface: 'rates.results',
      readiness: ['app', 'redirect', 'data', 'details', 'suitability', 'list'],
      skipReason: missingCore, skipWhen: ['Core data is unavailable'],
    }, [{ depth: 1, semanticActionId: `redirect.${legacy}.verify`, parameters: { section: section ?? null } }]);
  }
  scenario(templates, 'redirect.tools', {
    expectedPath: '/calculator', expectedSurface: 'calculator.results',
    readiness: ['app', 'redirect', 'data', 'scenario-storage', 'suitability', 'list'],
    skipReason: missingCore, skipWhen: ['Core data is unavailable'],
  }, [{ depth: 1, semanticActionId: 'redirect.tools.verify' }]);
  scenario(templates, 'redirect.projections', {
    expectedPath: '/calculator', expectedSurface: 'projections.inputs',
    readiness: ['app', 'redirect', 'data', 'scenario-storage'],
    skipReason: missingCore, skipWhen: ['Core data is unavailable'],
  }, [{ depth: 1, semanticActionId: 'redirect.projections.verify', parameters: { section: 'Mortgage' } }]);
  scenario(templates, 'redirect.changes', {
    expectedPath: '/market', expectedSurface: 'market.overview',
    readiness: ['app', 'redirect', 'data', 'bank-insights', 'rba-calendar', 'list'],
    optional: true, ...optionalFeatureSkip,
  }, [{ depth: 1, semanticActionId: 'redirect.changes.verify' }]);

  scenario(templates, 'redirect.root', {
    expectedPath: '/browse',
    expectedSurface: 'rates.results',
    readiness: ['app', 'redirect', 'local-state'],
  }, [
    { depth: 1, semanticActionId: 'redirect.root.verify' },
  ]);

  scenario(templates, 'route.audit', {
    expectedPath: '/performance-audit',
    expectedSurface: 'audit.progress',
    readiness: ['app', 'audit-state', 'log-buffer'],
  }, [
    { depth: 0, semanticActionId: 'audit.pass.complete' },
  ]);

  return templates;
}

function materializeStep(template: StepTemplate, passId: DeepAuditPassId): DeepAuditStep {
  const stateImpact = template.stateImpact ?? 'none';
  const optional = template.optional ?? false;
  const skipReason = template.skipReason ?? null;
  const maySkip = optional || skipReason != null || (template.skipWhen?.length ?? 0) > 0;
  return {
    id: `${passId}.${template.scenarioId}.${template.semanticActionId}`,
    passId,
    scenarioId: template.scenarioId,
    depth: template.depth,
    semanticActionId: template.semanticActionId,
    expectedPath: template.expectedPath,
    expectedSurface: template.expectedSurface,
    readiness: [...template.readiness],
    optional,
    skipReason,
    skipSafety: {
      maySkip,
      when: [...(template.skipWhen ?? [])],
      reason: template.skipExplanation ?? (maySkip
        ? 'Skip only at a declared terminal availability boundary.'
        : 'This is required route coverage for a runnable audit.'),
    },
    mutatesRestorableState: stateImpact === 'restorable',
    safety: {
      stateImpact,
      unsafeActionsExcluded: [...(template.unsafeActionsExcluded ?? NO_UNSAFE_ACTIONS)],
    },
    parameters: {
      ...(template.parameters ?? {}),
      ...(passId === 'repeat' ? template.repeatParameters ?? {} : {}),
    },
  };
}

export function buildDeepPerformanceAuditPlan(
  core: CorePayload | null,
  options: DeepAuditSelectionOptions = {},
): DeepPerformanceAuditPlan {
  return buildDeepPerformanceAuditPlanFromInputs(deriveDeepAuditInputs(core, options));
}

/** Materialize both passes from the same pinned, seeded catalogue selection. */
export function buildDeepPerformanceAuditPlanFromInputs(inputs: DeepAuditDerivedInputs): DeepPerformanceAuditPlan {
  const templates = templatesFor(inputs);
  const passes = DEEP_AUDIT_PASS_IDS.map((passId): DeepAuditPass => ({
    id: passId,
    label: passId === 'first-pass' ? 'First whole-app pass' : 'Repeat whole-app pass',
    steps: templates.map((template) => materializeStep(template, passId)),
  }));
  return {
    schemaVersion: DEEP_AUDIT_PLAN_SCHEMA_VERSION,
    coverageProfile: MAXIMUM_PERFORMANCE_AUDIT_PROFILE_ID,
    safeActionCount: templates.length,
    inputs,
    excludedUnsafeActions: [...DEEP_AUDIT_EXCLUDED_ACTION_IDS],
    passes,
  };
}

/**
 * Tracks whether route recovery has invalidated the rest of a scenario.
 *
 * Recovery replaces the current screen with the audit route, which discards the
 * local state earlier steps established — an open filter sheet, a selected
 * provider, a chosen compare column. Every later step in that scenario would
 * then run on a freshly mounted screen, outside the state a user would be in,
 * so they are skipped until a step re-enters a route on its own.
 */
export class ScenarioReentryGate {
  private awaitingScenarioId: string | null = null;

  /** Record that recovery ran after this step. */
  markRecovered(step: DeepAuditStep): void {
    this.awaitingScenarioId = step.scenarioId;
  }

  /**
   * True when the step depends on a screen recovery unmounted. Call once per
   * step in plan order: a step that clears the gate also consumes it.
   *
   * `entersRouteDirectly` is the caller's answer to whether the step navigates
   * to its own route rather than acting on whatever is already mounted.
   */
  shouldSkip(step: DeepAuditStep, entersRouteDirectly: boolean): boolean {
    if (this.awaitingScenarioId == null) return false;
    if (step.scenarioId !== this.awaitingScenarioId || entersRouteDirectly) {
      this.awaitingScenarioId = null;
      return false;
    }
    return true;
  }
}
