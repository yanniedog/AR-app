import {
  calculatorAmount,
  calculatorYears,
  computeLvr,
  MAX_CALCULATOR_DEPOSIT_AMOUNT,
  monthlyRepayment,
  quickEstimateUnavailableReason,
} from '../data/calc';
import type { UserRateScenario } from '../data/userRateScenario';
import type { RateRow, SectionKey } from '../types';
import { uiJoin, uiMoney, type UiCopy } from './uiCopy';

export interface RatePosition {
  section: SectionKey;
  currentRate: number;
  matchedRate: number | null;
  matchedRow: RateRow | null;
  gapRate: number | null;
  ready: boolean;
}

export type SavedPositionEstimate = { unavailable: boolean; text: UiCopy } | null;

/** Dollar gap for an entered-rate position, with Rate check's estimate safeguards. */
export function savedPositionEstimate(position: RatePosition, scenario: UserRateScenario): SavedPositionEstimate {
  if (!position.ready || position.matchedRate == null || position.gapRate == null || position.gapRate <= 0) return null;
  if (position.section === 'Mortgage') {
    const loan = computeLvr(scenario.mortgage).loan;
    const years = calculatorYears(scenario.mortgage.years);
    if (!loan || !years) return null;
    const months = Math.round(years * 12);
    const perMonth = monthlyRepayment(loan, position.currentRate, months)
      - monthlyRepayment(loan, position.matchedRate, months);
    return { unavailable: false, text: uiJoin(uiMoney(perMonth), ' / ', 'mo', ' · ', uiMoney(perMonth * 12), ' / ', 'yr') };
  }
  if (!position.matchedRow || quickEstimateUnavailableReason(position.matchedRow, position.section)) {
    return { unavailable: true, text: 'Eligibility / rate conditions unverified' };
  }
  if (position.section === 'Savings' && !scenario.projections.savings.holdVariableRate) {
    return { unavailable: true, text: 'Rate assumption missing' };
  }
  const balance = calculatorAmount((position.section === 'TD' ? scenario.termDeposit : scenario.savings).balance, MAX_CALCULATOR_DEPOSIT_AMOUNT);
  return balance ? { unavailable: false, text: uiJoin(uiMoney(balance * position.gapRate), ' / ', 'yr') } : null;
}
