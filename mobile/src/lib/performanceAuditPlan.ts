import { ROOT } from '../data/taxonomy';
import { SECTION_KEYS, type CorePayload, type RateRow, type SectionKey } from '../types';
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
  'account.sign-in',
  'account.sign-out',
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
 * graphics/logos/list requirements so e.g. compare.dismiss → search.results
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

function compareRows(left: RateRow, right: RateRow, section: SectionKey): number {
  const depth = taxonomyPath(right, section).length - taxonomyPath(left, section).length;
  if (depth) return depth;
  const key = left.product_key.localeCompare(right.product_key);
  if (key) return key;
  const leftIndex = exactRateIndex(left) ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = exactRateIndex(right) ?? Number.MAX_SAFE_INTEGER;
  if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  return left.provider.localeCompare(right.provider);
}

function exactProduct(row: RateRow, section: SectionKey): DeepAuditExactProduct {
  const rateIndex = exactRateIndex(row);
  return {
    section,
    provider: row.provider,
    productKey: row.product_key,
    productName: row.product_name,
    rateIndex,
    selectionToken: selectionToken(row.product_key, rateIndex),
    taxonomyPath: taxonomyPath(row, section),
  };
}

/**
 * Select deterministic exact rows without inventing a tier, provider, rate or
 * financial scenario. Two comparison rows always come from the same section
 * and different product keys.
 */
export function deriveDeepAuditInputs(core: CorePayload | null): DeepAuditDerivedInputs {
  if (!core) {
    return {
      datasetDate: null,
      section: null,
      taxonomyPath: [],
      provider: null,
      searchQuery: null,
      primaryProduct: null,
      secondaryProduct: null,
      compareSelectionTokens: [],
    };
  }

  let chosenSection: SectionKey | null = null;
  let chosenRows: RateRow[] = [];
  let singleFallback: { section: SectionKey; rows: RateRow[] } | null = null;
  const providerSections = new Map<string, Set<SectionKey>>();
  for (const section of SECTION_KEYS) {
    for (const row of core.sections[section]?.rates ?? []) {
      if (!row.product_key.trim() || !row.provider.trim()) continue;
      const sections = providerSections.get(row.provider) ?? new Set<SectionKey>();
      sections.add(section);
      providerSections.set(row.provider, sections);
    }
  }

  for (const section of SECTION_KEYS) {
    const sorted = (core.sections[section]?.rates ?? [])
      .filter((row) => row.product_key.trim() && row.provider.trim())
      .slice()
      .sort((left, right) =>
        (providerSections.get(right.provider)?.size ?? 0) -
          (providerSections.get(left.provider)?.size ?? 0) ||
        compareRows(left, right, section),
      );
    const uniqueProducts: RateRow[] = [];
    const seen = new Set<string>();
    for (const row of sorted) {
      if (seen.has(row.product_key)) continue;
      seen.add(row.product_key);
      uniqueProducts.push(row);
    }
    if (!singleFallback && uniqueProducts.length) {
      singleFallback = { section, rows: uniqueProducts };
    }
    if (uniqueProducts.length >= 2) {
      chosenSection = section;
      chosenRows = uniqueProducts;
      break;
    }
  }

  if (!chosenSection && singleFallback) {
    chosenSection = singleFallback.section;
    chosenRows = singleFallback.rows;
  }

  const primaryProduct = chosenSection && chosenRows[0]
    ? exactProduct(chosenRows[0], chosenSection)
    : null;
  const secondaryProduct = chosenSection && chosenRows[1]
    ? exactProduct(chosenRows[1], chosenSection)
    : null;

  return {
    datasetDate: core.run_date,
    section: chosenSection,
    taxonomyPath: primaryProduct?.taxonomyPath ?? [],
    provider: primaryProduct?.provider ?? Object.keys(core.brands).sort()[0] ?? null,
    searchQuery: primaryProduct?.provider ?? primaryProduct?.productName ?? null,
    primaryProduct,
    secondaryProduct,
    compareSelectionTokens:
      primaryProduct && secondaryProduct
        ? [primaryProduct.selectionToken, secondaryProduct.selectionToken]
        : [],
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

  scenario(templates, 'route.onboarding', {
    expectedPath: '/onboarding',
    expectedSurface: 'onboarding.step',
    readiness: ['app', 'data', 'local-state', 'logos'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable'],
    skipExplanation: 'Preview only; the final onboarding commit and notification permission are never invoked.',
    unsafeActionsExcluded: ['onboarding.complete', 'notifications.enable'],
  }, [
    { depth: 0, semanticActionId: 'onboarding.open' },
    { depth: 1, semanticActionId: 'onboarding.section.toggle', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'onboarding.step.next', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'onboarding.notify.preview', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'onboarding.step.back', stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.today', {
    expectedPath: '/',
    expectedSurface: 'today.hero',
    readiness: ['app', 'data', 'suitability', 'details', 'graphics', 'logos'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable'],
    skipExplanation: 'Today requires a pinned core revision and an honest suitability result.',
  }, [
    { depth: 0, semanticActionId: 'today.open' },
    { depth: 1, semanticActionId: 'today.section.next', stateImpact: 'restorable' },
    {
      depth: 2,
      semanticActionId: 'today.best.open',
      // The best card depends on current suitability/profile/ranking settings,
      // not the plan's deterministic fixture product. Its mounted action
      // returns the exact runtime product path before navigation is awaited.
      expectedPath: '/product',
      expectedSurface: 'product.details',
      optional: true,
      skipReason: missingPrimary,
    },
  ]);

  scenario(templates, 'route.browse', {
    expectedPath: '/browse',
    expectedSurface: 'browse.hierarchy',
    readiness: ['app', 'data', 'suitability', 'list'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable'],
    skipExplanation: 'Hierarchy actions use only paths present on an exact source row.',
  }, [
    { depth: 0, semanticActionId: 'browse.open' },
    { depth: 1, semanticActionId: 'browse.section.next', stateImpact: 'restorable' },
    {
      depth: 2,
      semanticActionId: 'browse.category.first',
      parameters: { section: section ?? null, taxonomyPath: inputs.taxonomyPath },
      optional: true,
      skipReason: missingTaxonomy,
    },
    {
      depth: 3,
      semanticActionId: 'browse.category.deepest',
      parameters: { section: section ?? null, taxonomyPath: inputs.taxonomyPath },
      optional: true,
      skipReason: missingTaxonomy,
    },
    { depth: 2, semanticActionId: 'browse.category.back', optional: true, skipReason: missingTaxonomy },
    {
      depth: 2,
      semanticActionId: 'browse.products.all',
      expectedPath: '/search',
      expectedSurface: 'search.results',
      parameters: { section: section ?? null, taxonomyPath: inputs.taxonomyPath },
      optional: true,
      skipReason: missingTaxonomy,
      readiness: ['details', 'list'],
    },
  ]);

  scenario(templates, 'redirect.node', {
    expectedPath: '/browse',
    expectedSurface: 'browse.hierarchy',
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

  scenario(templates, 'route.search', {
    expectedPath: '/search',
    expectedSurface: 'search.results',
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
    {
      depth: 2,
      semanticActionId: 'search.compare.mode',
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
      readiness: ['details', 'logos', 'graphics'],
      optional: true,
      skipReason: missingPair,
    },
  ]);

  scenario(templates, 'route.compare', {
    expectedPath: '/compare',
    expectedSurface: 'compare.table',
    readiness: ['app', 'data', 'details', 'logos', 'graphics'],
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
      expectedPath: '/search',
      expectedSurface: 'search.results',
      readiness: ['list'],
      parameters: { returnPath: '/search' },
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
    { depth: 1, semanticActionId: 'receipt.scroll.evidence', stateImpact: 'local-only' },
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

  scenario(templates, 'route.lenders', {
    expectedPath: '/banks',
    expectedSurface: 'lenders.list',
    readiness: ['app', 'data', 'details', 'suitability', 'list', 'logos'],
    skipReason: missingCore,
    skipWhen: ['Core data is unavailable', 'Suitability preparation reports a terminal error'],
    skipExplanation: 'The directory query uses an observed provider.',
  }, [
    { depth: 0, semanticActionId: 'lenders.open' },
    { depth: 1, semanticActionId: 'lenders.section.next', stateImpact: 'restorable' },
    { depth: 1, semanticActionId: 'lenders.query.provider', parameters: { query: inputs.provider }, stateImpact: 'local-only', optional: true, skipReason: missingProvider },
    { depth: 1, semanticActionId: 'lenders.query.clear', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'lenders.provider.open', expectedPath: lenderPath, expectedSurface: 'lender.details', readiness: ['logos', 'list'], parameters: { provider: inputs.provider }, optional: true, skipReason: missingProvider },
  ]);

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
    { depth: 1, semanticActionId: 'calculator.projections.open', expectedPath: '/projections', expectedSurface: 'projections.inputs', readiness: ['scenario-storage'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'route.projections', {
    expectedPath: '/projections',
    expectedSurface: 'projections.lifecycle-chart',
    readiness: ['app', 'data', 'scenario-storage', 'graphics'],
    optional: true,
    skipWhen: ['The existing user scenario is incomplete', 'Encrypted scenario storage reports a terminal error'],
    skipExplanation: 'Registered projection field/selection callbacks apply restorable canned parameter sets before chart interactions; financial-input.edit remains excluded.',
    unsafeActionsExcluded: ['financial-input.edit'],
  }, [
    { depth: 0, semanticActionId: 'projections.open', parameters: { section: section ?? null } },
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
    readiness: ['app', 'data', 'bank-insights', 'rba-calendar', 'graphics', 'list'],
    optional: true,
    ...optionalFeatureSkip,
  }, [
    { depth: 0, semanticActionId: 'moves.open' },
    { depth: 1, semanticActionId: 'moves.decision.previous', readiness: ['rba-calendar'], stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'moves.section.next', stateImpact: 'restorable' },
    { depth: 2, semanticActionId: 'moves.response-chart.zoom-in', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'moves.response-chart.reset', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 3, semanticActionId: 'moves.response-chart.provider.first', readiness: ['graphics'], stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'moves.sort.timing', stateImpact: 'local-only' },
    { depth: 1, semanticActionId: 'moves.query.provider', parameters: { query: inputs.provider }, stateImpact: 'local-only', optional: true, skipReason: missingProvider },
    { depth: 2, semanticActionId: 'moves.filter.provider.clear', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'moves.lender.open', expectedPath: lenderPath, expectedSurface: 'lender.details', readiness: ['logos', 'list'], parameters: { provider: inputs.provider }, optional: true, skipReason: missingProvider },
  ]);

  scenario(templates, 'redirect.rba', {
    expectedPath: '/trends',
    expectedSurface: 'outlook.rba-response',
    readiness: ['app', 'redirect', 'data', 'rba-calendar', 'graphics'],
    optional: true,
    ...optionalFeatureSkip,
  }, [
    { depth: 1, semanticActionId: 'redirect.rba.verify' },
  ]);

  scenario(templates, 'route.outlook', {
    expectedPath: '/trends',
    expectedSurface: 'outlook.dashboard',
    readiness: ['app', 'data', 'graphics', 'rba-calendar', 'economic-data'],
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
    { depth: 2, semanticActionId: 'outlook.rba-response.decision.previous', readiness: ['rba-calendar', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.economy.lens.next', readiness: ['economic-data', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.economy.window.next', readiness: ['economic-data', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 3, semanticActionId: 'outlook.economy.date.previous', readiness: ['economic-data', 'graphics'], optional: true, ...optionalFeatureSkip },
    { depth: 2, semanticActionId: 'outlook.snapshot.browse.first', expectedPath: '/browse', expectedSurface: 'browse.hierarchy', readiness: ['list'], parameters: { section: section ?? null }, optional: true, skipReason: missingCore },
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
    { depth: 1, semanticActionId: 'saved.compare.mode', stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'saved.compare.select.0', parameters: primary ? { selectionToken: primary.selectionToken, rateIndex: primary.rateIndex } : {}, stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'saved.compare.select.1', parameters: secondary ? { selectionToken: secondary.selectionToken, rateIndex: secondary.rateIndex } : {}, stateImpact: 'local-only' },
    { depth: 2, semanticActionId: 'saved.compare.open', expectedPath: '/compare', expectedSurface: 'compare.table', readiness: ['details', 'logos', 'graphics'], parameters: compareParameters },
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
      'account.sign-in',
      'account.sign-out',
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
    { depth: 1, semanticActionId: 'not-found.home', expectedPath: '/', expectedSurface: 'today.hero', readiness: ['data', 'suitability', 'graphics'], stateImpact: 'local-only' },
  ]);

  scenario(templates, 'redirect.root', {
    expectedPath: '/',
    expectedSurface: 'today.hero',
    readiness: ['app', 'redirect', 'data', 'suitability', 'graphics'],
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
): DeepPerformanceAuditPlan {
  const inputs = deriveDeepAuditInputs(core);
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
