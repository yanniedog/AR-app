import type { ProductDetail, RateRow, SectionKey } from '../types';
import { advertisedTermMonths, calculatorAmount, computeLvr, MAX_CALCULATOR_MORTGAGE_AMOUNT, num } from './calc';
import { productHasAllFeatures } from './features';
import type { PublicProgramme, RateScenario } from './publicRateModel';
import type { PublicCostFee, PublicCostScenario } from './publicCostModel';
import { publicProgrammeCostFees } from './publicCostFees';
import { resolveSwitchCosts } from './staySwitchProjection';
import type { UserRateScenario } from './userRateScenario';

export function publicInterestPayment(value?: string): 'monthly' | 'quarterly' | 'annually' | 'maturity' | 'daily' | 'unknown' {
  const frequency = value?.trim().toUpperCase();
  if (frequency === 'P1M' || frequency === 'MONTHLY') return 'monthly';
  if (frequency === 'P3M' || frequency === 'QUARTERLY') return 'quarterly';
  if (frequency === 'P1Y' || frequency === 'P12M' || frequency === 'ANNUALLY' || frequency === 'ANNUAL') return 'annually';
  if (frequency === 'AT_MATURITY' || frequency === 'MATURITY') return 'maturity';
  if (frequency === 'P1D' || frequency === 'DAILY') return 'daily';
  return 'unknown';
}

const monthly = (value: string, frequency: string) => {
  const amount = num(value);
  return String(frequency === 'weekly' ? amount * 52 / 12 : frequency === 'fortnightly' ? amount * 26 / 12 : amount);
};
const clean = (value: string) => value.replace(/[$,\s]/g, '');

/** Explicit scenario bridge. Unsupported repayment or payment cadence is never guessed. */
export function scenarioPublicCost({ section, scenario, row, programme, rateScenario = {}, targetDetail, currentDetail,
  operation = 'new', asOf = new Date().toISOString() }: {
  section: SectionKey; scenario: UserRateScenario; row: RateRow; programme?: PublicProgramme; rateScenario?: RateScenario;
  targetDetail?: ProductDetail | null; currentDetail?: ProductDetail | null; operation?: 'new' | 'existing'; asOf?: string;
}): { scenario?: PublicCostScenario; reasonCodes: string[]; assumptions: string[] } {
  const key = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const inputs = scenario?.projections?.[key];
  if (!inputs || !scenario?.[key] || typeof inputs.offsetBalance !== 'string'
    || typeof inputs.horizonYears !== 'string'
    || section === 'Savings' && ['periodicAmount', 'periodicFrequency', 'withdrawalAmount', 'withdrawalFrequency'].some(field => typeof inputs[field as keyof typeof inputs] !== 'string')
    || section === 'Mortgage' && (!scenario.mortgageSwitch || !['buy', 'refi'].includes(scenario.mortgage.mode)
      || ['propertyValue', 'deposit', 'costs', 'loanBalance', 'years'].some(field => typeof scenario.mortgage[field as keyof typeof scenario.mortgage] !== 'string')
      || typeof inputs.extraRepaymentAmount !== 'string' || typeof inputs.extraRepaymentFrequency !== 'string')) {
    return { reasonCodes: ['scenario_inputs_missing'], assumptions: [] };
  }
  const offset = clean(inputs.offsetBalance) || '0';
  const feeContext = programme ? publicProgrammeCostFees(programme, {
    operation, switchingCostsKnown: false,
    offsetTermsKnown: offset === '0',
  }) : { fees: [], feesKnown: false, reasonCodes: ['material_fee_coverage_unknown'], assumptions: [] };
  let fees: PublicCostFee[] = feeContext.fees;
  const assumptions = [...feeContext.assumptions];
  const fixed = section === 'TD' || programme?.metadata?.rateStructure === 'fixed' || row.rate_type?.toUpperCase().includes('FIXED') === true
    || row.ribbon_rate_structure?.toLowerCase() === 'fixed';
  const base = {
    asOf, rateBehaviour: fixed ? 'fixed' as const : 'variable' as const, holdCurrentRate: inputs.holdVariableRate,
    feesKnown: feeContext.feesKnown, fees, rateScenario, programme,
    ...(section !== 'TD' && inputs.horizonYears.trim() ? { comparisonMonths: Math.round(Number(inputs.horizonYears) * 12) } : {}),
    ...(section === 'Mortgage' && fixed ? { fixedPeriodMonths: advertisedTermMonths(row) ?? undefined } : {}),
  };
  if (section === 'Mortgage') {
    const principal = scenario.mortgage.mode === 'refi' ? calculatorAmount(scenario.mortgage.loanBalance, MAX_CALCULATOR_MORTGAGE_AMOUNT) : computeLvr(scenario.mortgage).loan;
    if (principal == null || principal <= 0) return { reasonCodes: ['loan_amount_unknown'], assumptions };
    const repayment = (rateScenario.repayment ?? row.repayment_type ?? row.ribbon_repayment_type)?.toUpperCase();
    if (repayment !== 'PRINCIPAL_AND_INTEREST' && repayment !== 'P&I' && repayment !== 'PI' && repayment !== 'INTEREST_ONLY' && repayment !== 'IO') {
      return { reasonCodes: ['repayment_basis_unknown'], assumptions };
    }
    if (operation === 'new') {
      const switching = resolveSwitchCosts(scenario.mortgageSwitch, currentDetail, targetDetail);
      // Numerical overrides replace the matched public bucket. They do not stack with the same fee.
      const bucket: Record<string, string> = { APPLICATION: 'applicationFees', VALUATION: 'valuationFees', SETTLEMENT: 'settlementFees', DISCHARGE: 'currentBankExitFees', EXIT: 'currentBankExitFees' };
      const entered = new Set(switching.fees.filter(fee => fee.source === 'entered').map(fee => fee.key));
      fees = fees.filter(fee => {
        const source = programme?.fees?.find(item => item.feeId === fee.feeId);
        const key = source ? bucket[source.source.rawType] : undefined;
        return !key || !entered.has(key as typeof switching.fees[number]['key']);
      });
      for (const fee of switching.fees) if (fee.source === 'entered' || !programme && fee.source === 'published') {
        fees.push({ feeId: `local-switch:${fee.key}`, kind: fee.key === 'currentBankExitFees' ? 'switching' : 'upfront', amount: String(fee.amount),
          conditions: [], evidenceIds: [], origin: fee.source === 'entered' ? 'user' : 'public', atMonth: 0,
          funding: scenario.mortgageSwitch.fundingMethod === 'new-loan' ? 'financed' : 'cash' });
      }
      if (scenario.mortgageSwitch.cashback.trim()) fees.push({ feeId: 'local-switch:cashback', kind: 'cashback', amount: clean(scenario.mortgageSwitch.cashback),
        atMonth: 0, conditions: [], evidenceIds: [], origin: 'user', funding: 'cash' });
      assumptions.push('Switching fees/cashback: local assumptions', 'Unspecified costs: unknown');
      base.feesKnown = false;
    }
    const offsetSupported = scenario.mortgageSwitch.targetOffsetAvailable === 'no' ? false
      : scenario.mortgageSwitch.targetOffsetAvailable === 'yes' || productHasAllFeatures(row.product_key, ['OFFSET'],
        targetDetail ? { [row.product_key]: targetDetail } : null, row, 'Mortgage');
    return { scenario: { ...base, fees, section: 'Mortgage', principal: String(principal),
      remainingTermMonths: Math.round(Number(scenario.mortgage.years) * 12),
      repayment: repayment === 'INTEREST_ONLY' || repayment === 'IO' ? 'interest_only' : 'principal_and_interest',
      offsetBalance: offset, offsetSupported,
      extraMonthlyRepayment: monthly(inputs.extraRepaymentAmount, inputs.extraRepaymentFrequency),
    }, reasonCodes: feeContext.reasonCodes, assumptions };
  }
  const interestPayment = publicInterestPayment(programme?.metadata?.interestPayment?.type === 'maturity' ? 'MATURITY'
    : programme?.metadata?.interestPayment?.frequency ?? row.interest_payment);
  if (section === 'Savings') return { scenario: { ...base, section: 'Savings', startingBalance: clean(scenario.savings.balance),
    monthlyContribution: monthly(inputs.periodicAmount, inputs.periodicFrequency), monthlyWithdrawal: monthly(inputs.withdrawalAmount, inputs.withdrawalFrequency),
    interestPayment, interestBasis: interestPayment === 'daily' ? 'actual_365' : 'monthly_nominal',
  }, reasonCodes: feeContext.reasonCodes, assumptions };
  if (interestPayment === 'daily') return { reasonCodes: ['interest_payment_frequency_unsupported'], assumptions };
  const dayTerm = programme?.metadata?.quotedTerm?.unit === 'day' ? Number(programme.metadata.quotedTerm.value)
    : row.term && /^P\d+D$/.test(row.term) ? Number(row.term.slice(1, -1)) : undefined;
  assumptions.push('Quoted principal: fixed until maturity', 'Reinvestment/renewal rates: separate local assumptions');
  return { scenario: { ...base, section: 'TD', deposit: clean(scenario.termDeposit.balance),
    ...(dayTerm ? { quotedTermDays: dayTerm } : { quotedTermMonths: programme?.metadata?.quotedTerm?.unit === 'month'
      ? Number(programme.metadata.quotedTerm.value) : advertisedTermMonths(row) ?? Number(inputs.termMonths) }),
    interestPayment, interestBasis: dayTerm ? 'actual_365' : 'monthly_nominal', reinvestPaidInterest: false,
  }, reasonCodes: feeContext.reasonCodes, assumptions };
}
