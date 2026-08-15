import type { DetailItem, ProductDetail, RateRow } from '../types';
import { advertisedTermMonths, computeLvr, num } from './calc';
import { percentageInputFraction } from './decisionInsights';
import { toFraction } from './format';
import { normalizedProductFacts } from './productFacts';
import type { ProjectionFrequency } from './projectionScenario';
import type { MortgageSwitchInputs, UserRateScenario } from './userRateScenario';

export type SwitchFeeKey =
  | 'currentBankExitFees'
  | 'applicationFees'
  | 'valuationFees'
  | 'settlementFees'
  | 'governmentAndLegalFees'
  | 'otherUpfrontFees';

export interface PublishedFeeEvidence {
  key: SwitchFeeKey;
  amount: number;
  name: string;
  source: 'current-product' | 'target-product';
}

export interface ResolvedSwitchFee {
  key: SwitchFeeKey;
  amount: number;
  source: 'entered' | 'published' | 'missing';
  evidence: PublishedFeeEvidence[];
}

export interface SwitchCostModel {
  fees: ResolvedSwitchFee[];
  publishedEvidence: PublishedFeeEvidence[];
  gaps: SwitchFeeKey[];
  grossFees: number;
  cashback: number;
  netSwitchCost: number;
  fundingMethod: MortgageSwitchInputs['fundingMethod'];
  financedAmount: number;
  currentPeriodicFeesMonthly: number;
  targetPeriodicFeesMonthly: number;
  pricedCurrentPeriodicFees: { name: string; amount: number; monthsPerCharge: number }[];
  pricedPeriodicFees: { name: string; amount: number; monthsPerCharge: number }[];
  unpricedUpfrontFees: string[];
  unpricedPeriodicFees: string[];
  /** True only when both product fee records and every applicable amount are known. */
  costClaimsAvailable: boolean;
  unknownFeeReasons: string[];
}

export interface StaySwitchPoint {
  date: string;
  stayBalance: number;
  switchBalance: number;
  stayOffset: number;
  switchOffset: number;
  stayNetDebt: number;
  switchNetDebt: number;
  cumulativeStayInterest: number;
  cumulativeStayCost: number | null;
  cumulativeSwitchInterest: number;
  cumulativeSwitchCost: number | null;
  cumulativeSaving: number | null;
}

export interface StaySwitchLeg {
  advertisedRate: number;
  requiredRepayment: number;
  principalPayment: number;
  offsetContribution: number;
  totalMonthlyAllocation: number;
  openingBalance: number;
  totalInterest: number;
  totalCost: number | null;
  effectiveDebtFreeDate: string | null;
  contractualPayoffDate: string | null;
  endBalance: number;
  endOffset: number;
}

export interface StaySwitchProjection {
  ready: boolean;
  missing: string[];
  asAt: string;
  projectionScope: 'remaining-term' | 'published-fixed-period';
  targetProductKey: string;
  targetProvider: string;
  targetProductName: string;
  /** The fixed monthly cash allocation inferred from the current arrangement. */
  householdAllocation: number;
  targetAllocationShortfall: number;
  targetHasOffset: boolean;
  offsetEvidence: 'entered' | 'published' | 'not-published' | 'unavailable';
  fees: SwitchCostModel;
  stay: StaySwitchLeg | null;
  switching: StaySwitchLeg | null;
  points: StaySwitchPoint[];
  breakEvenDate: string | null;
  totalInterestSaving: number;
  totalCostSaving: number | null;
  assumptions: string[];
  warnings: string[];
}

const FEE_KEYS: SwitchFeeKey[] = [
  'currentBankExitFees',
  'applicationFees',
  'valuationFees',
  'settlementFees',
  'governmentAndLegalFees',
  'otherUpfrontFees',
];
const MAX_MONTHS = 50 * 12;
const MAX_AMOUNT = 1_000_000_000_000;

function cleanAmount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_AMOUNT ? parsed : null;
}

function hasConditionalApplicability(item: DetailItem): boolean {
  const text = `${item.name ?? ''} ${item.info ?? ''}`;
  return /\b(?:if|when|where|for|unless|provided|eligible|subject to|depending on|up to)\b/i.test(text);
}

function hasUncertainFeeStructure(item: DetailItem): boolean {
  return item.variable != null
    || item.rateBased != null
    || (item.discounts?.length ?? 0) > 0
    || item.balanceRate != null
    || item.transactionRate != null
    || item.accruedRate != null
    || item.feeCap != null;
}

function publishedAmount(item: DetailItem): number | null {
  const amountStatus = item.amountStatus?.trim().toLowerCase();
  if ((amountStatus && amountStatus !== 'fixed')
    || hasUncertainFeeStructure(item)
    || /(?:variable|rate.?based)/i.test(item.feeMethodUType ?? '')) {
    return null;
  }
  const source = item.fixedAmount?.amount ?? item.amount ?? item.value ?? '';
  const raw = typeof source === 'number' ? String(source) : source;
  if (!/^\s*\$?\s*\d[\d,]*(?:\.\d+)?\s*$/.test(raw)) return null;
  const amount = Number(raw.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return null;
  const text = `${item.name ?? ''} ${item.info ?? ''}`;
  const feeFree = /\b(?:waived|no fee|fee[- ]free|nil)\b/i.test(text);
  if (hasConditionalApplicability(item)) return null;
  if (feeFree) return 0;
  return amount;
}

function periodicCadenceMonths(item: DetailItem): number | null {
  const text = `${item.name ?? ''} ${item.info ?? ''} ${item.value ?? ''} ${item.additionalValue ?? ''} ${item.accrualFrequency ?? ''}`;
  const iso = /\bP(\d+)([DWMY])\b/i.exec(text);
  if (iso) {
    const count = Number(iso[1]);
    if (iso[2].toUpperCase() === 'D') return count * 12 / 365;
    if (iso[2].toUpperCase() === 'W') return count * 12 / 52;
    if (iso[2].toUpperCase() === 'Y') return count * 12;
    return count;
  }
  if (/\b(?:per\s+week|weekly)\b/i.test(text)) return 12 / 52;
  if (/\b(?:per\s+fortnight|fortnightly)\b/i.test(text)) return 12 / 26;
  if (/\b(?:per\s+month|monthly)\b/i.test(text)) return 1;
  if (/\b(?:per\s+(?:annum|year)|annual(?:ly)?)\b/i.test(text)) return 12;
  return null;
}

function periodicFeeAmount(item: DetailItem): number | null {
  const amountStatus = item.amountStatus?.trim().toLowerCase();
  if (amountStatus && amountStatus !== 'fixed') return null;
  const fixed = publishedAmount(item);
  if (fixed != null) return fixed;
  if (hasConditionalApplicability(item) || hasUncertainFeeStructure(item)) return null;
  if (item.amountStatus?.trim().toLowerCase() === 'variable'
    || /(?:variable|rate.?based)/i.test(item.feeMethodUType ?? '')) {
    return null;
  }
  const text = `${item.info ?? ''} ${item.name ?? ''}`;
  const currency = /\$\s*(\d[\d,]*(?:\.\d+)?)/.exec(text);
  return currency ? Number(currency[1].replace(/,/g, '')) : null;
}

function feeKey(item: DetailItem, source: PublishedFeeEvidence['source']): SwitchFeeKey | null {
  const label = (item.label ?? '').trim().toUpperCase();
  const text = `${item.name ?? ''} ${item.info ?? ''}`.toLowerCase();
  if (source === 'current-product') {
    return label === 'EXIT' || /\b(?:break (?:cost|fee)|discharge|exit|release of mortgage)\b/.test(text)
      ? 'currentBankExitFees'
      : null;
  }
  if (label !== 'UPFRONT' && !/\b(?:application|establishment|valuation|settlement|registration|legal|solicitor|mortgage processing|government)\b/.test(text)) {
    return null;
  }
  if (/\b(?:application|establishment|origination)\b/.test(text)) return 'applicationFees';
  if (/\bvalu(?:ation|er)\b/.test(text)) return 'valuationFees';
  if (/\bsettle(?:ment|d)\b/.test(text)) return 'settlementFees';
  if (/\b(?:registration|legal|solicitor|mortgage processing|government|title search)\b/.test(text)) return 'governmentAndLegalFees';
  return 'otherUpfrontFees';
}

export function extractPublishedSwitchFees(
  currentDetail: ProductDetail | null | undefined,
  targetDetail: ProductDetail | null | undefined,
): PublishedFeeEvidence[] {
  const out: PublishedFeeEvidence[] = [];
  const add = (detail: ProductDetail | null | undefined, source: PublishedFeeEvidence['source']) => {
    for (const item of detail?.fees ?? []) {
      const key = feeKey(item, source);
      const amount = publishedAmount(item);
      if (!key || amount == null) continue;
      out.push({ key, amount, name: item.name?.trim() || item.label?.trim() || 'Published fee', source });
    }
  };
  add(currentDetail, 'current-product');
  add(targetDetail, 'target-product');
  return out;
}

export function resolveSwitchCosts(
  inputs: MortgageSwitchInputs,
  currentDetail?: ProductDetail | null,
  targetDetail?: ProductDetail | null,
): SwitchCostModel {
  const publishedEvidence = extractPublishedSwitchFees(currentDetail, targetDetail);
  const fees = FEE_KEYS.map((key): ResolvedSwitchFee => {
    const entered = cleanAmount(inputs[key]);
    const evidence = publishedEvidence.filter((item) => item.key === key);
    if (entered != null) return { key, amount: entered, source: 'entered', evidence };
    if (evidence.length) {
      return { key, amount: evidence.reduce((sum, item) => sum + item.amount, 0), source: 'published', evidence };
    }
    return { key, amount: 0, source: 'missing', evidence: [] };
  });
  const grossFees = fees.reduce((sum, item) => sum + item.amount, 0);
  const cashback = cleanAmount(inputs.cashback) ?? 0;
  const netSwitchCost = grossFees - cashback;
  const pricedCurrentPeriodicFees: { name: string; amount: number; monthsPerCharge: number }[] = [];
  const pricedPeriodicFees: { name: string; amount: number; monthsPerCharge: number }[] = [];
  const unpricedUpfrontFees: string[] = [];
  const unpricedPeriodicFees: string[] = [];
  const collectUnpricedOneTime = (
    detail: ProductDetail | null | undefined,
    source: PublishedFeeEvidence['source'],
    sourceLabel: string,
  ) => {
    for (const item of detail?.fees ?? []) {
      const key = feeKey(item, source);
      const text = `${item.label ?? ''} ${item.name ?? ''} ${item.info ?? ''}`;
      const potentiallyApplicable = key != null
        || (source === 'current-product'
          && /\b(?:break (?:cost|fee)|discharge|exit|release of mortgage)\b/i.test(text));
      if (!potentiallyApplicable || publishedAmount(item) != null) continue;
      if (key && cleanAmount(inputs[key]) != null) continue;
      unpricedUpfrontFees.push(`${sourceLabel}: ${item.name?.trim() || item.label?.trim() || 'one-time fee'}`);
    }
  };
  collectUnpricedOneTime(currentDetail, 'current-product', 'Current product');
  collectUnpricedOneTime(targetDetail, 'target-product', 'Target product');
  const collectPeriodic = (
    detail: ProductDetail | null | undefined,
    output: { name: string; amount: number; monthsPerCharge: number }[],
    sourceLabel: string,
  ) => {
    for (const item of detail?.fees ?? []) {
      if ((item.label ?? '').trim().toUpperCase() !== 'PERIODIC') continue;
      const name = item.name?.trim() || 'Published periodic fee';
      const amount = periodicFeeAmount(item);
      const monthsPerCharge = periodicCadenceMonths(item);
      if (amount != null && Number.isFinite(amount) && amount >= 0 && monthsPerCharge != null && monthsPerCharge > 0) {
        output.push({ name, amount, monthsPerCharge });
      } else {
        unpricedPeriodicFees.push(`${sourceLabel}: ${name}`);
      }
    }
  };
  collectPeriodic(currentDetail, pricedCurrentPeriodicFees, 'Current product');
  collectPeriodic(targetDetail, pricedPeriodicFees, 'Target product');
  const currentPeriodicFeesMonthly = pricedCurrentPeriodicFees.reduce(
    (sum, item) => sum + item.amount / item.monthsPerCharge,
    0,
  );
  const targetPeriodicFeesMonthly = pricedPeriodicFees.reduce(
    (sum, item) => sum + item.amount / item.monthsPerCharge,
    0,
  );
  const gaps = fees.filter((item) => item.source === 'missing').map((item) => item.key);
  const feeKeyLabel: Record<SwitchFeeKey, string> = {
    currentBankExitFees: 'Current bank exit fees',
    applicationFees: 'Application fees',
    valuationFees: 'Valuation fees',
    settlementFees: 'Settlement fees',
    governmentAndLegalFees: 'Government and legal fees',
    otherUpfrontFees: 'Other upfront fees',
  };
  const unknownFeeReasons = [...new Set([
    ...(currentDetail == null ? ['Current product fee details are unavailable.'] : []),
    ...(targetDetail == null ? ['Target product fee details are unavailable.'] : []),
    ...gaps.map((key) => `${feeKeyLabel[key]} have no confirmed amount.`),
    ...unpricedUpfrontFees.map((name) => `${name} has no fixed published amount.`),
    ...unpricedPeriodicFees.map((name) => `${name} has no fixed amount and cadence.`),
  ])];
  return {
    fees,
    publishedEvidence,
    gaps,
    grossFees,
    cashback,
    netSwitchCost,
    fundingMethod: inputs.fundingMethod,
    financedAmount: inputs.fundingMethod === 'new-loan' ? Math.max(0, netSwitchCost) : 0,
    currentPeriodicFeesMonthly,
    targetPeriodicFeesMonthly,
    pricedCurrentPeriodicFees,
    pricedPeriodicFees,
    unpricedUpfrontFees,
    unpricedPeriodicFees,
    costClaimsAvailable: unknownFeeReasons.length === 0,
    unknownFeeReasons,
  };
}

function monthlyAmount(value: string, frequency: ProjectionFrequency): number {
  const amount = cleanAmount(value) ?? 0;
  if (frequency === 'weekly') return amount * 52 / 12;
  if (frequency === 'fortnightly') return amount * 26 / 12;
  return amount;
}

export function requiredMonthlyRepayment(balance: number, annualRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate <= 0) return balance / months;
  return monthlyRate * balance / (1 - Math.pow(1 + monthlyRate, -months));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcMonths(value: Date, months: number): Date {
  const targetMonth = value.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(value.getUTCFullYear(), targetMonth, Math.min(value.getUTCDate(), lastDay)));
}

function hasPublishedOffset(detail: ProductDetail | null | undefined): boolean {
  const legacy = (detail?.features ?? []).some((item) =>
    (item.label ?? item.name ?? '').trim().toUpperCase() === 'OFFSET',
  );
  if (legacy) return true;
  return normalizedProductFacts(detail).some((fact) => {
    if (fact.kind !== 'feature' || fact.value !== true) return false;
    const leaf = fact.canonicalKey.split(/[.:/]/).filter(Boolean).at(-1)?.toUpperCase();
    return fact.sourceType?.trim().toUpperCase() === 'OFFSET' || leaf === 'OFFSET';
  });
}

interface MutableLeg {
  balance: number;
  offset: number;
  interest: number;
  effectiveDebtFreeDate: string | null;
  contractualPayoffDate: string | null;
}

function advanceLeg(
  leg: MutableLeg,
  annualRate: number,
  principalPayment: number,
  offsetContribution: number,
  date: Date,
): void {
  if (leg.balance <= 0.005) return;
  const interest = Math.max(0, leg.balance - leg.offset) * annualRate / 12;
  const cashPayment = Math.min(leg.balance + interest, principalPayment);
  leg.balance = Math.max(0, leg.balance + interest - cashPayment);
  leg.interest += interest;
  // Offset is a separate asset. It is deliberately not capped at the loan balance.
  leg.offset = Math.max(0, leg.offset + offsetContribution);
  if (!leg.effectiveDebtFreeDate && leg.offset + 0.005 >= leg.balance) {
    leg.effectiveDebtFreeDate = isoDate(date);
  }
  if (!leg.contractualPayoffDate && leg.balance <= 0.005) {
    leg.contractualPayoffDate = isoDate(date);
  }
}

function emptyProjection(
  target: RateRow,
  asAt: string,
  fees: SwitchCostModel,
  missing: string[],
): StaySwitchProjection {
  return {
    ready: false,
    missing,
    asAt,
    projectionScope: 'remaining-term',
    targetProductKey: target.product_key,
    targetProvider: target.provider,
    targetProductName: target.product_name,
    householdAllocation: 0,
    targetAllocationShortfall: 0,
    targetHasOffset: false,
    offsetEvidence: 'not-published',
    fees,
    stay: null,
    switching: null,
    points: [],
    breakEvenDate: null,
    totalInterestSaving: 0,
    totalCostSaving: null,
    assumptions: [],
    warnings: [],
  };
}

export function buildStaySwitchProjection({
  scenario,
  target,
  currentDetail,
  targetDetail,
  now = new Date(),
}: {
  scenario: UserRateScenario;
  target: RateRow;
  currentDetail?: ProductDetail | null;
  targetDetail?: ProductDetail | null;
  now?: Date;
}): StaySwitchProjection {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const asAt = isoDate(today);
  const fees = resolveSwitchCosts(scenario.mortgageSwitch, currentDetail, targetDetail);
  const balance = computeLvr(scenario.mortgage).loan ?? num(scenario.mortgage.loanBalance);
  const currentRate = percentageInputFraction(scenario.mortgage.currentRate);
  // Projection cash flow always uses the target's advertised rate. Comparison
  // rate remains a ranking and disclosure measure elsewhere in the app.
  const targetRate = toFraction(target.rate);
  const years = Number(scenario.mortgage.years.replace(/[,\s]/g, ''));
  const months = Math.round(years * 12);
  const targetIsFixed = target.ribbon_rate_structure?.toLowerCase() === 'fixed'
    || target.rate_type?.toLowerCase().includes('fixed') === true;
  const publishedFixedMonths = targetIsFixed ? advertisedTermMonths(target) : null;
  const modelMonths = targetIsFixed && publishedFixedMonths
    ? Math.min(months, publishedFixedMonths)
    : months;
  const projectionInputs = scenario.projections.mortgage;
  const invalidSwitchValues = [
    ...FEE_KEYS.map((key) => [scenario.mortgageSwitch[key], key] as const),
    [scenario.mortgageSwitch.cashback, 'cashback'] as const,
  ].filter(([value]) => value.trim() && cleanAmount(value) == null).map(([, label]) => label);
  const invalidProjectionValues = [
    [projectionInputs.periodicAmount, 'regular repayment'],
    [projectionInputs.extraRepaymentAmount, 'extra repayment'],
    [projectionInputs.offsetContributionAmount, 'offset contribution'],
    [projectionInputs.offsetBalance, 'offset balance'],
  ].filter(([value]) => value.trim() && cleanAmount(value) == null).map(([, label]) => label);
  const missing = [
    ...(balance > 0 && balance <= MAX_AMOUNT ? [] : ['current loan balance']),
    ...(currentRate != null && currentRate >= 0 && currentRate <= 1 ? [] : ['current advertised rate']),
    ...(targetRate != null && targetRate >= 0 && targetRate <= 1 ? [] : ['target advertised rate']),
    ...(months > 0 && months <= MAX_MONTHS ? [] : ['remaining term from 1 month to 50 years']),
    ...(targetIsFixed && !publishedFixedMonths ? ['published target fixed period'] : []),
    ...invalidSwitchValues.map((label) => `${label} from $0 to $1 trillion`),
    ...invalidProjectionValues.map((label) => `${label} from $0 to $1 trillion`),
  ];
  if (missing.length) return emptyProjection(target, asAt, fees, missing);

  const enteredRepayment = monthlyAmount(projectionInputs.periodicAmount, projectionInputs.periodicFrequency);
  const stayRequired = requiredMonthlyRepayment(balance, currentRate!, months);
  const stayScheduled = enteredRepayment || stayRequired;
  const extraRepayment = monthlyAmount(projectionInputs.extraRepaymentAmount, projectionInputs.extraRepaymentFrequency);
  const enteredOffsetContribution = monthlyAmount(
    projectionInputs.offsetContributionAmount,
    projectionInputs.offsetContributionFrequency,
  );
  const householdAllocation = stayScheduled + extraRepayment + enteredOffsetContribution;
  const openingOffset = cleanAmount(projectionInputs.offsetBalance) ?? 0;
  const currentHasOffset = openingOffset > 0 || enteredOffsetContribution > 0 || hasPublishedOffset(currentDetail);
  const publishedTargetOffset = hasPublishedOffset(targetDetail);
  const targetHasOffset = scenario.mortgageSwitch.targetOffsetAvailable === 'yes'
    ? true
    : scenario.mortgageSwitch.targetOffsetAvailable === 'no'
      ? false
      : publishedTargetOffset;
  const offsetEvidence = scenario.mortgageSwitch.targetOffsetAvailable === 'auto'
    ? targetDetail === undefined
      ? 'unavailable'
      : publishedTargetOffset ? 'published' : 'not-published'
    : 'entered';

  const cashFundedSwitchCost = scenario.mortgageSwitch.fundingMethod === 'cash-or-offset'
    ? Math.max(0, fees.netSwitchCost)
    : 0;
  const retainedOpeningOffset = Math.max(0, openingOffset - cashFundedSwitchCost);
  const switchOpeningBalance = Math.max(
    0,
    balance + fees.financedAmount - (targetHasOffset ? 0 : retainedOpeningOffset),
  );
  const switchRequired = requiredMonthlyRepayment(switchOpeningBalance, targetRate!, months);
  const targetAllocationShortfall = Math.max(0, switchRequired - householdAllocation);
  const targetPrincipalPayment = targetHasOffset
    ? switchRequired
    : Math.max(switchRequired, householdAllocation);
  const targetOffsetContribution = targetHasOffset
    ? Math.max(0, householdAllocation - switchRequired)
    : 0;
  const stayPrincipalPayment = stayScheduled + extraRepayment;
  const stayOffsetContribution = currentHasOffset ? enteredOffsetContribution : 0;

  const stay: MutableLeg = {
    balance,
    offset: currentHasOffset ? openingOffset : 0,
    interest: 0,
    effectiveDebtFreeDate: currentHasOffset && openingOffset >= balance ? asAt : null,
    contractualPayoffDate: null,
  };
  const switchOpeningOffset = targetHasOffset
    ? retainedOpeningOffset
    : 0;
  const switching: MutableLeg = {
    balance: switchOpeningBalance,
    offset: switchOpeningOffset,
    interest: 0,
    effectiveDebtFreeDate: switchOpeningBalance <= 0.005 || (targetHasOffset && switchOpeningOffset >= switchOpeningBalance) ? asAt : null,
    contractualPayoffDate: switchOpeningBalance <= 0.005 ? asAt : null,
  };
  const points: StaySwitchPoint[] = [];
  let breakEvenDate: string | null = null;
  let stayFeeMonths = 0;
  let switchFeeMonths = 0;
  const pushPoint = (date: Date) => {
    const cumulativeStayCost = fees.costClaimsAvailable
      ? stay.interest + fees.currentPeriodicFeesMonthly * stayFeeMonths
      : null;
    const cumulativeSwitchCost = fees.costClaimsAvailable
      ? switching.interest + fees.netSwitchCost + fees.targetPeriodicFeesMonthly * switchFeeMonths
      : null;
    const cumulativeSaving = cumulativeStayCost != null && cumulativeSwitchCost != null
      ? cumulativeStayCost - cumulativeSwitchCost
      : null;
    points.push({
      date: isoDate(date),
      stayBalance: stay.balance,
      switchBalance: switching.balance,
      stayOffset: stay.offset,
      switchOffset: switching.offset,
      stayNetDebt: Math.max(0, stay.balance - stay.offset),
      switchNetDebt: Math.max(0, switching.balance - switching.offset),
      cumulativeStayInterest: stay.interest,
      cumulativeStayCost,
      cumulativeSwitchInterest: switching.interest,
      cumulativeSwitchCost,
      cumulativeSaving,
    });
    if (!breakEvenDate && cumulativeSaving != null && cumulativeSaving > 0.005) {
      // With no opening cost, the paths are equal at settlement. Treat that as
      // break-even only after the switch proves it produces a positive saving.
      breakEvenDate = fees.netSwitchCost === 0 ? asAt : isoDate(date);
    }
  };
  pushPoint(today);
  for (let month = 1; month <= modelMonths; month += 1) {
    const date = addUtcMonths(today, month);
    if (!stay.contractualPayoffDate) stayFeeMonths += 1;
    if (!switching.contractualPayoffDate) switchFeeMonths += 1;
    advanceLeg(stay, currentRate!, stayPrincipalPayment, stayOffsetContribution, date);
    advanceLeg(switching, targetRate!, targetPrincipalPayment, targetOffsetContribution, date);
    pushPoint(date);
    if (stay.contractualPayoffDate && switching.contractualPayoffDate) break;
  }

  const stayTotalCost = fees.costClaimsAvailable
    ? stay.interest + fees.currentPeriodicFeesMonthly * stayFeeMonths
    : null;
  const switchTotalCost = fees.costClaimsAvailable
    ? switching.interest + fees.netSwitchCost + fees.targetPeriodicFeesMonthly * switchFeeMonths
    : null;
  const warnings: string[] = [];
  if (targetAllocationShortfall > 0.005) {
    warnings.push(`The target minimum repayment is $${Math.round(targetAllocationShortfall).toLocaleString('en-AU')} per month above the current household allocation.`);
  }
  if (offsetEvidence === 'not-published') {
    warnings.push('No target offset feature was found in published product data; spare allocation is modelled as principal repayments.');
  }
  if (offsetEvidence === 'unavailable') {
    warnings.push('Target product details are unavailable; no target offset is assumed until they load.');
  }
  if (!fees.costClaimsAvailable) warnings.push('Cost difference and break-even are unavailable until every applicable fee amount is confirmed.');
  if (fees.netSwitchCost < 0) warnings.push('Entered cashback exceeds modelled fees; confirm eligibility and payment timing.');
  if (targetIsFixed) warnings.push('The comparison stops at the published fixed-period end; no unknown reversion rate is invented.');

  return {
    ready: true,
    missing: [],
    asAt,
    projectionScope: targetIsFixed ? 'published-fixed-period' : 'remaining-term',
    targetProductKey: target.product_key,
    targetProvider: target.provider,
    targetProductName: target.product_name,
    householdAllocation,
    targetAllocationShortfall,
    targetHasOffset,
    offsetEvidence,
    fees,
    stay: {
      advertisedRate: currentRate!,
      requiredRepayment: stayRequired,
      principalPayment: stayPrincipalPayment,
      offsetContribution: stayOffsetContribution,
      totalMonthlyAllocation: householdAllocation,
      openingBalance: balance,
      totalInterest: stay.interest,
      totalCost: stayTotalCost,
      effectiveDebtFreeDate: stay.effectiveDebtFreeDate,
      contractualPayoffDate: stay.contractualPayoffDate,
      endBalance: stay.balance,
      endOffset: stay.offset,
    },
    switching: {
      advertisedRate: targetRate!,
      requiredRepayment: switchRequired,
      principalPayment: targetPrincipalPayment,
      offsetContribution: targetOffsetContribution,
      totalMonthlyAllocation: Math.max(householdAllocation, switchRequired),
      openingBalance: switchOpeningBalance,
      totalInterest: switching.interest,
      totalCost: switchTotalCost,
      effectiveDebtFreeDate: switching.effectiveDebtFreeDate,
      contractualPayoffDate: switching.contractualPayoffDate,
      endBalance: switching.balance,
      endOffset: switching.offset,
    },
    points,
    breakEvenDate,
    totalInterestSaving: stay.interest - switching.interest,
    totalCostSaving: stayTotalCost != null && switchTotalCost != null
      ? stayTotalCost - switchTotalCost
      : null,
    assumptions: [
      'Both paths start with the same loan balance, remaining term and current offset balance.',
      'The target cash flow uses its advertised rate; comparison rate is not an amortisation rate.',
      targetAllocationShortfall > 0.005
        ? 'The current repayment, extra repayment and offset contribution form the baseline allocation; the target contractual minimum requires the disclosed additional amount.'
        : 'The current repayment, extra repayment and offset contribution form one fixed monthly household allocation for both paths.',
      targetHasOffset
        ? 'After the target minimum repayment, spare household allocation is added to an independent, uncapped offset balance.'
        : 'Without a published or entered target offset, spare household allocation is paid to principal.',
      scenario.mortgageSwitch.fundingMethod === 'new-loan'
        ? 'Positive net switch costs are added to the new loan balance.'
        : 'Positive net switch costs are paid from cash or offset rather than added to the new loan.',
      'Rates and the entered cash allocation are held constant; tax, refinancing timing and future rate changes are not forecast.',
      ...(!fees.costClaimsAvailable
        ? ['The loan and interest paths use known inputs only; unknown fee amounts are not treated as zero.']
        : []),
      ...(targetIsFixed ? [`The target advertised rate is modelled for ${modelMonths} months only.`] : []),
    ],
    warnings,
  };
}
