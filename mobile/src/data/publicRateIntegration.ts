import { scenarioForPublicProgramme } from './publicRateAlternatives';
import { canonicalPurpose, canonicalRepayment } from './mortgageFacets';
import type { CorePayload, RateRow, SectionKey } from '../types';
import { calculatorAmount, computeLvr, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import type { ProfileFilters } from './profile';
import type { PublicProduct, PublicProgramme, PublicReferenceRate, RateResolution, RateScenario } from './publicRateModel';
import { resolvePublicRate } from './publicRateResolver';
import { estimateEnteredRate, estimateReferenceAdjustment, selectPublicReference } from './publicRateLocal';
import { Decimal, decimalText, rateDecimal } from './publicRateDecimal';
import type { UserRateScenario } from './userRateScenario';
import { rowsForProductKey } from './rateRowIndex';
import { yieldToUi } from '../lib/yieldToUi';


// Preserve occurrence identity only through transformations authored here.
// The strict source-condition gate still requires that root object in current core.
const publicRowSources = new WeakMap<RateRow, RateRow>();
export function sourceRowForPublicRow(row: RateRow): RateRow {
  const source = publicRowSources.get(row);
  return source && source.product_key === row.product_key && source.rate_index === row.rate_index
    && source.provider === row.provider ? source : row;
}
function publicRowDerivedFrom(row: RateRow, derived: RateRow): RateRow {
  publicRowSources.set(derived, sourceRowForPublicRow(row));
  return derived;
}

/** Read-only view: the catalogue and private scenario never become source evidence. */
export interface PublicCatalogueView {
  generationId?: string | null;
  auditUnavailableReason?: 'cache-miss';
  status: 'unavailable' | 'loading' | 'ready' | 'error';
  products: readonly PublicProduct[];
  references: readonly PublicReferenceRate[];
  coverage?: readonly { providerId: string; providerName: string }[];
  getProduct(productKey: string): PublicProduct | undefined;
  getProgrammes(productId: string): PublicProgramme[];
  allLoaded: boolean;
}

export function unresolvedPublicRate(reason: string): RateResolution {
  return {
    status: 'unresolved', appliedComponents: [], phases: [], conditions: { met: [], unmet: [], unknown: [] },
    reasonCodes: [reason], evidenceIds: [], freshness: { state: 'unknown', reasonCodes: [reason] },
    verifiedCurrent: false, origin: 'published',
  };
}

// Catalogue publication replaces these arrays on hydration/correction. Reuse
// occurrence/offer lookup across all rows of the same immutable product book.
const programmeLookups = new WeakMap<PublicProgramme[], {
  offers: Map<string, Map<string, PublicProgramme[]>>;
  occurrences: Map<number, PublicProgramme[]>;
}>();
function matchingPublicProgrammes(row: RateRow, programmes: PublicProgramme[]): PublicProgramme[] {
  let lookup = programmeLookups.get(programmes);
  if (!lookup) {
    lookup = { offers: new Map(), occurrences: new Map() };
    for (const programme of programmes) {
      let offers = lookup.offers.get(programme.programmeId);
      if (!offers) { offers = new Map(); lookup.offers.set(programme.programmeId, offers); }
      const candidates = offers.get(programme.offerId) ?? [];
      candidates.push(programme); offers.set(programme.offerId, candidates);
      for (const index of new Set(programme.sourceBindings?.map(binding => binding.rateIndex) ?? [])) {
        const bound = lookup.occurrences.get(index) ?? [];
        bound.push(programme); lookup.occurrences.set(index, bound);
      }
    }
    programmeLookups.set(programmes, lookup);
  }
  return row.public_programme_id && row.public_offer_id
    ? lookup.offers.get(row.public_programme_id)?.get(row.public_offer_id) ?? []
    : row.rate_index == null ? [] : lookup.occurrences.get(row.rate_index) ?? [];
}

/** Exact immutable programme owner for an already bound source occurrence. */
export function boundPublicProgramme(row: RateRow, catalogue: PublicCatalogueView): PublicProgramme | undefined {
  const product = catalogue.getProduct(row.product_key);
  if (!product) return undefined;
  const matching = matchingPublicProgrammes(row, catalogue.getProgrammes(product.productId)).filter(item => item.productId === product.productId);
  return matching.length === 1 ? matching[0] : undefined;
}

/** Only the producer's semantic binding can attach a current programme to a row. */
export function resolveRowPublicRate(
  row: RateRow, catalogue: PublicCatalogueView, scenario: RateScenario = {}, asOf = new Date().toISOString(),
  resolve: typeof resolvePublicRate = resolvePublicRate,
): RateResolution | undefined {
  if (catalogue.status === 'unavailable') return undefined;
  if (catalogue.status !== 'ready') return unresolvedPublicRate('catalogue_not_ready');
  const product = catalogue.getProduct(row.product_key);
  if (!product) return unresolvedPublicRate('product_pricing_not_available');
  const programmes = catalogue.getProgrammes(product.productId);
  if (!programmes.length) return unresolvedPublicRate('programme_not_loaded');
  const matching = matchingPublicProgrammes(row, programmes).filter(item => item.productId === product.productId);
  if (matching.length !== 1) return unresolvedPublicRate('semantic_offer_binding_missing');
  const selected = scenarioForPublicProgramme(matching[0], scenario, asOf);
  return selected ? resolve(matching[0], selected, asOf) : unresolvedPublicRate('ambiguous_comparison_facets');
}

/** Occurrence pointers bind only the current validated generation; saved selections retain semantic ids. */
export function bindCurrentPublicRow(row: RateRow, catalogue: PublicCatalogueView): RateRow {
  if (catalogue.status !== 'ready') return row;
  const product = catalogue.getProduct(row.product_key);
  const candidates = product ? matchingPublicProgrammes(row, catalogue.getProgrammes(product.productId)) : [];
  return candidates.length === 1 ? programmePublicRow(row, candidates[0]) : row;
}

function programmePublicRow(row: RateRow, programme: PublicProgramme): RateRow {
  const metadata = programme.metadata;
  const base = programme.components.filter(component => component.source.rawType === 'BASE' && component.value != null);
  return publicRowDerivedFrom(row, { ...row, public_programme_id: programme.programmeId, public_offer_id: programme.offerId,
    ...(metadata?.rateStructure ? { ribbon_rate_structure: metadata.rateStructure } : {}),
    ...(programme.section === 'Savings' && metadata?.rateStructure === 'conditional' ? { ribbon_deposit_kind: 'bonus' } : {}),
    ...(programme.section === 'Savings' && metadata?.rateStructure === 'introductory' ? { ribbon_deposit_kind: 'introductory' } : {}),
    ...(metadata?.interestPayment ? { interest_payment: metadata.interestPayment.type === 'maturity' ? 'MATURITY' : metadata.interestPayment.frequency } : {}),
    ...(metadata?.quotedTerm?.unit === 'month' ? { term_months: metadata.quotedTerm.value, term: 'P' + metadata.quotedTerm.value + 'M' } : {}),
    ...(metadata?.quotedTerm?.unit === 'day' ? { term: 'P' + metadata.quotedTerm.value + 'D' } : {}),
    ...(base.length === 1 ? { ongoing_rate: decimalText(rateDecimal(base[0].value!, base[0].unit)) } : {}),
  });
}

function appendCatalogueOfferRow(
  rows: RateRow[],
  product: PublicProduct,
  programme: PublicProgramme,
  section: SectionKey,
  scenario: RateScenario,
  asOfForProgramme: (programme: PublicProgramme) => string,
  resolve: typeof resolvePublicRate = resolvePublicRate,
): void {
  const asOf = asOfForProgramme(programme);
  const selectedScenario = scenarioForPublicProgramme(programme, scenario, asOf);
  if (!selectedScenario) return;
  const resolution = resolve(programme, selectedScenario, asOf);
  if (resolution.status !== 'exact' || !resolution.verifiedCurrent || resolution.payableRate == null) return;
  const condition = (field: string) => programme.conditions.find(item => item.field === field && item.operator === 'eq')?.value;
  const lvr = programme.conditions.filter(item => item.field === 'lvr' && item.operator === 'bounds');
  const lower = lvr.map(item => item.minimum).filter((value): value is string => value != null).sort((a, b) => Decimal.parse(b).compare(Decimal.parse(a)))[0];
  const upper = lvr.map(item => item.maximum).filter((value): value is string => value != null).sort((a, b) => Decimal.parse(a).compare(Decimal.parse(b)))[0];
  const lowerInclusive = lvr.filter(item => item.minimum != null && lower != null && Decimal.parse(item.minimum).compare(Decimal.parse(lower)) === 0)
    .every(item => item.minimumInclusive !== false);
  const upperInclusive = lvr.filter(item => item.maximum != null && upper != null && Decimal.parse(item.maximum).compare(Decimal.parse(upper)) === 0)
    .every(item => item.maximumInclusive !== false);
  const percent = (value: string) => decimalText(Decimal.parse(value).mul(Decimal.parse('100')));
  const purpose = String(condition('purpose') ?? selectedScenario.purpose ?? '');
  const repayment = String(condition('repayment') ?? selectedScenario.repayment ?? '');
  const profilePurpose = typeof scenario.profileLoanPurpose === 'string' ? scenario.profileLoanPurpose : undefined;
  const profileRepayment = typeof scenario.profileRepayment === 'string' ? scenario.profileRepayment : undefined;
  rows.push(programmePublicRow({
    provider: product.providerName, product_key: product.productKey, product_name: product.name, rate: resolution.payableRate,
    category: section === 'Mortgage' ? 'RESIDENTIAL_MORTGAGES' : section === 'TD' ? 'TERM_DEPOSITS' : 'TRANS_AND_SAVINGS_ACCOUNTS',
    taxonomy_path: section === 'Mortgage' ? 'HOME_LOAN' : section === 'TD' ? 'TERM_DEPOSIT' : 'SAVINGS',
    loan_purpose: canonicalPurpose(profilePurpose) === purpose ? profilePurpose : purpose,
    repayment_type: repayment,
    ribbon_repayment_type: canonicalRepayment(profileRepayment) === repayment ? profileRepayment : repayment,
    rate_type: programme.metadata?.rateStructure === 'fixed' ? 'FIXED' : 'VARIABLE',
    ...(lower && upper ? { lvr_tier: 'lvr_' + (lowerInclusive ? '>=' : '>') + percent(lower) + '-' + (upperInclusive ? '' : '<') + percent(upper) + '%' }
      : lower ? { lvr_tier: 'lvr_' + (lowerInclusive ? '>=' : '>') + percent(lower) + '%' }
      : upper ? { lvr_tier: 'lvr_' + (upperInclusive ? '=' : '<') + percent(upper) + '%' } : {}),
    ...(resolution.comparisonRate ? { comparison_rate: resolution.comparisonRate } : {}),
    exact_alert_eligible: true,
  }, programme));
}

/** Stable offer identity without JSON.stringify on the hot catalogue path. */
export function publicOfferDedupKey(productKey: string, publicOfferId: string): string {
  return `${productKey}\0${publicOfferId}`;
}

/** Newly resolved programmes enter app comparisons even when no legacy absolute row exists. */
export function publicCatalogueOfferRows(catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario,
  asOfForProgramme: (programme: PublicProgramme) => string = () => new Date().toISOString(), representedOffers?: ReadonlySet<string>): RateRow[] {
  if (catalogue.status !== 'ready') return [];
  const rows: RateRow[] = [];
  for (const product of catalogue.products) {
    if (product.section !== section || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      if (!representedOffers?.has(publicOfferDedupKey(product.productKey, programme.offerId)))
        appendCatalogueOfferRow(rows, product, programme, section, scenario, asOfForProgramme);
    }
  }
  return rows;
}

/** Product-detail identity for one public product — never expands the whole section. */
export function publicProductOfferRows(
  product: PublicProduct,
  catalogue: PublicCatalogueView,
  scenario: RateScenario,
  asOfForProgramme: (programme: PublicProgramme) => string = () => new Date().toISOString(),
): RateRow[] {
  if (catalogue.status !== 'ready' || product.status === 'legacy') return [];
  const rows: RateRow[] = [];
  for (const programme of catalogue.getProgrammes(product.productId)) {
    appendCatalogueOfferRow(rows, product, programme, product.section, scenario, asOfForProgramme);
  }
  return dedupeRecommendationRows(rows);
}

/** Same catalogue expansion as {@link publicCatalogueOfferRows}, yielding between programmes. */
export async function publicCatalogueOfferRowsCooperatively(
  catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
  asOfForProgramme: (programme: PublicProgramme) => string = () => new Date().toISOString(),
  representedOffers?: ReadonlySet<string>,
  resolve: typeof resolvePublicRate = resolvePublicRate,
): Promise<RateRow[] | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const cancelled = control.cancelled ?? (() => false);
  await yieldControl();
  if (cancelled()) return null;
  if (catalogue.status !== 'ready') return [];
  const rows: RateRow[] = [];
  let sliceStarted = now();
  for (const product of catalogue.products) {
    if (product.section !== section || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      if (!representedOffers?.has(publicOfferDedupKey(product.productKey, programme.offerId)))
        appendCatalogueOfferRow(rows, product, programme, section, scenario, asOfForProgramme, resolve);
      // A single product can contain hundreds of programmes. Check the time
      // budget here so a large lender cannot monopolise the JS thread.
      if (now() - sliceStarted >= 6) {
        await yieldControl();
        sliceStarted = now();
        if (cancelled()) return null;
      }
    }
  }
  return cancelled() ? null : rows;
}

function dedupeRecommendationRows(rows: readonly RateRow[]): RateRow[] {
  const seen = new Set<string>();
  // Multiple source occurrences can legally bind to one semantic offer. Keep
  // provenance in the immutable source/catalogue; expose one selectable offer.
  return rows.filter(row => {
    if (!row.public_offer_id) return true;
    const key = publicOfferDedupKey(row.product_key, row.public_offer_id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One candidate set for every consumer. Source positions never form the deduplication key. */
export function publicRecommendationRows(rows: readonly RateRow[], catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario, includeExistingLegacy = false,
  asOfForProgramme?: (programme: PublicProgramme) => string): RateRow[] {
  if (catalogue.status === 'unavailable') return [...rows];
  const current = rows.filter(row => includeExistingLegacy || catalogue.getProduct(row.product_key)?.status !== 'legacy')
    .map(row => bindCurrentPublicRow(row, catalogue));
  return dedupeRecommendationRows([...current, ...publicCatalogueOfferRows(catalogue, section, scenario, asOfForProgramme, new Set(current.filter(row => row.public_offer_id).map(row => publicOfferDedupKey(row.product_key, row.public_offer_id!))))]);
}

/** Same candidates as full-section assembly filtered to one product, without
 * expanding unrelated programme books on Saved/receipt render paths. */
export function publicRecommendationRowsForProduct(
  rows: RateRow[], catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario,
  productKey: string, includeExistingLegacy = false,
  asOfForProgramme?: (programme: PublicProgramme) => string,
): RateRow[] {
  const selected = rowsForProductKey(rows, productKey);
  if (catalogue.status === 'unavailable') return [...selected];
  const product = catalogue.getProduct(productKey);
  return publicRecommendationRows(selected, { ...catalogue,
    products: product?.section === section ? [product] : [],
  }, section, scenario, includeExistingLegacy, asOfForProgramme);
}

/** Full-day recommendation assembly without a single-turn catalogue CPU burst. */
export async function publicRecommendationRowsCooperatively(
  rows: readonly RateRow[], catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
  includeExistingLegacy = false,
  asOfForProgramme?: (programme: PublicProgramme) => string,
  resolve: typeof resolvePublicRate = resolvePublicRate,
): Promise<RateRow[] | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const cancelled = control.cancelled ?? (() => false);
  await yieldControl();
  if (cancelled()) return null;
  if (catalogue.status === 'unavailable') return [...rows];
  const current: RateRow[] = [];
  let sliceStarted = now();
  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[offset];
    if (includeExistingLegacy || catalogue.getProduct(row.product_key)?.status !== 'legacy') {
      current.push(bindCurrentPublicRow(row, catalogue));
    }
    if (now() - sliceStarted >= 6) {
      await yieldControl();
      sliceStarted = now();
      if (cancelled()) return null;
    }
  }
  const offers = await publicCatalogueOfferRowsCooperatively(
    catalogue, section, scenario, control, asOfForProgramme ?? (() => new Date().toISOString()),
    new Set(current.filter(row => row.public_offer_id).map(row => publicOfferDedupKey(row.product_key, row.public_offer_id!))), resolve);
  if (cancelled() || !offers) return null;
  return dedupeRecommendationRows([...current, ...offers]);
}

const catalogueSources = new WeakMap<object, number>();
let nextCatalogueSource = 1;
function catalogueSource(value: object): number {
  let id = catalogueSources.get(value);
  if (id == null) { id = nextCatalogueSource++; catalogueSources.set(value, id); }
  return id;
}

/** Identity used by Rates pricing hooks so catalogue snapshot republishes do not cancel work. */
export function publicCataloguePricingKey(catalogue: PublicCatalogueView): string {
  let programmes = 0;
  for (const product of catalogue.products) {
    programmes += catalogue.getProgrammes(product.productId).length;
  }
  // Include programme cardinality so shard hydration restarts pricing while
  // status stays ready/allLoaded false — without depending on object identity.
  return `${catalogue.generationId ?? ''}:${catalogueSource(catalogue.getProduct)}.${catalogueSource(catalogue.getProgrammes)}:${catalogue.status}:${catalogue.allLoaded ? '1' : '0'}:${catalogue.products.length}:${programmes}`;
}

/** Ephemeral view for semantic selections; original core assets stay immutable. */
export function publicComparisonCore(core: CorePayload, catalogue: PublicCatalogueView, scenarioFor: (section: SectionKey) => RateScenario,
  asOfForProgramme?: (programme: PublicProgramme) => string): CorePayload {
  if (catalogue.status === 'unavailable') return core;
  const sections = { ...core.sections };
  for (const section of ['Mortgage', 'Savings', 'TD'] as const) sections[section] = { ...core.sections[section],
    rates: publicRecommendationRows(core.sections[section].rates, catalogue, section, scenarioFor(section), false, asOfForProgramme) };
  return { ...core, sections };
}

/** Product discovery requires an explicit choice whenever public pricing is ambiguous. */
export function resolveProductPublicRate(
  product: PublicProduct, catalogue: PublicCatalogueView, scenario: RateScenario = {}, programmeId?: string,
  asOf = new Date().toISOString(),
): RateResolution {
  if (catalogue.status !== 'ready') return unresolvedPublicRate('catalogue_not_ready');
  if (!programmeId && product.programmeIds.length !== 1) return unresolvedPublicRate(
    product.programmeIds.length ? 'pricing_programme_selection_required' : 'public_pricing_unavailable',
  );
  const selectedId = programmeId ?? product.programmeIds[0];
  const programme = catalogue.getProgrammes(product.productId).find(item => item.programmeId === selectedId
    && item.productId === product.productId);
  if (!programme) return unresolvedPublicRate('programme_not_loaded');
  const selected = scenarioForPublicProgramme(programme, scenario, asOf);
  return selected ? resolvePublicRate(programme, selected, asOf) : unresolvedPublicRate('ambiguous_comparison_facets');
}

export function publicRateScenario(
  section: SectionKey, scenario?: UserRateScenario, profile?: ProfileFilters, row?: RateRow,
  scope: 'comparison' | 'published' = 'comparison',
): RateScenario {
  const selected = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const input = scenario?.projections?.[selected];
  const result: RateScenario = { allowHistorical: scenario?.localRates?.[selected]?.allowHistorical === true };
  const single = (values?: string[]) => values?.length === 1 ? values[0] : undefined;
  const purpose = single(profile?.loanPurposes) ?? (scope === 'published' ? row?.loan_purpose ?? row?.security_purpose : undefined);
  const repayment = single(profile?.repaymentTypes) ?? (scope === 'published' ? row?.repayment_type ?? row?.ribbon_repayment_type : undefined);
  result.purpose = canonicalPurpose(purpose);
  result.repayment = canonicalRepayment(repayment);
  // Retain the saved profile's facet spelling for existing eligibility controls.
  // Public applicability uses the canonical CDR values above.
  result.profileLoanPurpose = single(profile?.loanPurposes);
  result.profileRepayment = single(profile?.repaymentTypes);
  const mortgage = scenario?.mortgage;
  if (section === 'Mortgage' && mortgage) {
    const loan = mortgage.mode === 'refi' ? calculatorAmount(mortgage.loanBalance ?? '', MAX_CALCULATOR_MORTGAGE_AMOUNT)
      : mortgage.mode === 'buy' && typeof mortgage.propertyValue === 'string' && typeof mortgage.deposit === 'string' && typeof mortgage.costs === 'string'
        ? computeLvr(mortgage).loan : null;
    if (loan != null) result.amount = String(loan);
    try {
      const money = (value: string) => {
        const amount = calculatorAmount(value, MAX_CALCULATOR_MORTGAGE_AMOUNT);
        if (amount == null) throw new Error('invalid_local_amount');
        return Decimal.parse(String(amount));
      };
      const property = money(mortgage.propertyValue ?? '');
      if (property.compare(Decimal.parse('0')) > 0) {
        if (mortgage.mode === 'refi') {
          const balance = money(mortgage.loanBalance ?? '');
          result.amount = decimalText(balance); result.lvr = decimalText(balance.div(property));
        } else if (mortgage.mode === 'buy' && typeof mortgage.deposit === 'string' && typeof mortgage.costs === 'string') {
          const deposit = money(mortgage.deposit.trim() || '0');
          const costs = money(mortgage.costs.trim() || '0');
          const applied = deposit.sub(costs).compare(Decimal.parse('0')) > 0 ? deposit.sub(costs) : Decimal.parse('0');
          const balance = property.sub(applied);
          result.amount = decimalText(balance); result.lvr = decimalText(balance.div(property));
        }
      }
    } catch { /* Missing numerical input remains unknown. */ }
  } else if (section !== 'Mortgage' && scenario) {
    const balance = section === 'TD' ? scenario.termDeposit?.balance : scenario.savings?.balance;
    if (balance?.trim()) result.balance = balance.replace(/[$,\s]/g, '');
  }
  if (section === 'Mortgage' && input?.mortgageRateStructure === 'fixed' && input.fixedPeriodMonths?.trim()) result.termMonths = input.fixedPeriodMonths;
  else if (input?.termMonths?.trim()) result.termMonths = input.termMonths;
  else if (row?.term_months != null) result.termMonths = String(row.term_months);
  if (row?.term && /^P\d+D$/.test(row.term)) result.termDays = row.term.slice(1, -1);
  if (input?.bonusQualification === 'met') result.qualification = true;
  if (input?.bonusQualification === 'unmet') result.qualification = false;
  for (const key of ['monthlyDeposit', 'withdrawals', 'balanceGrowth', 'cardTransactions'] as const) {
    if (input?.[key]?.trim()) result[key] = input[key].replace(/[$,\s]/g, '');
  }
  return result;
}

export function resolveLocalCurrentRate(
  section: SectionKey, scenario: UserRateScenario, references: readonly PublicReferenceRate[],
  asOf = new Date().toISOString(),
  catalogue?: PublicCatalogueView,
  profile?: ProfileFilters,
): RateResolution {
  const key = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const local = scenario?.localRates?.[key];
  if (local?.mode !== 'reference') {
    const value = section === 'Mortgage' ? scenario?.mortgage?.currentRate
      : section === 'TD' ? scenario?.termDeposit?.currentRate : scenario?.savings?.currentRate;
    return estimateEnteredRate(value ?? '');
  }
  const selected = selectPublicReference(references, local.referenceId ?? '', asOf);
  const reference = selected.reference;
  if (!reference) return { ...unresolvedPublicRate(selected.reasonCodes[0] ?? 'selected_reference_unavailable'), origin: 'locally_calculated' };
  const current = scenario?.currentProducts?.[key];
  const product = current?.productKey ? catalogue?.getProduct(current.productKey) : undefined;
  const providerName = current?.provider?.trim().toLocaleLowerCase('en-AU') ?? '';
  const providerIds = [...(catalogue?.products ?? []), ...(catalogue?.coverage ?? [])]
    .filter(item => item.providerName.trim().toLocaleLowerCase('en-AU') === providerName).map(item => item.providerId);
  if (product && !product.referenceIds.includes(local.referenceId)
    || !product && providerName && catalogue && !providerIds.includes(reference.providerId)) {
    return { ...unresolvedPublicRate('selected_reference_product_mismatch'), origin: 'locally_calculated' };
  }
  return estimateReferenceAdjustment(reference, local.totalAdjustment ?? '', asOf, local.allowHistorical === true,
    { ...publicRateScenario(section, scenario, profile), ...local.referenceScenario });
}

/** Calculation-only copy. Updating public data never writes over an entered rate. */
export function scenarioWithLocalCurrentRate(
  section: SectionKey, scenario: UserRateScenario, resolution: RateResolution,
): UserRateScenario {
  const key = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  if (resolution.status !== 'exact' && scenario?.localRates?.[key]?.mode !== 'reference') return scenario;
  const rate = resolution.status === 'exact' && resolution.payableRate != null
    ? decimalText(Decimal.parse(resolution.payableRate).mul(Decimal.parse('100'))) : '';
  if (section === 'Mortgage') return { ...scenario, mortgage: { ...scenario.mortgage, currentRate: rate } };
  const depositKey = section === 'TD' ? 'termDeposit' : 'savings';
  return { ...scenario, [depositKey]: { ...scenario[depositKey], currentRate: rate } };
}

/** Nominal payable interest only. A comparison rate is never financial input. */
export function payableRateForRow(row: RateRow, resolution?: RateResolution): number | null {
  if (resolution) {
    if (resolution.status !== 'exact' || !resolution.verifiedCurrent || resolution.payableRate == null) return null;
    const value = Number(resolution.payableRate);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  }
  const value = Number(row.rate);
  return row.rate.trim() && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

/** Keep all displayed/ranked rate fields on the same resolved programme. */
export function rowWithPublicResolution(row: RateRow, resolution?: RateResolution): RateRow {
  if (!resolution) return row;
  const payable = payableRateForRow(row, resolution);
  return publicRowDerivedFrom(row, { ...row, rate: payable == null ? '' : String(payable),
    comparison_rate: payable == null ? undefined : resolution.comparisonRate });
}

export function resolvedPublicRankingRows(
  rows: readonly RateRow[], catalogue: PublicCatalogueView,
  scenarioFor: (row: RateRow) => RateScenario = () => ({}),
): { rows: RateRow[]; priced: number; unresolved: number; complete: boolean } {
  if (catalogue.status === 'unavailable') return { rows: [...rows], priced: rows.length, unresolved: 0, complete: false };
  const resolved: RateRow[] = [];
  let unresolved = 0;
  for (const row of rows) {
    const result = resolveRowPublicRate(row, catalogue, scenarioFor(row));
    const payable = payableRateForRow(row, result);
    if (payable == null) { unresolved += 1; continue; }
    resolved.push(rowWithPublicResolution(bindCurrentPublicRow(row, catalogue), result));
  }
  return { rows: resolved, priced: resolved.length, unresolved, complete: catalogue.status === 'ready' && catalogue.allLoaded };
}

export type PublicRankingResolution = ReturnType<typeof resolvedPublicRankingRows>;

/** Same ranking contract without a full-catalogue render-time CPU burst. */
export async function resolvedPublicRankingRowsCooperatively(
  rows: readonly RateRow[], catalogue: PublicCatalogueView,
  scenarioFor: (row: RateRow) => RateScenario = () => ({}),
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
  resolve: typeof resolvePublicRate = resolvePublicRate,
): Promise<PublicRankingResolution | null> {
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  const cancelled = control.cancelled ?? (() => false);
  await yieldControl();
  if (cancelled()) return null;
  if (catalogue.status === 'unavailable') {
    return { rows: [...rows], priced: rows.length, unresolved: 0, complete: false };
  }
  const resolved: RateRow[] = [];
  let unresolved = 0;
  let sliceStarted = now();
  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[offset];
    const result = resolveRowPublicRate(row, catalogue, scenarioFor(row), undefined, resolve);
    const payable = payableRateForRow(row, result);
    if (payable == null) unresolved += 1;
    else resolved.push(rowWithPublicResolution(bindCurrentPublicRow(row, catalogue), result));
    if (now() - sliceStarted >= 6) {
      await yieldControl();
      sliceStarted = now();
      if (cancelled()) return null;
    }
  }
  return cancelled() ? null : {
    rows: resolved,
    priced: resolved.length,
    unresolved,
    complete: catalogue.status === 'ready' && catalogue.allLoaded,
  };
}

/** Retain the exact offer's local facet scope for evidence and cost calculations. */
export function publicScenarioForRow(row: RateRow | undefined, catalogue: PublicCatalogueView, scenario: RateScenario): RateScenario {
  if (!row || catalogue.status !== 'ready') return scenario;
  const product = catalogue.getProduct(row.product_key);
  const matching = product ? matchingPublicProgrammes(row, catalogue.getProgrammes(product.productId)) : [];
  return matching.length === 1
    ? scenarioForPublicProgramme(matching[0], scenario, new Date().toISOString()) ?? scenario : scenario;
}
