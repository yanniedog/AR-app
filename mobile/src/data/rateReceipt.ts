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

export interface ReceiptFact {
  label: string;
  value: string;
}

export interface OfficialReceiptSource {
  kind: keyof ProductLinks;
  label: string;
  url: string;
  hostname: string;
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
  advertisedRate: string;
  advertisedRateFraction: number | null;
  ratePeriodMonths: number | null;
  ratePeriodLabel: string | null;
  comparisonRate: string | null;
  ongoingRate: string | null;
  cohort: 'standard' | 'non-standard';
  tier: ReceiptFact[];
  conditions: ReceiptFact[];
  fees: ReceiptFact[];
  officialSources: OfficialReceiptSource[];
  limitations: string[];
}

export interface NegotiationComparable {
  productKey: string;
  rateIndex: number | null;
  provider: string;
  productName: string;
  advertisedRate: string;
  comparisonRate: string | null;
  ongoingRate: string | null;
  condition: string | null;
}

export interface NegotiationIllustration {
  balance: number;
  currentRate: string;
  selectedRate: string;
  annualDifference: number;
  periodDifference: number;
  periodLabel: string;
  monthlyDifference: number | null;
  direction: 'lower-cost' | 'higher-return';
  assumption: string;
}

/** Generated in memory only; callers must not persist it in general preferences. */
export interface NegotiationBrief {
  version: 1;
  title: string;
  evidenceDate: string;
  scenario: ReceiptFact[];
  selectedProduct: ReceiptFact[];
  comparables: NegotiationComparable[];
  cohortSummary: string;
  typicalAdvertisedRate: string | null;
  illustration: NegotiationIllustration | null;
  prompts: string[];
  limitations: string[];
  officialSources: OfficialReceiptSource[];
  disclaimer: string;
}

const SOURCE_LABELS: Record<keyof ProductLinks, string> = {
  overview: 'Published product overview',
  eligibility: 'Published eligibility criteria',
  fees: 'Published fees and pricing',
  terms: 'Published terms and conditions',
  bundle: 'Published product bundle details',
};

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
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
    sources.push({ kind, label: SOURCE_LABELS[kind], url, hostname: new URL(url).hostname });
  }
  return sources;
}

function detailFacts(items: DetailItem[] | undefined): ReceiptFact[] {
  if (!items?.length) return [];
  return items.flatMap((item, index) => {
    const label = String(item.name ?? item.label ?? `Item ${index + 1}`).trim();
    const value = [item.value, item.info]
      .filter((part) => part !== null && part !== undefined && String(part).trim())
      .map(String)
      .join(' — ')
      .trim();
    return label && value ? [{ label: humanizeEnum(label) || label, value }] : [];
  });
}

function addFact(facts: ReceiptFact[], label: string, value: unknown): void {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (text) facts.push({ label, value: text });
}

export function buildRateReceipt(input: {
  row: RateRow;
  section: SectionKey;
  evidenceDate: string;
  detail?: ProductDetail | null;
}): RateReceipt {
  const { row, section, evidenceDate, detail } = input;
  const qualifier = rateQualifier(row, section);
  const tier: ReceiptFact[] = [];
  addFact(tier, 'Exact rate row', row.rate_index == null ? 'Product default row' : `Rate index ${row.rate_index}`);
  addFact(tier, 'Rate type', humanizeEnum(row.rate_type));
  if (section === 'Mortgage') {
    addFact(tier, 'Rate structure', humanizeEnum(row.ribbon_rate_structure));
    addFact(tier, 'Repayment', humanizeEnum(row.ribbon_repayment_type ?? row.repayment_type));
    addFact(tier, 'Loan purpose', humanizeEnum(row.loan_purpose ?? row.security_purpose));
    addFact(tier, 'LVR tier', humanizeEnum(row.lvr_tier));
  } else {
    addFact(tier, 'Deposit tier', humanizeEnum(row.ribbon_deposit_kind));
    addFact(tier, 'Balance range', formatBalanceRange(row.balance_min, row.balance_max));
    addFact(tier, 'Interest paid', humanizeEnum(row.interest_payment));
  }
  addFact(tier, 'Term', formatTerm(row));
  addFact(tier, 'Account type', humanizeEnum(row.account_type));
  addFact(tier, 'Account class', isNonStandard(row) ? 'Non-standard' : 'Standard');
  addFact(tier, 'Product ID', row.product_id);

  const conditions = detailFacts(detail?.eligibility);
  conditions.push(...detailFacts(detail?.constraints));
  if (qualifier.conditional) {
    conditions.unshift({ label: qualifier.label, value: qualifier.note });
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
  const ratePeriodLabel = ratePeriodMonths == null ? null : formatTerm(row) || `${ratePeriodMonths} months`;
  const limitations = [
    'This receipt records what the Australian Rates dataset observed; it is not a lender quote or approval.',
    'Eligibility, balances, fees, packages and other conditions can change the rate available to an individual.',
  ];
  if (!officialSources.length) {
    limitations.push('No valid HTTPS lender document link was published for this product in the current dataset.');
  }
  if (!detail?.eligibility?.length && !detail?.constraints?.length) {
    limitations.push('The dataset did not publish detailed eligibility or constraint text for this exact product.');
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
    fees: detailFacts(detail?.fees),
    officialSources,
    limitations,
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
    addFact(facts, 'Scenario', mortgage.mode === 'refi' ? 'Refinancing' : 'Buying');
    if (balance > 0) addFact(facts, 'Loan amount', balance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }));
    const propertyValue = num(mortgage.propertyValue);
    if (propertyValue > 0) addFact(facts, 'Property value', propertyValue.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }));
    if (lvr.lvr != null) addFact(facts, 'Illustrative LVR', `${lvr.lvr.toFixed(1)}%`);
    if (mortgage.currentRate.trim()) addFact(facts, 'Current rate entered', `${num(mortgage.currentRate).toFixed(2)}%`);
    if (mortgage.years.trim()) addFact(facts, 'Remaining term entered', `${num(mortgage.years)} years`);
    const current = num(mortgage.currentRate);
    return { facts, balance, currentRateFraction: current > 0 ? current / 100 : null };
  }

  const deposit = section === 'Savings' ? scenario.savings : scenario.termDeposit;
  const balance = num(deposit.balance);
  if (balance > 0) addFact(facts, 'Balance entered', balance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }));
  if (deposit.currentRate.trim()) addFact(facts, 'Current rate entered', `${num(deposit.currentRate).toFixed(2)}%`);
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
      condition: qualifier.conditional ? qualifier.note : null,
    });
    if (result.length === 3) break;
  }
  return result;
}

export function buildNegotiationBrief(input: {
  receipt: RateReceipt;
  scenario: UserRateScenario;
  sectionRows: RateRow[];
  detailsProducts?: Record<string, ProductDetail> | null;
}): NegotiationBrief {
  const { receipt, scenario, sectionRows, detailsProducts } = input;
  const scenarioData = scenarioForSection(scenario, receipt.section);
  const broadlyAvailableRows = visibleAccountRows(sectionRows, false, detailsProducts);
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
      const periodLabel = receipt.ratePeriodMonths == null
        ? 'per year'
        : receipt.section === 'TD'
          ? `at ${receipt.ratePeriodLabel ?? `${receipt.ratePeriodMonths} month`} maturity`
          : `over the published ${receipt.ratePeriodLabel ?? `${receipt.ratePeriodMonths} month`} period`;
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
        assumption: receipt.section === 'Mortgage'
          ? 'Simple interest-rate difference only; repayments, fees, loan structure and switching costs are excluded.'
          : receipt.section === 'TD'
            ? 'Simple-interest difference for the published deposit term; compounding and maturity instructions are excluded.'
            : 'Simple annual interest-rate difference only; bonus qualification, compounding, tax and balance changes are excluded.',
      };
    }
  }

  const selectedProduct: ReceiptFact[] = [
    { label: 'Product', value: `${receipt.provider} — ${receipt.productName}` },
    { label: 'Observed advertised rate', value: receipt.advertisedRate },
  ];
  if (receipt.comparisonRate) selectedProduct.push({ label: 'Comparison rate', value: receipt.comparisonRate });
  if (receipt.ongoingRate) selectedProduct.push({ label: 'Published ongoing rate', value: receipt.ongoingRate });
  selectedProduct.push({ label: 'Evidence date', value: receipt.evidenceDate });

  const limitations = [
    `Comparables are broadly available ${SECTIONS[receipt.section].title.toLowerCase()} rate tiers observed in the ${receipt.evidenceDate} dataset; they are not matched to your eligibility or circumstances.`,
    'Advertised rates can depend on LVR, balance, repayment type, term, bonus actions, packages and other conditions.',
    'Ask the lender to confirm the current rate, eligibility, fees and conditions in writing before making a decision.',
    ...receipt.limitations,
  ];

  return {
    version: 1,
    title: `Rate conversation brief — ${receipt.provider}`,
    evidenceDate: receipt.evidenceDate,
    scenario: scenarioData.facts,
    selectedProduct,
    comparables,
    cohortSummary: `${standardRates.length} comparable ${SECTIONS[receipt.section].title.toLowerCase()} rate tiers observed`,
    typicalAdvertisedRate: typical == null ? null : formatRate(typical),
    illustration,
    prompts: [
      'Can you review the rate currently applied to my account?',
      `Is this exact ${receipt.productName} tier available to me, and what conditions would I need to meet?`,
      'Are there fees, package requirements, introductory periods or ongoing-rate changes that affect the comparison?',
      'Can you provide the rate and all applicable conditions in writing?',
    ],
    limitations: [...new Set(limitations)],
    officialSources: receipt.officialSources,
    disclaimer: 'General information only — not personal financial advice or a recommendation to switch. This brief is generated locally from the scenario you entered and is not sent by Australian Rates.',
  };
}
