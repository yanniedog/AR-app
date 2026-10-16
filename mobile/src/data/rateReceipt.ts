import { StandardUrl } from '../lib/standardUrl';
import { SECTIONS } from '../constants';
import { rateQualifier } from '../lib/rateQualifier';
import type {
  DetailItem,
  ProductDetail,
  ProductLinks,
  RateRow,
  SectionKey,
} from '../types';
import { computeLvr, num } from './calc';
import {
  formatBalanceRange,
  formatRate,
  formatTerm,
  humanizeEnum,
  isoDurationMonths,
  isNonStandard,
  toFraction,
  visibleAccountRows,
} from './format';
import type { UserRateScenario } from './userRateScenario';
import { scopedRateConditions, type RateConditionContext, type ScopedRateConditions } from './rateConditions';
import { uiDetailItem } from '../lib/productUiFacts';
import { scopedFinancialConditionFacts } from './scopedFinancialConditionFacts';
import { uiConditionTag, uiConditionalRateFact, uiListedLvrRange } from '../lib/financialUiCopy';
import { uiCount, uiDate, uiDuration, uiIdentifier, uiJoin, uiLabel, uiMoney, uiNumber, uiProductName, uiProviderName, type UiCopy, type UiLabel, type UiText } from '../lib/uiCopy';
import type { ConditionalRateFact } from './rateConditionalFacts';

export interface ReceiptFact {
  label: UiCopy;
  value: UiText;
}

export function rateConditionReceiptLines(receipt: RateReceipt): UiText[] {
  const conditions = scopedFinancialConditionFacts(receipt.rateConditions);
  return [...conditions.facts.map(uiConditionTag),
    ...conditions.unresolved.map(fact => uiJoin('Source review required', ' · ', uiIdentifier(fact.source.sourcePointer))),
    ...(conditions.state === 'unverified' ? [uiLabel('Source unverified')] : []), uiLabel('Eligibility unverified')];
}

export interface OfficialReceiptSource {
  kind: keyof ProductLinks;
  label: UiLabel;
  url: string;
  hostname: UiText;
}

/** A point-in-time record of one exact CDR product-rate row. */
export interface RateReceipt {
  version: 1;
  productKey: string;
  rateIndex: number | null;
  provider: string;
  productName: string;
  section: SectionKey;
  evidenceDate: string;
  sourceUpdatedAt: string | null;
  advertisedRate: UiText;
  advertisedRateFraction: number | null;
  ratePeriodMonths: number | null;
  ratePeriodLabel: UiText | null;
  comparisonRate: UiText | null;
  ongoingRate: UiText | null;
  cohort: 'standard' | 'non-standard';
  tier: ReceiptFact[];
  conditions: ReceiptFact[];
  rateConditions: ScopedRateConditions;
  fees: ReceiptFact[];
  officialSources: OfficialReceiptSource[];
  facts: readonly ReceiptStatusFact[];
}

/** Public selected-rate facts only; private scenario inputs are excluded. */
export function rateReceiptShareText(receipt: RateReceipt): UiText {
  const values = [...receipt.tier, ...receipt.conditions, ...receipt.fees].filter(fact => fact.label !== 'Rate index')
    .map(fact => uiJoin(fact.label, ': ', fact.value));
  const sourceFacts = rateConditionReceiptLines(receipt);
  const links = receipt.officialSources.map(source => uiJoin(source.label, ': ', uiIdentifier(source.url)));
  return uiJoin(uiProviderName({ provider: receipt.provider }), ' · ', uiProductName({ product_name: receipt.productName }),
    ' · ', 'Rate index', ': ', uiCount(receipt.rateIndex), ' · ', 'Advertised', ': ', receipt.advertisedRate,
    receipt.comparisonRate ? uiJoin(' · ', 'Comparison', ': ', receipt.comparisonRate) : null,
    ' · ', 'Observed', ': ', uiDate(receipt.evidenceDate),
    ...values.flatMap(fact => [uiLabel(' · '), fact]),
    ...sourceFacts.flatMap(fact => [uiLabel(' · '), fact]),
    ...links.flatMap(fact => [uiLabel(' · '), fact]), ' · ', 'Fees unverified');
}

export interface NegotiationComparable {
  productKey: string;
  rateIndex: number | null;
  provider: string;
  productName: string;
  advertisedRate: UiText;
  comparisonRate: UiText | null;
  ongoingRate: UiText | null;
  conditionalFacts: readonly ConditionalRateFact[];
}

export interface NegotiationIllustration {
  balance: number;
  currentRate: UiText;
  selectedRate: UiText;
  annualDifference: number;
  periodDifference: number;
  periodLabel: UiText;
  monthlyDifference: number | null;
  direction: 'lower-cost' | 'higher-return';
  exclusions: readonly ('repayments' | 'fees' | 'loan-structure' | 'switching-costs' | 'compounding' | 'maturity-instructions' | 'bonus-eligibility' | 'tax' | 'balance-changes')[];
}

/** Generated in memory only; callers must not persist it in general preferences. */
export interface NegotiationBrief {
  version: 1;
  title: UiText;
  evidenceDate: string;
  scenario: ReceiptFact[];
  selectedProduct: ReceiptFact[];
  comparables: NegotiationComparable[];
  cohortSummary: UiText;
  typicalAdvertisedRate: UiText | null;
  illustration: NegotiationIllustration | null;
  topics: readonly ('current-rate' | 'selected-tier' | 'fees' | 'conditions')[];
  facts: readonly ReceiptStatusFact[];
  officialSources: OfficialReceiptSource[];
}

const SOURCE_LABELS: Record<keyof ProductLinks, UiLabel> = {
  overview: 'Product',
  eligibility: 'Eligibility',
  fees: 'Fees',
  terms: 'Terms',
  bundle: 'Package',
};

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new StandardUrl(value.trim());
    if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function officialReceiptSources(links?: ProductLinks): OfficialReceiptSource[] {
  if (!links) return [];
  const kinds: (keyof ProductLinks)[] = ['overview', 'eligibility', 'fees', 'terms', 'bundle'];
  const seen = new Set<string>();
  const sources: OfficialReceiptSource[] = [];
  for (const kind of kinds) {
    const url = safeHttpsUrl(links[kind]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ kind, label: SOURCE_LABELS[kind], url, hostname: uiIdentifier(new StandardUrl(url).hostname) });
  }
  return sources;
}

export type ReceiptStatusFact =
  | { readonly kind: 'eligibility'; readonly state: 'unverified' }
  | { readonly kind: 'quote'; readonly state: 'unavailable' }
  | { readonly kind: 'advice'; readonly state: 'excluded' }
  | { readonly kind: 'privacy'; readonly state: 'local-only' }
  | { readonly kind: 'costs'; readonly state: 'unverified' }
  | { readonly kind: 'comparables'; readonly state: 'unmatched' }
  | { readonly kind: 'source'; readonly state: 'unavailable' }
  | { readonly kind: 'detailed-eligibility'; readonly state: 'unavailable' };
function detailFacts(items: DetailItem[] | undefined, group: 'Fees' | 'Eligibility' | 'Features' | 'Constraints'): ReceiptFact[] {
  return (items ?? []).map((item, index) => {
    const fact = uiDetailItem(item, index, group);
    return { label: fact.label, value: uiJoin(fact.value, fact.conditions === 'source-review-required' ? uiJoin(' · ', 'Source review required') : null) };
  });
}
function addFact(facts: ReceiptFact[], label: UiCopy, value: UiText | null): void {
  if (value) facts.push({ label, value });
}

export function buildRateReceipt(input: {
  row: RateRow;
  section: SectionKey;
  evidenceDate: string;
  detail?: ProductDetail | null;
  rateConditionContext?: RateConditionContext;
}): RateReceipt {
  const { row, section, evidenceDate, detail } = input;
  const qualifier = rateQualifier(row, section);
  const tier: ReceiptFact[] = [];
  addFact(tier, 'Rate index', row.rate_index == null ? uiLabel('Unknown') : uiCount(row.rate_index));
  addFact(tier, 'Rate type', humanizeEnum(row.rate_type));
  if (section === 'Mortgage') {
    addFact(tier, 'Rate structure', humanizeEnum(row.ribbon_rate_structure));
    addFact(tier, 'Repayment', humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    addFact(tier, 'Loan purpose', humanizeEnum(row.loan_purpose ?? row.security_purpose));
    addFact(tier, 'Listed LVR', uiListedLvrRange(row));
  } else {
    addFact(tier, 'Tier', humanizeEnum(row.ribbon_deposit_kind));
    addFact(tier, 'Balance', formatBalanceRange(row.balance_min, row.balance_max));
    addFact(tier, 'Interest paid', humanizeEnum(row.interest_payment));
  }
  addFact(tier, 'Term', formatTerm(row));
  addFact(tier, 'Account type', humanizeEnum(row.account_type));
  addFact(tier, 'Account class', uiLabel(isNonStandard(row) ? 'Non-standard' : 'Standard'));
  addFact(tier, 'Product ID', uiIdentifier(row.product_id));

  const conditions = detailFacts(detail?.eligibility, 'Eligibility');
  const rateConditions = scopedRateConditions(row, section, input.rateConditionContext);
  conditions.push(...detailFacts(detail?.constraints, 'Constraints'));
  if (qualifier.conditional) {
    conditions.unshift(...qualifier.facts.map(fact => ({ label: 'Conditions' as const, value: uiConditionalRateFact(fact) })));
  }

  const officialSources = officialReceiptSources(detail?.links);
  const explicitTermMonths = Number(row.term_months);
  const publishedRateType = `${row.rate_type ?? ''} ${row.ribbon_rate_structure ?? ''}`.toUpperCase();
  const hasPublishedRatePeriod = section === 'TD' ||
    qualifier.kind === 'intro' ||
    (section === 'Savings' && /\b(?:INTRODUCTORY|INTRO)\b/.test(publishedRateType)) ||
    (section === 'Mortgage' && /\b(?:FIXED|INTRODUCTORY|INTRO)\b/.test(publishedRateType));
  const ratePeriodMonths = !hasPublishedRatePeriod
    ? null
    : Number.isFinite(explicitTermMonths) && explicitTermMonths > 0
      ? explicitTermMonths
      : isoDurationMonths(row.term);
  const ratePeriodLabel = ratePeriodMonths == null ? null : formatTerm(row) || uiDuration(ratePeriodMonths, 'months');
  const facts: ReceiptStatusFact[] = [{ kind: 'quote', state: 'unavailable' }, { kind: 'eligibility', state: 'unverified' }, { kind: 'costs', state: 'unverified' }];
  if (!officialSources.length) facts.push({ kind: 'source', state: 'unavailable' });
  if (!detail?.eligibility?.length && !detail?.constraints?.length) facts.push({ kind: 'detailed-eligibility', state: 'unavailable' });
  const conditionFacts = scopedFinancialConditionFacts(rateConditions);
  if (conditionFacts.state === 'admitted') {
    const kinds = new Set(conditionFacts.facts.map(fact => fact.kind));
    if (kinds.has('published-lvr-range')) for (let i = tier.length - 1; i >= 0; i--) if (tier[i].label === 'Listed LVR') tier.splice(i, 1);
    if (kinds.has('published-balance-range')) for (let i = tier.length - 1; i >= 0; i--) if (tier[i].label === 'Balance') tier.splice(i, 1);
    conditionFacts.facts.forEach(fact => tier.push({ label: 'Conditions', value: uiConditionTag(fact) }));
  }

  return {
    version: 1,
    productKey: row.product_key,
    rateIndex: row.rate_index ?? null,
    provider: row.provider,
    productName: row.product_name,
    section,
    evidenceDate,
    sourceUpdatedAt: row.last_updated ?? detail?.last_updated ?? null,
    advertisedRate: formatRate(row.rate),
    advertisedRateFraction: toFraction(row.rate),
    ratePeriodMonths,
    ratePeriodLabel,
    comparisonRate: row.comparison_rate ? formatRate(row.comparison_rate) : null,
    ongoingRate: qualifier.ongoingRate,
    cohort: isNonStandard(row) ? 'non-standard' : 'standard',
    tier,
    conditions,
    rateConditions,
    fees: detailFacts(detail?.fees, 'Fees'),
    officialSources,
    facts,
  };
}

function scenarioForSection(
  scenario: UserRateScenario,
  section: SectionKey,
): { facts: ReceiptFact[]; balance: number; currentRateFraction: number | null } {
  const facts: ReceiptFact[] = [];
  if (section === 'Mortgage') {
    const mortgage = scenario.mortgage;
    const hasEnteredValue = Object.entries(mortgage).some(
      ([field, value]) => field !== 'mode' && typeof value === 'string' && value.trim().length > 0,
    );
    if (!hasEnteredValue) return { facts, balance: 0, currentRateFraction: null };
    const lvr = computeLvr(mortgage);
    const balance = lvr.loan ?? num(mortgage.loanBalance);
    addFact(facts, 'Your rate scenario', uiLabel(mortgage.mode === 'refi' ? 'Refinancing' : 'Buying'));
    if (balance > 0) addFact(facts, 'Loan amount', uiMoney(balance));
    const propertyValue = num(mortgage.propertyValue);
    if (propertyValue > 0) addFact(facts, 'Property value ($)', uiMoney(propertyValue));
    if (lvr.lvr != null) addFact(facts, 'Scenario LVR', uiJoin(uiNumber(Number(lvr.lvr.toFixed(1)), 1), '%'));
    if (mortgage.currentRate.trim()) addFact(facts, 'Current entered rate', formatRate(num(mortgage.currentRate) / 100));
    if (mortgage.years.trim()) addFact(facts, 'Years remaining', uiDuration(num(mortgage.years), 'years'));
    const current = num(mortgage.currentRate);
    return { facts, balance, currentRateFraction: current > 0 ? current / 100 : null };
  }

  const deposit = section === 'Savings' ? scenario.savings : scenario.termDeposit;
  const balance = num(deposit.balance);
  if (balance > 0) addFact(facts, 'Current entered balance', uiMoney(balance));
  if (deposit.currentRate.trim()) addFact(facts, 'Current entered rate', formatRate(num(deposit.currentRate) / 100));
  const current = num(deposit.currentRate);
  return { facts, balance, currentRateFraction: current > 0 ? current / 100 : null };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildComparables(
  rows: RateRow[],
  section: SectionKey,
  selected: RateReceipt,
  detailsProducts?: Record<string, ProductDetail> | null,
): NegotiationComparable[] {
  const lowerIsBetter = SECTIONS[section].lowerIsBetter;
  const eligible = visibleAccountRows(rows, false, detailsProducts)
    .filter((row) => toFraction(row.rate) !== null)
    .sort((a, b) => {
      const av = toFraction(a.rate)!;
      const bv = toFraction(b.rate)!;
      return lowerIsBetter ? av - bv : bv - av;
    });
  const seen = new Set<string>();
  const result: NegotiationComparable[] = [];
  for (const row of eligible) {
    if (row.product_key === selected.productKey) continue;
    if (seen.has(row.product_key)) continue;
    seen.add(row.product_key);
    const qualifier = rateQualifier(row, section);
    result.push({
      productKey: row.product_key,
      rateIndex: row.rate_index ?? null,
      provider: row.provider,
      productName: row.product_name,
      advertisedRate: formatRate(row.rate),
      comparisonRate: row.comparison_rate ? formatRate(row.comparison_rate) : null,
      ongoingRate: qualifier.ongoingRate,
      conditionalFacts: qualifier.facts,
    });
    if (result.length === 3) break;
  }
  return result;
}

export function buildNegotiationBrief(input: {
  receipt: RateReceipt;
  scenario: UserRateScenario;
  sectionRows: RateRow[];
  comparisonsReady?: boolean;
  detailsProducts?: Record<string, ProductDetail> | null;
}): NegotiationBrief {
  const { receipt, scenario, sectionRows, detailsProducts } = input;
  const comparisonsReady = input.comparisonsReady !== false;
  const scenarioData = scenarioForSection(scenario, receipt.section);
  const broadlyAvailableRows = comparisonsReady ? visibleAccountRows(sectionRows, false, detailsProducts) : [];
  const standardRates = broadlyAvailableRows
    .map((row) => toFraction(row.rate))
    .filter((rate): rate is number => rate !== null);
  const typical = median(standardRates);
  const comparables = buildComparables(broadlyAvailableRows, receipt.section, receipt);
  const selectedRate = receipt.advertisedRateFraction;
  let illustration: NegotiationIllustration | null = null;
  if (
    scenarioData.balance > 0 &&
    scenarioData.currentRateFraction != null &&
    selectedRate != null &&
    (receipt.section !== 'TD' || receipt.ratePeriodMonths != null)
  ) {
    const direction = receipt.section === 'Mortgage' ? 'lower-cost' : 'higher-return';
    const delta = receipt.section === 'Mortgage'
      ? scenarioData.currentRateFraction - selectedRate
      : selectedRate - scenarioData.currentRateFraction;
    if (delta > 0) {
      const annualDifference = Math.round(scenarioData.balance * delta * 100) / 100;
      const periodDifference = receipt.ratePeriodMonths == null
        ? annualDifference
        : Math.round((annualDifference * receipt.ratePeriodMonths / 12) * 100) / 100;
      const periodLabel = receipt.ratePeriodMonths == null ? uiLabel('per year')
        : uiJoin(uiDuration(receipt.ratePeriodMonths, 'months'), ' · ', receipt.section === 'TD' ? 'at maturity' : 'Published period');

      illustration = {
        balance: scenarioData.balance,
        currentRate: formatRate(scenarioData.currentRateFraction),
        selectedRate: receipt.advertisedRate,
        annualDifference,
        periodDifference,
        periodLabel,
        monthlyDifference: receipt.section === 'TD' || receipt.ratePeriodMonths != null
          ? null
          : Math.round((annualDifference / 12) * 100) / 100,
        direction,
        exclusions: receipt.section === 'Mortgage' ? ['repayments', 'fees', 'loan-structure', 'switching-costs']
          : receipt.section === 'TD' ? ['compounding', 'maturity-instructions'] : ['bonus-eligibility', 'compounding', 'tax', 'balance-changes'],
      };
    }
  }

  const selectedProduct: ReceiptFact[] = [
    { label: 'Product', value: uiJoin(uiProviderName({ provider: receipt.provider }), ' — ', uiProductName({ product_name: receipt.productName })) },
    { label: 'Advertised rate', value: receipt.advertisedRate },
  ];
  if (receipt.comparisonRate) selectedProduct.push({ label: 'Comparison rate', value: receipt.comparisonRate });
  if (receipt.ongoingRate) selectedProduct.push({ label: 'Ongoing rate', value: receipt.ongoingRate });
  selectedProduct.push({ label: 'Observed', value: uiDate(receipt.evidenceDate) });

  const facts: ReceiptStatusFact[] = [{ kind: 'comparables', state: 'unmatched' }, { kind: 'eligibility', state: 'unverified' }, { kind: 'costs', state: 'unverified' }, { kind: 'privacy', state: 'local-only' }, { kind: 'advice', state: 'excluded' }, ...receipt.facts];

  return {
    version: 1,
    title: uiJoin('Bank-call brief', ' — ', uiProviderName({ provider: receipt.provider })),
    evidenceDate: receipt.evidenceDate,
    scenario: scenarioData.facts,
    selectedProduct,
    comparables,
    cohortSummary: uiJoin(uiCount(standardRates.length), ' ', 'rates', ' · ', 'Observed', ' ', uiDate(receipt.evidenceDate)),
    typicalAdvertisedRate: typical == null ? null : formatRate(typical),
    illustration,
    topics: ['current-rate', 'selected-tier', 'fees', 'conditions'],
    facts,
    officialSources: receipt.officialSources,
  };
}
