import type { CorePayload, RateRow, SectionKey } from '../types';
import { calculatorAmount, computeLvr, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';
import type { ProfileFilters } from './profile';
import type { PublicProduct, PublicProgramme, PublicReferenceRate, RateResolution, RateScenario } from './publicRateModel';
import { resolvePublicRate } from './publicRateResolver';
import { estimateEnteredRate, estimateReferenceAdjustment, selectPublicReference } from './publicRateLocal';
import { Decimal, decimalText, rateDecimal } from './publicRateDecimal';
import type { UserRateScenario } from './userRateScenario';


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

/** Only the producer's semantic binding can attach a current programme to a row. */
export function resolveRowPublicRate(
  row: RateRow, catalogue: PublicCatalogueView, scenario: RateScenario = {}, asOf = new Date().toISOString(),
): RateResolution | undefined {
  if (catalogue.status === 'unavailable') return undefined;
  if (catalogue.status !== 'ready') return unresolvedPublicRate('catalogue_not_ready');
  const product = catalogue.getProduct(row.product_key);
  if (!product) return unresolvedPublicRate('product_pricing_not_available');
  const programmes = catalogue.getProgrammes(product.productId);
  if (!programmes.length) return unresolvedPublicRate('programme_not_loaded');
  const matching = programmes.filter(item => item.productId === product.productId && (
    row.public_programme_id && row.public_offer_id
      ? item.programmeId === row.public_programme_id && item.offerId === row.public_offer_id
      : item.sourceBindings?.some(binding => binding.rateIndex === row.rate_index)
  ));
  if (matching.length !== 1) return unresolvedPublicRate('semantic_offer_binding_missing');
  return resolvePublicRate(matching[0], scenario, asOf);
}

/** Occurrence pointers bind only the current validated generation; saved selections retain semantic ids. */
export function bindCurrentPublicRow(row: RateRow, catalogue: PublicCatalogueView): RateRow {
  if (catalogue.status !== 'ready') return row;
  const product = catalogue.getProduct(row.product_key);
  const candidates = product ? catalogue.getProgrammes(product.productId).filter(programme =>
    row.public_programme_id && row.public_offer_id
      ? programme.programmeId === row.public_programme_id && programme.offerId === row.public_offer_id
      : programme.sourceBindings?.some(binding => binding.rateIndex === row.rate_index)) : [];
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

function canonicalPurpose(value?: string): string | undefined {
  const key = value?.toUpperCase();
  return key === 'OO' || key === 'OWNER_OCCUPIED' ? 'OWNER_OCCUPIED'
    : key === 'INV' || key === 'INVESTMENT' ? 'INVESTMENT' : value;
}

function canonicalRepayment(value?: string): string | undefined {
  const key = value?.toUpperCase();
  return key === 'PI' || key === 'P&I' || key === 'PRINCIPAL_AND_INTEREST' ? 'PRINCIPAL_AND_INTEREST'
    : key === 'IO' || key === 'INTEREST_ONLY' ? 'INTEREST_ONLY' : value;
}

/** Newly resolved programmes enter app comparisons even when no legacy absolute row exists. */
export function publicCatalogueOfferRows(catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario): RateRow[] {
  if (catalogue.status !== 'ready') return [];
  const rows: RateRow[] = [];
  for (const product of catalogue.products) {
    if (product.section !== section || product.status === 'legacy') continue;
    for (const programme of catalogue.getProgrammes(product.productId)) {
      const resolution = resolvePublicRate(programme, scenario, new Date().toISOString());
      if (resolution.status !== 'exact' || !resolution.verifiedCurrent || resolution.payableRate == null) continue;
      const condition = (field: string) => programme.conditions.find(item => item.field === field && item.operator === 'eq')?.value;
      const lvr = programme.conditions.filter(item => item.field === 'lvr' && item.operator === 'bounds');
      const lower = lvr.map(item => item.minimum).filter((value): value is string => value != null).sort((a, b) => Decimal.parse(b).compare(Decimal.parse(a)))[0];
      const upper = lvr.map(item => item.maximum).filter((value): value is string => value != null).sort((a, b) => Decimal.parse(a).compare(Decimal.parse(b)))[0];
      const lowerInclusive = lvr.filter(item => item.minimum != null && lower != null && Decimal.parse(item.minimum).compare(Decimal.parse(lower)) === 0)
        .every(item => item.minimumInclusive !== false);
      const upperInclusive = lvr.filter(item => item.maximum != null && upper != null && Decimal.parse(item.maximum).compare(Decimal.parse(upper)) === 0)
        .every(item => item.maximumInclusive !== false);
      const percent = (value: string) => decimalText(Decimal.parse(value).mul(Decimal.parse('100')));
      const purpose = String(condition('purpose') ?? scenario.purpose ?? '');
      const repayment = String(condition('repayment') ?? scenario.repayment ?? '');
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
  }
  return rows;
}

/** One candidate set for every consumer. Source positions never form the deduplication key. */
export function publicRecommendationRows(rows: readonly RateRow[], catalogue: PublicCatalogueView, section: SectionKey, scenario: RateScenario, includeExistingLegacy = false): RateRow[] {
  if (catalogue.status === 'unavailable') return [...rows];
  const current = rows.filter(row => includeExistingLegacy || catalogue.getProduct(row.product_key)?.status !== 'legacy')
    .map(row => bindCurrentPublicRow(row, catalogue));
  const seen = new Set<string>();
  // Multiple source occurrences can legally bind to one semantic offer. Keep
  // provenance in the immutable source/catalogue; expose one selectable offer.
  return [...current, ...publicCatalogueOfferRows(catalogue, section, scenario)].filter(row => {
    if (!row.public_offer_id) return true;
    const key = JSON.stringify([row.product_key, row.public_offer_id]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** Ephemeral view for semantic selections; original core assets stay immutable. */
export function publicComparisonCore(core: CorePayload, catalogue: PublicCatalogueView, scenarioFor: (section: SectionKey) => RateScenario): CorePayload {
  if (catalogue.status === 'unavailable') return core;
  const sections = { ...core.sections };
  for (const section of ['Mortgage', 'Savings', 'TD'] as const) sections[section] = { ...core.sections[section],
    rates: publicRecommendationRows(core.sections[section].rates, catalogue, section, scenarioFor(section)) };
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
  return programme ? resolvePublicRate(programme, scenario, asOf) : unresolvedPublicRate('programme_not_loaded');
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
