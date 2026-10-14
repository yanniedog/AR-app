import { computeLvr, num } from './calc';
import { toFraction } from './format';
import type { ProjectionFrequency, ProjectionInputs } from './projectionScenario';
import type { UserRateScenario } from './userRateScenario';
import type { SectionKey } from '../types';
import { uiJoin, uiNumber, type UiLabel, type UiText } from '../lib/uiCopy';
import { projectionFacts, type ProjectionFact, type ProjectionHistorySnapshot, type ProjectionSeriesId } from './projectionFacts';

export type ProjectionMetric =
  | 'balance'
  | 'periodInterest'
  | 'cumulativeInterest'
  | 'periodPrincipal'
  | 'cumulativePrincipal'
  | 'periodRatio'
  | 'cumulativeRatio';

export type ProjectionDimension = 'rates' | 'offsets';

export interface ProjectionPoint {
  date: string;
  balance: number;
  periodInterest: number;
  cumulativeInterest: number;
  periodPrincipal: number;
  cumulativePrincipal: number;
  periodRatio: number | null;
  cumulativeRatio: number | null;
  offsetBalance: number;
}

export interface ProjectionSeries {
  id: ProjectionSeriesId;
  label: UiLabel;
  annualRate: number;
  points: ProjectionPoint[];
  payoffDate: string | null;
  totalInterest: number;
  totalPrincipal: number;
  projectedInterest: number;
  projectedPrincipal: number;
  endBalance: number;
  totalValue: number;
}

export interface LifecycleProjection {
  section: SectionKey;
  ready: boolean;
  missing: string[];
  asAt: string;
  history: ProjectionPoint[];
  rateSeries: ProjectionSeries[];
  offsetSeries: ProjectionSeries[];
  facts: readonly ProjectionFact[];
  defaultMetric: ProjectionMetric;
  availableMetrics: ProjectionMetric[];
  projectionScope: 'full-term' | 'fixed-period' | 'savings-horizon' | 'term-deposit-maturity';
}

export interface MortgageOffsetImpact {
  /** Opening loan balance after the entered offset is applied for interest. */
  effectiveInterestBearingBalance: number;
  /** Modelled interest difference against the same loan with no offset. */
  interestDifference: number;
  /** Earlier payoff in whole simulated months; unavailable for bounded/incomplete projections. */
  payoffMonthsEarlier: number | null;
  /** A net saving cannot be stated until applicable offset/package fees are known. */
  netDifference: null;
  feeCoverage: 'unverified';
  comparisonScope: 'fixed-period' | 'remaining-term';
  comparisonMonths: number;
}

export const MAX_PROJECTION_YEARS = 50;
const MAX_MONTHS = MAX_PROJECTION_YEARS * 12;
export const MAX_MORTGAGE_BALANCE = 100_000_000;
export const MAX_DEPOSIT_BALANCE = 20_000_000;
export const MAX_PERIODIC_AMOUNT = 1_000_000;

function cleanNumber(value: string): number {
  const parsed = Number(String(value ?? '').replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function rawNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse user-entered rates as percent or fraction, aligned with {@link toFraction}. Allows 0%. */
function percentageFraction(value: string): number | null {
  if (!value.trim()) return null;
  const cleaned = value.replace(/[,%\s]/g, '');
  if (cleaned === '0' || cleaned === '0.0' || cleaned === '0.00') return 0;
  const fraction = toFraction(cleaned);
  return fraction != null && fraction <= 1 ? fraction : null;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && isoDate(parsed) === value ? parsed : null;
}

function addUtcMonths(value: Date, months: number): Date {
  const targetMonth = value.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    targetMonth,
    Math.min(value.getUTCDate(), lastDay),
  ));
}

function monthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const rough = (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + to.getUTCMonth() - from.getUTCMonth();
  return Math.max(0, Math.min(MAX_MONTHS, rough + (to.getUTCDate() >= from.getUTCDate() ? 0 : -1)));
}

function monthlyAmount(value: string, frequency: ProjectionFrequency): number {
  const amount = cleanNumber(value);
  if (frequency === 'weekly') return amount * 52 / 12;
  if (frequency === 'fortnightly') return amount * 26 / 12;
  return amount;
}

function repaymentFor(balance: number, annualRate: number, months: number): number {
  if (months <= 0) return 0;
  const monthlyRate = annualRate / 12;
  if (monthlyRate <= 0) return balance / months;
  return (monthlyRate * balance) / (1 - Math.pow(1 + monthlyRate, -months));
}

function point(
  date: Date,
  balance: number,
  periodInterest: number,
  cumulativeInterest: number,
  periodPrincipal: number,
  cumulativePrincipal: number,
  offsetBalance = 0,
): ProjectionPoint {
  return {
    date: isoDate(date),
    balance,
    periodInterest,
    cumulativeInterest,
    periodPrincipal,
    cumulativePrincipal,
    periodRatio: periodPrincipal > 0 ? periodInterest / periodPrincipal : null,
    cumulativeRatio: cumulativePrincipal > 0 ? cumulativeInterest / cumulativePrincipal : null,
    offsetBalance,
  };
}

interface SimulationSeed {
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

interface MortgageSimulation {
  points: ProjectionPoint[];
  repayment: number;
  negativeAmortisation: boolean;
}

function simulateMortgage({
  date,
  balance: openingBalance,
  annualRate,
  months,
  repayment,
  extraRepayment,
  offsetBalance: openingOffset,
  offsetGrowth,
  seed,
  keepFullWindow = false,
}: {
  date: Date;
  balance: number;
  annualRate: number;
  months: number;
  repayment: number;
  extraRepayment: number;
  offsetBalance: number;
  offsetGrowth: number;
  seed?: SimulationSeed;
  keepFullWindow?: boolean;
}): MortgageSimulation {
  const points: ProjectionPoint[] = [];
  let balance = openingBalance;
  let offset = Math.min(openingOffset, balance);
  let cumulativeInterest = seed?.cumulativeInterest ?? 0;
  let cumulativePrincipal = seed?.cumulativePrincipal ?? 0;
  let negativeAmortisation = false;
  points.push(point(date, balance, 0, cumulativeInterest, 0, cumulativePrincipal, offset));
  for (let month = 1; month <= Math.min(MAX_MONTHS, months); month += 1) {
    const before = balance;
    const interest = Math.max(0, before - offset) * annualRate / 12;
    const cashPayment = Math.min(before + interest, repayment + extraRepayment);
    balance = Math.max(0, before + interest - cashPayment);
    const principal = Math.max(0, before - balance);
    if (balance > before + 0.01) negativeAmortisation = true;
    cumulativeInterest += interest;
    cumulativePrincipal += principal;
    offset = Math.min(balance, offset + offsetGrowth);
    points.push(point(
      addUtcMonths(date, month),
      balance,
      interest,
      cumulativeInterest,
      principal,
      cumulativePrincipal,
      offset,
    ));
    if (balance <= 0.005 && !keepFullWindow) break;
  }
  return { points, repayment, negativeAmortisation };
}

function simulateSavings({
  date,
  balance: openingBalance,
  annualRate,
  months,
  contribution,
  withdrawal,
  seed,
  annualRateAfter,
  rateChangesAfterMonths,
}: {
  date: Date;
  balance: number;
  annualRate: number;
  months: number;
  contribution: number;
  withdrawal: number;
  seed?: SimulationSeed;
  annualRateAfter?: number;
  rateChangesAfterMonths?: number;
}): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  let balance = openingBalance;
  let cumulativeInterest = seed?.cumulativeInterest ?? 0;
  let cumulativePrincipal = seed?.cumulativePrincipal ?? 0;
  points.push(point(date, balance, 0, cumulativeInterest, 0, cumulativePrincipal));
  for (let month = 1; month <= Math.min(MAX_MONTHS, months); month += 1) {
    const activeRate = annualRateAfter != null && rateChangesAfterMonths != null && month > rateChangesAfterMonths
      ? annualRateAfter
      : annualRate;
    const interest = balance * activeRate / 12;
    const netContribution = contribution - Math.min(balance + interest + contribution, withdrawal);
    balance = Math.max(0, balance + interest + netContribution);
    cumulativeInterest += interest;
    cumulativePrincipal += netContribution;
    points.push(point(
      addUtcMonths(date, month),
      balance,
      interest,
      cumulativeInterest,
      netContribution,
      cumulativePrincipal,
    ));
  }
  return points;
}

function simulateTermDeposit({
  date,
  balance: openingBalance,
  annualRate,
  termMonths,
  rollovers,
  reinvestInterest,
  seed,
  totalMonthsOverride,
  rolloverAnnualRate,
}: {
  date: Date;
  balance: number;
  annualRate: number;
  termMonths: number;
  rollovers: number;
  reinvestInterest: boolean;
  seed?: SimulationSeed;
  totalMonthsOverride?: number;
  rolloverAnnualRate?: number;
}): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  let balance = openingBalance;
  let cumulativeInterest = seed?.cumulativeInterest ?? 0;
  const cumulativePrincipal = seed?.cumulativePrincipal ?? 0;
  let termInterest = 0;
  const totalMonths = Math.min(MAX_MONTHS, totalMonthsOverride ?? termMonths * (rollovers + 1));
  points.push(point(date, balance, 0, cumulativeInterest, 0, cumulativePrincipal));
  for (let month = 1; month <= totalMonths; month += 1) {
    const activeRate = month > termMonths ? (rolloverAnnualRate ?? annualRate) : annualRate;
    const interest = balance * activeRate / 12;
    cumulativeInterest += interest;
    termInterest += interest;
    if (month % termMonths === 0) {
      if (reinvestInterest) balance += termInterest;
      termInterest = 0;
    }
    points.push(point(
      addUtcMonths(date, month),
      balance,
      interest,
      cumulativeInterest,
      0,
      cumulativePrincipal,
    ));
  }
  return points;
}

function toSeries(
  id: ProjectionSeriesId,
  label: UiLabel,
  annualRate: number,
  points: ProjectionPoint[],
  totalValue?: number,
): ProjectionSeries {
  const first = points[0];
  const last = points.at(-1)!;
  const payoff = points.find((item, index) => index > 0 && item.balance <= 0.005)?.date ?? null;
  return {
    id,
    label,
    annualRate,
    points,
    payoffDate: payoff,
    totalInterest: last.cumulativeInterest,
    totalPrincipal: last.cumulativePrincipal,
    projectedInterest: last.cumulativeInterest - first.cumulativeInterest,
    projectedPrincipal: last.cumulativePrincipal - first.cumulativePrincipal,
    endBalance: last.balance,
    totalValue: totalValue ?? last.balance,
  };
}

function historyAnchor(inputs: ProjectionInputs, today: Date): {
  date: Date;
  months: number;
  balance: number;
  rate: number;
} | null {
  const date = parseIsoDate(inputs.startDate);
  const balance = cleanNumber(inputs.startBalance);
  const rate = percentageFraction(inputs.startRate);
  if (!date || balance <= 0 || rate == null || date.getTime() >= today.getTime()) return null;
  const months = monthsBetween(date, today);
  return months > 0 ? { date, months, balance, rate } : null;
}

function rateRange(currentRate: number, inputs: ProjectionInputs): [number, number, number] {
  const enteredLower = percentageFraction(inputs.lowerRate);
  const enteredHigher = percentageFraction(inputs.higherRate);
  const lower = enteredLower != null && enteredLower <= currentRate
    ? enteredLower
    : Math.max(0, currentRate - 0.01);
  const higher = enteredHigher != null && enteredHigher >= currentRate
    ? enteredHigher
    : Math.min(1, currentRate + 0.01);
  return [lower, currentRate, higher];
}

function optionalInputErrors(
  inputs: ProjectionInputs,
  currentRate: number,
  today: Date,
  mortgageBalance?: number,
): string[] {
  const errors: string[] = [];
  const hasSomeHistory = [inputs.startDate, inputs.startBalance, inputs.startRate]
    .some((value) => value.trim().length > 0);
  if (hasSomeHistory && !historyAnchor(inputs, today)) {
    errors.push('complete historical starting date, balance and rate (date must be before today)');
  }
  const lower = percentageFraction(inputs.lowerRate);
  if (inputs.lowerRate.trim() && (lower == null || lower > currentRate)) {
    errors.push('lower-rate scenario from 0% to the current rate');
  }
  const higher = percentageFraction(inputs.higherRate);
  if (inputs.higherRate.trim() && (higher == null || higher < currentRate)) {
    errors.push('higher-rate scenario from the current rate to 100%');
  }
  const amountFields: [string, string, number, string][] = [
    [inputs.periodicAmount, 'regular amount', MAX_PERIODIC_AMOUNT, '$1 million per selected period'],
    [inputs.withdrawalAmount, 'withdrawal amount', MAX_PERIODIC_AMOUNT, '$1 million per selected period'],
    [
      inputs.offsetBalance,
      'offset balance',
      mortgageBalance ?? MAX_MORTGAGE_BALANCE,
      mortgageBalance ? 'the current loan balance' : '$100 million',
    ],
    [inputs.startOffsetBalance, 'starting offset balance', MAX_MORTGAGE_BALANCE, '$100 million'],
    [inputs.offsetContributionAmount, 'offset contribution', MAX_PERIODIC_AMOUNT, '$1 million per selected period'],
    [inputs.offsetBoostAmount, 'offset boost', MAX_PERIODIC_AMOUNT, '$1 million per selected period'],
    [inputs.extraRepaymentAmount, 'extra repayment', MAX_PERIODIC_AMOUNT, '$1 million per selected period'],
  ];
  amountFields.forEach(([value, label, maximum, maximumLabel]) => {
    const parsed = rawNumber(value);
    if (value.trim() && (parsed == null || parsed < 0 || parsed > maximum)) {
      errors.push(`${label} from $0 to ${maximumLabel}`);
    }
  });
  return errors;
}

function emptyProjection(section: SectionKey, today: Date, missing: string[]): LifecycleProjection {
  return {
    section,
    ready: false,
    missing,
    asAt: isoDate(today),
    history: [],
    rateSeries: [],
    offsetSeries: [],
    facts: [],
    defaultMetric: 'balance',
    availableMetrics: ['balance'],
    projectionScope: section === 'Mortgage'
      ? 'full-term'
      : section === 'TD'
        ? 'term-deposit-maturity'
        : 'savings-horizon',
  };
}

export function metricValue(pointValue: ProjectionPoint, metric: ProjectionMetric): number | null {
  return pointValue[metric];
}

/**
 * Compare the user's entered offset plan with the same loan, rate, repayments,
 * term and extra repayments but no offset. The result is deliberately an
 * interest-only difference: applicable offset/package fees are not present in
 * the projection contract, so a net saving must remain unavailable.
 */
export function mortgageOffsetImpact(result: LifecycleProjection): MortgageOffsetImpact | null {
  if (!result.ready || result.section !== 'Mortgage') return null;
  const withoutOffset = result.offsetSeries.find((item) => item.id === 'offset-none');
  const offsetPlan = result.offsetSeries.find((item) => item.id === 'offset-plan');
  const opening = offsetPlan?.points[0];
  if (!withoutOffset || !offsetPlan || !opening) return null;
  const interestDifference = Math.max(0, withoutOffset.projectedInterest - offsetPlan.projectedInterest);
  if (opening.offsetBalance <= 0 && interestDifference <= 0.005) return null;
  const payoffIndex = (series: ProjectionSeries): number | null => {
    const index = series.points.findIndex((pointValue, pointIndex) => pointIndex > 0 && pointValue.balance <= 0.005);
    return index >= 0 ? index : null;
  };
  const withoutOffsetPayoff = payoffIndex(withoutOffset);
  const offsetPlanPayoff = payoffIndex(offsetPlan);
  const payoffMonthsEarlier = result.projectionScope === 'full-term'
    && withoutOffsetPayoff != null
    && offsetPlanPayoff != null
    ? Math.max(0, withoutOffsetPayoff - offsetPlanPayoff)
    : null;
  const projectedMonths = Math.max(0, offsetPlan.points.length - 1);
  return {
    effectiveInterestBearingBalance: Math.max(0, opening.balance - opening.offsetBalance),
    interestDifference,
    payoffMonthsEarlier,
    netDifference: null,
    feeCoverage: 'unverified',
    comparisonScope: result.projectionScope === 'fixed-period' ? 'fixed-period' : 'remaining-term',
    comparisonMonths: projectedMonths,
  };
}

export function buildLifecycleProjection(
  section: SectionKey,
  scenario: UserRateScenario,
  now = new Date(),
): LifecycleProjection {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const key = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const inputs = scenario.projections[key];
  let historySnapshot: ProjectionHistorySnapshot | null = null;
  const historySeed: SimulationSeed = { cumulativeInterest: 0, cumulativePrincipal: 0 };
  let history: ProjectionPoint[] = [];

  if (section === 'Mortgage') {
    const lvr = computeLvr(scenario.mortgage);
    const balance = lvr.loan ?? num(scenario.mortgage.loanBalance);
    const annualRate = percentageFraction(scenario.mortgage.currentRate);
    const enteredYears = cleanNumber(scenario.mortgage.years);
    const remainingMonths = Math.round(enteredYears * 12);
    const fixedRate = inputs.mortgageRateStructure === 'fixed';
    const fixedPeriodMonths = Math.round(cleanNumber(inputs.fixedPeriodMonths));
    const months = fixedRate ? Math.min(remainingMonths, fixedPeriodMonths) : remainingMonths;
    const missing = [
      ...(balance > 0 && balance <= MAX_MORTGAGE_BALANCE ? [] : ['current loan balance up to $100 million']),
      ...(annualRate != null ? [] : ['current interest rate from 0% to 100%']),
      ...(remainingMonths > 0 && enteredYears <= MAX_PROJECTION_YEARS
        ? []
        : [`remaining term from 1 month to ${MAX_PROJECTION_YEARS} years`]),
      ...(fixedRate && (fixedPeriodMonths <= 0 || fixedPeriodMonths > remainingMonths)
        ? ['fixed period no longer than the remaining term']
        : []),
    ];
    if (annualRate != null) missing.push(...optionalInputErrors(inputs, annualRate, today, balance));
    if (missing.length) return emptyProjection(section, today, missing);

    const enteredRepayment = monthlyAmount(inputs.periodicAmount, inputs.periodicFrequency);
    const repayment = enteredRepayment || repaymentFor(balance, annualRate!, remainingMonths);
    const extraRepayment = monthlyAmount(inputs.extraRepaymentAmount, inputs.extraRepaymentFrequency);
    const offsetBalance = Math.min(balance, cleanNumber(inputs.offsetBalance));
    const offsetGrowth = monthlyAmount(inputs.offsetContributionAmount, inputs.offsetContributionFrequency);
    const offsetBoost = monthlyAmount(inputs.offsetBoostAmount, inputs.offsetContributionFrequency);
    const anchor = historyAnchor(inputs, today);
    let forwardOpeningOffset = offsetBalance;
    if (anchor) {
      const historicalPayment = enteredRepayment || repaymentFor(anchor.balance, anchor.rate, Math.max(anchor.months, months + anchor.months));
      history = simulateMortgage({
        date: anchor.date,
        balance: anchor.balance,
        annualRate: anchor.rate,
        months: anchor.months,
        repayment: historicalPayment,
        extraRepayment,
        offsetBalance: cleanNumber(inputs.startOffsetBalance),
        offsetGrowth,
        keepFullWindow: true,
      }).points;
      const historicalLast = history.at(-1)!;
      historySeed.cumulativeInterest = historicalLast.cumulativeInterest;
      historySeed.cumulativePrincipal = historicalLast.cumulativePrincipal;
      forwardOpeningOffset = historicalLast.offsetBalance;
      const mismatch = Math.abs(historicalLast.balance - balance);
      const offsetMismatch = Math.abs(forwardOpeningOffset - offsetBalance);
      historySnapshot = { anchorDay: isoDate(anchor.date), anchorBalance: anchor.balance, anchorRateFraction: anchor.rate,
        simulatedEndBalance: historicalLast.balance, currentEnteredBalance: balance, balanceDifference: mismatch,
        balanceMismatchReported: mismatch > Math.max(100, balance * 0.01),
        offset: { simulatedEndAmount: forwardOpeningOffset, currentEnteredAmount: offsetBalance, difference: offsetMismatch,
          mismatchReported: offsetMismatch > Math.max(100, balance * 0.01) } };
    }

    const [lowerRate, baseRate, higherRate] = rateRange(annualRate!, inputs);
    const outcomes: { id: ProjectionSeriesId; negativeAmortisation: boolean; closingBalance: number }[] = [];
    const mortgageSeries = (
      id: ProjectionSeriesId,
      label: UiLabel,
      rate: number,
      openingOffset: number,
      monthlyOffsetGrowth: number,
    ) => {
      const simulated = simulateMortgage({
        date: today,
        balance,
        annualRate: rate,
        months,
        repayment,
        extraRepayment,
        offsetBalance: openingOffset,
        offsetGrowth: monthlyOffsetGrowth,
        seed: historySeed,
      });
      outcomes.push({ id, negativeAmortisation: simulated.negativeAmortisation, closingBalance: simulated.points.at(-1)!.balance });
      return toSeries(id, label, rate, simulated.points);
    };
    const rateSeries = [
      mortgageSeries('rate-lower', 'Lower rate', lowerRate, forwardOpeningOffset, offsetGrowth),
      mortgageSeries('rate-base', 'Current rate', baseRate, forwardOpeningOffset, offsetGrowth),
      mortgageSeries('rate-higher', 'Higher rate', higherRate, forwardOpeningOffset, offsetGrowth),
    ];
    const offsetSeries = [
      mortgageSeries('offset-none', 'No offset', baseRate, 0, 0),
      mortgageSeries('offset-steady', 'Offset stays level', baseRate, forwardOpeningOffset, 0),
      mortgageSeries('offset-plan', 'Your offset plan', baseRate, forwardOpeningOffset, offsetGrowth),
      ...(offsetBoost > 0
        ? [mortgageSeries('offset-boost', 'Boosted offset', baseRate, forwardOpeningOffset, offsetGrowth + offsetBoost)]
        : []),
    ];
    return {
      section,
      ready: true,
      missing: [],
      asAt: isoDate(today),
      history,
      rateSeries,
      offsetSeries,
      facts: projectionFacts({ section: 'Mortgage', months, remainingYears: enteredYears, fixed: fixedRate,
        rateRange: [lowerRate, baseRate, higherRate], history: historySnapshot,
        repayment: { monthlyAmount: repayment, source: enteredRepayment ? 'entered' : 'illustrative', enteredFrequency: inputs.periodicFrequency },
        extraRepayment: { monthlyAmount: extraRepayment, enteredFrequency: inputs.extraRepaymentFrequency },
        offset: { openingAmount: forwardOpeningOffset, openingSource: anchor ? 'simulated-history' : 'entered',
          growthMonthlyAmount: offsetGrowth, boostMonthlyAmount: offsetBoost, enteredFrequency: inputs.offsetContributionFrequency }, outcomes }),
      defaultMetric: 'balance',
      availableMetrics: [
        'balance',
        'periodInterest',
        'cumulativeInterest',
        'periodPrincipal',
        'cumulativePrincipal',
        'periodRatio',
        'cumulativeRatio',
      ],
      projectionScope: fixedRate ? 'fixed-period' : 'full-term',
    };
  }

  const deposit = section === 'TD' ? scenario.termDeposit : scenario.savings;
  const balance = cleanNumber(deposit.balance);
  const annualRate = percentageFraction(deposit.currentRate);
  const missing = [
    ...(balance > 0 && balance <= MAX_DEPOSIT_BALANCE ? [] : [section === 'TD' ? 'deposit amount up to $20 million' : 'current balance up to $20 million']),
    ...(annualRate != null ? [] : ['current interest rate from 0% to 100%']),
  ];
  const enteredTermMonths = cleanNumber(inputs.termMonths);
  const enteredRollovers = cleanNumber(inputs.rollovers);
  const enteredHorizonYears = cleanNumber(inputs.horizonYears);
  const bonusSavings = section === 'Savings' && inputs.savingsRateStructure === 'conditional-bonus';
  const ongoingRate = bonusSavings ? percentageFraction(inputs.ongoingRate) : annualRate;
  const bonusMonths = cleanNumber(inputs.bonusMonthsRemaining);
  if (section === 'TD' && (!Number.isInteger(enteredTermMonths) || enteredTermMonths < 1 || enteredTermMonths > 120)) {
    missing.push('whole-number term from 1 to 120 months');
  }
  if (section === 'TD' && (!Number.isInteger(enteredRollovers) || enteredRollovers < 0 || enteredRollovers > 10)) {
    missing.push('whole-number rollovers from 0 to 10');
  }
  if (section === 'Savings' && (!(enteredHorizonYears > 0) || enteredHorizonYears > MAX_PROJECTION_YEARS)) {
    missing.push(`projection horizon above 0 and up to ${MAX_PROJECTION_YEARS} years`);
  }
  if (bonusSavings && ongoingRate == null) missing.push('ongoing savings rate from 0% to 100%');
  if (bonusSavings && (!Number.isInteger(bonusMonths) || bonusMonths < 0 || bonusMonths > 60)) {
    missing.push('whole-number bonus period from 0 to 60 months');
  }
  if (ongoingRate != null) missing.push(...optionalInputErrors(inputs, ongoingRate, today));
  if (missing.length) return emptyProjection(section, today, missing);

  const contribution = monthlyAmount(inputs.periodicAmount, inputs.periodicFrequency);
  const withdrawal = monthlyAmount(inputs.withdrawalAmount, inputs.withdrawalFrequency);
  const anchor = historyAnchor(inputs, today);
  if (anchor) {
    history = section === 'TD'
      ? simulateTermDeposit({
        date: anchor.date,
        balance: anchor.balance,
        annualRate: anchor.rate,
        termMonths: enteredTermMonths,
        rollovers: 0,
        reinvestInterest: inputs.reinvestInterest,
        totalMonthsOverride: anchor.months,
      })
      : simulateSavings({
        date: anchor.date,
        balance: anchor.balance,
        annualRate: anchor.rate,
        months: anchor.months,
        contribution,
        withdrawal,
      });
    const historicalLast = history.at(-1)!;
    historySeed.cumulativeInterest = historicalLast.cumulativeInterest;
    historySeed.cumulativePrincipal = historicalLast.cumulativePrincipal;
    const mismatch = Math.abs(historicalLast.balance - balance);
    historySnapshot = { anchorDay: isoDate(anchor.date), anchorBalance: anchor.balance, anchorRateFraction: anchor.rate,
      simulatedEndBalance: historicalLast.balance, currentEnteredBalance: balance, balanceDifference: mismatch,
      balanceMismatchReported: mismatch > Math.max(100, balance * 0.01) };
  }

  const [lowerRate, baseRate, higherRate] = rateRange(ongoingRate!, inputs);
  const ongoingBaseLabel = bonusSavings && inputs.bonusConditionsMet ? 'Ongoing rate' : 'Current rate';
  const rates: [ProjectionSeriesId, UiLabel, number][] = [
    ['rate-lower', 'Lower rate', lowerRate],
    ['rate-base', ongoingBaseLabel, baseRate],
    ['rate-higher', 'Higher rate', higherRate],
  ];
  let rateSeries: ProjectionSeries[];
  if (section === 'TD') {
    const termMonths = enteredTermMonths;
    const rollovers = enteredRollovers;
    rateSeries = rates.map(([id, label, rate]) => {
      const points = simulateTermDeposit({
        date: today,
        balance,
        annualRate: annualRate!,
        rolloverAnnualRate: rate,
        termMonths,
        rollovers,
        reinvestInterest: inputs.reinvestInterest,
        seed: historySeed,
      });
      const projectedInterest = points.at(-1)!.cumulativeInterest - points[0].cumulativeInterest;
      return toSeries(
        id,
        label,
        rate,
        points,
        points.at(-1)!.balance + (inputs.reinvestInterest ? 0 : projectedInterest),
      );
    });
  } else {
    const months = Math.round(enteredHorizonYears * 12);
    rateSeries = rates.map(([id, label, rate]) => toSeries(
      id,
      label,
      rate,
      simulateSavings({
        date: today,
        balance,
        annualRate: bonusSavings && inputs.bonusConditionsMet ? annualRate! : rate,
        annualRateAfter: rate,
        rateChangesAfterMonths: bonusSavings && inputs.bonusConditionsMet ? bonusMonths : 0,
        months,
        contribution,
        withdrawal,
        seed: historySeed,
      }),
    ));
  }
  return {
    section,
    ready: true,
    missing: [],
    asAt: isoDate(today),
    history,
    rateSeries,
    offsetSeries: rateSeries,
    facts: projectionFacts(section === 'TD'
      ? { section: 'TD', months: Math.max(0, rateSeries[0].points.length - 1), termMonths: enteredTermMonths,
        rollovers: enteredRollovers, reinvestInterest: inputs.reinvestInterest, currentRateFraction: annualRate!,
        rateRange: [lowerRate, baseRate, higherRate], history: historySnapshot }
      : { section: 'Savings', months: Math.round(enteredHorizonYears * 12), horizonYears: enteredHorizonYears,
        rateRange: [lowerRate, baseRate, higherRate], history: historySnapshot,
        contribution: { monthlyAmount: contribution, enteredFrequency: inputs.periodicFrequency },
        withdrawal: { monthlyAmount: withdrawal, enteredFrequency: inputs.withdrawalFrequency },
        bonus: bonusSavings ? { conditionsMet: inputs.bonusConditionsMet, months: bonusMonths,
          conditionalRateFraction: annualRate!, ongoingRateFraction: ongoingRate! } : null }),
    defaultMetric: 'balance',
    availableMetrics: section === 'TD'
      ? ['balance', 'periodInterest', 'cumulativeInterest']
      : ['balance', 'periodInterest', 'cumulativeInterest', 'periodPrincipal', 'cumulativePrincipal'],
    projectionScope: section === 'TD' ? 'term-deposit-maturity' : 'savings-horizon',
  };
}

export const PROJECTION_METRIC_LABELS: Record<ProjectionMetric, UiLabel> = {
  balance: 'Balance',
  periodInterest: 'Interest / month',
  cumulativeInterest: 'Total interest',
  periodPrincipal: 'Principal / month',
  cumulativePrincipal: 'Total principal',
  periodRatio: 'Interest ÷ principal',
  cumulativeRatio: 'Total interest ÷ principal',
};

export function projectionMetricLabel(section: SectionKey, metric: ProjectionMetric): UiLabel {
  if (section !== 'Savings') return PROJECTION_METRIC_LABELS[metric];
  if (metric === 'periodPrincipal') return 'Net deposits / month';
  if (metric === 'cumulativePrincipal') return 'Total net deposits';
  return PROJECTION_METRIC_LABELS[metric];
}

export function projectionCurrency(value: number): UiText {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return uiJoin('$', uiNumber(Number((value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)), abs >= 10_000_000 ? 1 : 2), 'm');
  if (abs >= 1_000) return uiJoin('$', uiNumber(Number((value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)), abs >= 100_000 ? 0 : 1), 'k');
  return uiJoin('$', uiNumber(Math.round(value)));
}
